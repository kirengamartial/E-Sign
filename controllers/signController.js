const fs = require('fs');
const bankid = require('../services/bankidService');
const signService = require('../services/signService');

// In-memory store: orderRef → { documentId, filename, documentHash }
// Cleaned up when collect finishes or order is cancelled.
const signingOrders = new Map();

// ------------------------------------------------------------------
// POST /api/sign/upload
//
// Accepts a PDF file (multipart/form-data, field name: "document").
// Saves it and returns the info needed to start signing.
//
// Response:
// {
//   documentId: "uuid",
//   filename:   "contract.pdf",
//   hash:       "sha256hex..."
// }
// ------------------------------------------------------------------
async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { documentId, filename, hash } = signService.saveUpload(req.file);

    res.json({ documentId, filename, hash });
  } catch (error) {
    console.error('[Upload Error]', error.message);
    res.status(500).json({ error: 'Failed to save uploaded file' });
  }
}

// ------------------------------------------------------------------
// POST /api/sign/start
//
// Starts a BankID signing order for a specific document.
// The user will see the document name and hash in their BankID app
// before they approve, binding their identity to this exact document.
//
// Body: { documentId, filename, documentHash, endUserIp? }
//
// Response:
// {
//   orderRef:       "uuid"   ← use in /collect and /cancel
//   autoStartToken: "..."    ← for deep-linking into the BankID app
// }
// ------------------------------------------------------------------
async function startSigning(req, res) {
  try {
    const { documentId, filename, documentHash } = req.body;
    const endUserIp = req.body.endUserIp || req.ip || '127.0.0.1';

    if (!documentId || !filename || !documentHash) {
      return res.status(400).json({ error: 'documentId, filename and documentHash are required' });
    }

    // Plain text shown to the user inside their BankID app before they approve.
    // No markdown — plain text works across all BankID app versions.
    const userVisibleText =
      `Sign Document\n\n` +
      `Document: ${filename}\n` +
      `SHA-256: ${documentHash.slice(0, 16)}...${documentHash.slice(-8)}\n\n` +
      `By approving, I confirm that I have read and accept the contents of this document.`;

    const { orderRef, autoStartToken, qrStartToken, qrStartSecret } =
      await bankid.startSign(endUserIp, userVisibleText, documentHash);

    // Store QR secrets so /api/auth/qr/:orderRef can serve the live QR
    bankid.saveOrder(orderRef, {
      qrStartToken,
      qrStartSecret,
      orderTime: Math.floor(Date.now() / 1000),
    });

    // Store document info — needed when collect completes to stamp the PDF
    signingOrders.set(orderRef, { documentId, filename, documentHash });

    res.json({ orderRef, autoStartToken });
  } catch (error) {
    handleBankIdError(error, res);
  }
}

// ------------------------------------------------------------------
// POST /api/sign/collect
//
// Polls the BankID signing order.
// On success: stamps the PDF with a signature certificate page,
// saves the proof JSON, and returns the documentId for download.
//
// Body: { orderRef }
//
// Response (pending):  { status: "pending", hintCode: "..." }
// Response (failed):   { status: "failed",  hintCode: "..." }
// Response (complete): { status: "complete", user: {...}, documentId: "..." }
// ------------------------------------------------------------------
async function collectSigning(req, res) {
  try {
    const { orderRef } = req.body;

    if (!orderRef) {
      return res.status(400).json({ error: 'orderRef is required' });
    }

    const result = await bankid.collectOrder(orderRef);

    if (result.status === 'complete') {
      const orderData = signingOrders.get(orderRef);
      signingOrders.delete(orderRef);
      bankid.deleteOrder(orderRef);

      if (!orderData) {
        return res.status(400).json({ error: 'Signing order not found' });
      }

      const { documentId, filename, documentHash } = orderData;
      const { user, signature, ocspResponse } = result.completionData;

      // Full legal proof record
      const proof = {
        documentId,
        filename,
        documentHash,
        user,
        signature,
        ocspResponse,
        timestamp: new Date().toISOString(),
      };

      // Add signature certificate page to PDF + save proof JSON
      await signService.stampAndSavePdf(documentId, filename, proof);
      signService.saveProof(documentId, proof);

      return res.json({ status: 'complete', user, documentId });
    }

    if (result.status === 'failed') {
      signingOrders.delete(orderRef);
      bankid.deleteOrder(orderRef);
      return res.json({ status: 'failed', hintCode: result.hintCode });
    }

    res.json({ status: 'pending', hintCode: result.hintCode });
  } catch (error) {
    if (isNoSuchOrder(error)) {
      bankid.deleteOrder(req.body.orderRef);
      signingOrders.delete(req.body.orderRef);
      return res.json({ status: 'failed', hintCode: 'expiredTransaction' });
    }
    handleBankIdError(error, res);
  }
}

// ------------------------------------------------------------------
// POST /api/sign/cancel
//
// Cancels an ongoing signing order.
// Body: { orderRef }
// ------------------------------------------------------------------
async function cancelSigning(req, res) {
  try {
    const { orderRef } = req.body;
    if (!orderRef) return res.status(400).json({ error: 'orderRef is required' });

    await bankid.cancelOrder(orderRef);
    signingOrders.delete(orderRef);
    bankid.deleteOrder(orderRef);

    res.json({ message: 'Signing cancelled' });
  } catch (error) {
    if (isNoSuchOrder(error)) {
      bankid.deleteOrder(req.body.orderRef);
      signingOrders.delete(req.body.orderRef);
      return res.json({ message: 'Order already completed or expired' });
    }
    handleBankIdError(error, res);
  }
}

// ------------------------------------------------------------------
// GET /api/sign/download/:documentId
//
// Downloads the signed PDF (with the signature certificate page).
// ------------------------------------------------------------------
async function downloadSigned(req, res) {
  try {
    const signedPath = signService.getSignedPath(req.params.documentId);

    if (!fs.existsSync(signedPath)) {
      return res.status(404).json({ error: 'Signed document not found' });
    }

    res.download(signedPath, 'signed_document.pdf');
  } catch (error) {
    console.error('[Download Error]', error.message);
    res.status(500).json({ error: 'Failed to download document' });
  }
}

// ------------------------------------------------------------------
// GET /api/sign/proof/:documentId
//
// Returns the full BankID proof JSON (signature, OCSP, user, hash).
// ------------------------------------------------------------------
async function getProof(req, res) {
  try {
    const proofPath = signService.getProofPath(req.params.documentId);

    if (!fs.existsSync(proofPath)) {
      return res.status(404).json({ error: 'Proof not found' });
    }

    res.json(JSON.parse(fs.readFileSync(proofPath, 'utf8')));
  } catch (error) {
    console.error('[Proof Error]', error.message);
    res.status(500).json({ error: 'Failed to retrieve proof' });
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function isNoSuchOrder(error) {
  return (
    error.response?.data?.errorCode === 'invalidParameters' &&
    error.response?.data?.details === 'No such order'
  );
}

function handleBankIdError(error, res) {
  if (error.response) {
    const { errorCode, details } = error.response.data;
    console.error('[BankID Sign Error]', errorCode, details);
    return res.status(error.response.status).json({ error: errorCode, details });
  }
  console.error('[Sign Error]', error.message);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = {
  uploadDocument,
  startSigning,
  collectSigning,
  cancelSigning,
  downloadSigned,
  getProof,
};
