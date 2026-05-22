const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_DIR = path.join(__dirname, '../storage/uploads');
const SIGNED_DIR  = path.join(__dirname, '../storage/signed');
const PROOFS_DIR  = path.join(__dirname, '../storage/proofs');

// Create directories on startup if they don't exist
[UPLOADS_DIR, SIGNED_DIR, PROOFS_DIR].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

// ------------------------------------------------------------------
// Save an uploaded PDF buffer to disk.
// Returns: { documentId, filename, hash }
// ------------------------------------------------------------------
function saveUpload(file) {
  const documentId = uuidv4();
  const filename   = file.originalname;
  const buffer     = file.buffer;

  fs.writeFileSync(path.join(UPLOADS_DIR, `${documentId}.pdf`), buffer);

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  return { documentId, filename, hash };
}

// ------------------------------------------------------------------
// Path helpers
// ------------------------------------------------------------------
function getUploadPath(documentId) {
  return path.join(UPLOADS_DIR, `${documentId}.pdf`);
}

function getSignedPath(documentId) {
  return path.join(SIGNED_DIR, `${documentId}_signed.pdf`);
}

function getProofPath(documentId) {
  return path.join(PROOFS_DIR, `${documentId}_proof.json`);
}

// ------------------------------------------------------------------
// Add a signature certificate page to the PDF.
//
// We append a new page at the end so the original content is
// never touched. The page shows:
//   - Who signed (name + personal number)
//   - When they signed (timestamp)
//   - What they signed (filename + SHA-256 hash)
//   - The BankID signature reference (first 64 chars)
//   - Legal notice
// ------------------------------------------------------------------
async function stampAndSavePdf(documentId, filename, proof) {
  const { user, timestamp, documentHash, signature } = proof;

  const originalBytes = fs.readFileSync(getUploadPath(documentId));
  const pdfDoc = await PDFDocument.load(originalBytes);

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  // Add a dedicated signature certificate page at the end
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const navy  = rgb(0.098, 0.231, 0.431);  // bankid-700
  const light = rgb(0.933, 0.949, 0.980);  // bankid-50
  const dark  = rgb(0.12, 0.12, 0.12);
  const muted = rgb(0.4, 0.4, 0.4);
  const white = rgb(1, 1, 1);
  const green = rgb(0.133, 0.545, 0.133);

  // ── Header band ──────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: navy });

  page.drawText('SIGNATURE CERTIFICATE', {
    x: 40, y: height - 35,
    size: 16, font: boldFont, color: white,
  });
  page.drawText('Electronically signed via Swedish BankID', {
    x: 40, y: height - 58,
    size: 10, font, color: rgb(0.8, 0.88, 1),
  });

  // BankID iD badge (top right)
  page.drawRectangle({ x: width - 80, y: height - 64, width: 50, height: 28, color: rgb(1,1,1,0.15) });
  page.drawText('iD', { x: width - 67, y: height - 50, size: 14, font: boldFont, color: white });

  // ── Verified badge ────────────────────────────────────────────────
  page.drawRectangle({ x: 40, y: height - 120, width: 160, height: 28, color: rgb(0.9, 1, 0.9) });
  page.drawRectangle({ x: 40, y: height - 120, width: 160, height: 28,
    borderColor: green, borderWidth: 1 });
  page.drawText('Signature verified', {
    x: 52, y: height - 110, size: 10, font: boldFont, color: green,
  });

  let y = height - 160;
  const lineH = 20;

  // ── Section: Signer ──────────────────────────────────────────────
  drawSectionHeader(page, 'SIGNER INFORMATION', 40, y, width - 80, boldFont, navy, light);
  y -= 30;

  drawField(page, 'Full name',         user.name,           40, y, font, boldFont, dark, muted); y -= lineH;
  drawField(page, 'Personal number',   user.personalNumber, 40, y, font, boldFont, dark, muted); y -= lineH;
  drawField(page, 'Given name',        user.givenName,      40, y, font, boldFont, dark, muted); y -= lineH;
  drawField(page, 'Surname',           user.surname,        40, y, font, boldFont, dark, muted); y -= lineH * 1.5;

  // ── Section: Document ─────────────────────────────────────────────
  drawSectionHeader(page, 'DOCUMENT INFORMATION', 40, y, width - 80, boldFont, navy, light);
  y -= 30;

  drawField(page, 'Filename',  filename,     40, y, font, boldFont, dark, muted); y -= lineH;
  drawField(page, 'Signed at', new Date(timestamp).toUTCString(), 40, y, font, boldFont, dark, muted); y -= lineH * 1.5;

  // Hash — full value in monospace across two lines
  page.drawText('SHA-256 hash:', { x: 40, y, size: 9, font: boldFont, color: muted });
  y -= 14;
  page.drawRectangle({ x: 40, y: y - 6, width: width - 80, height: 16, color: rgb(0.96, 0.96, 0.96) });
  page.drawText(documentHash, { x: 44, y, size: 7.5, font: monoFont, color: dark });
  y -= lineH * 1.5;

  // ── Section: BankID Signature ─────────────────────────────────────
  drawSectionHeader(page, 'BANKID SIGNATURE REFERENCE', 40, y, width - 80, boldFont, navy, light);
  y -= 30;

  // Show first 96 chars of the base64 signature as a reference
  const sigRef = signature ? signature.slice(0, 96) + '...' : 'N/A';
  page.drawText('Signature (partial):', { x: 40, y, size: 9, font: boldFont, color: muted });
  y -= 14;
  page.drawRectangle({ x: 40, y: y - 6, width: width - 80, height: 30, color: rgb(0.96, 0.96, 0.96) });
  // Split across two lines (48 chars each)
  page.drawText(sigRef.slice(0, 80),  { x: 44, y: y + 8, size: 7, font: monoFont, color: dark });
  page.drawText(sigRef.slice(80),     { x: 44, y,        size: 7, font: monoFont, color: dark });
  y -= 40;

  // ── Footer notice ─────────────────────────────────────────────────
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.8,0.8,0.8) });
  y -= 16;
  page.drawText(
    'This document has been electronically signed using Swedish BankID. The full BankID signature and OCSP response',
    { x: 40, y, size: 7.5, font, color: muted }
  );
  y -= 12;
  page.drawText(
    'are stored separately as legal proof. BankID signatures are legally binding under Swedish and EU electronic signature law.',
    { x: 40, y, size: 7.5, font, color: muted }
  );

  const signedBytes = await pdfDoc.save();
  fs.writeFileSync(getSignedPath(documentId), signedBytes);
}

// ------------------------------------------------------------------
// Save the full BankID proof as JSON.
// This is the legal record — it contains the complete signature,
// the OCSP response (certificate validity proof), and the document hash.
// ------------------------------------------------------------------
function saveProof(documentId, proof) {
  fs.writeFileSync(getProofPath(documentId), JSON.stringify(proof, null, 2));
}

// ------------------------------------------------------------------
// Internal drawing helpers
// ------------------------------------------------------------------
function drawSectionHeader(page, label, x, y, w, boldFont, navy, light) {
  page.drawRectangle({ x, y: y - 4, width: w, height: 20, color: light });
  page.drawText(label, { x: x + 8, y: y + 2, size: 8.5, font: boldFont, color: navy });
}

function drawField(page, label, value, x, y, font, boldFont, dark, muted) {
  page.drawText(`${label}:`, { x, y, size: 9, font: boldFont, color: muted });
  page.drawText(String(value ?? ''), { x: x + 130, y, size: 9, font, color: dark });
}

module.exports = {
  saveUpload,
  getUploadPath,
  getSignedPath,
  getProofPath,
  stampAndSavePdf,
  saveProof,
};
