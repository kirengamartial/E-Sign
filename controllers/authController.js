const bankid = require('../services/bankidService');
const { generateQrData } = require('../utils/qrGenerator');

// ------------------------------------------------------------------
// POST /api/auth/start
//
// Starts a BankID authentication order.
// The client receives orderRef and uses it for all subsequent calls.
//
// Body: { endUserIp? }   ← optional, falls back to request IP
//
// Response:
// {
//   orderRef:       "abc123..."   ← use this in /collect and /cancel
//   autoStartToken: "xyz..."      ← used to launch the BankID app directly (deep link)
// }
// ------------------------------------------------------------------
async function startAuth(req, res) {
  try {
    const endUserIp = req.body.endUserIp || req.ip || '127.0.0.1';

    const { orderRef, autoStartToken, qrStartToken, qrStartSecret } =
      await bankid.startAuth(endUserIp);

    // Store secrets server-side — never send qrStartSecret to the client
    bankid.saveOrder(orderRef, {
      qrStartToken,
      qrStartSecret,
      orderTime: Math.floor(Date.now() / 1000),
    });

    res.json({ orderRef, autoStartToken });
  } catch (error) {
    handleBankIdError(error, res);
  }
}

// ------------------------------------------------------------------
// GET /api/auth/qr/:orderRef
//
// Returns the current QR code data string for the given order.
// The client must call this every second and re-render the QR image.
// The QR changes every second — that's how BankID animates it.
//
// Response:
// {
//   qrData: "bankid.abc.3.def456..."   ← encode this into a QR image
// }
// ------------------------------------------------------------------
async function getQrCode(req, res) {
  try {
    const { orderRef } = req.params;
    const order = bankid.getOrder(orderRef);

    if (!order) {
      return res.status(404).json({ error: 'Order not found or already completed' });
    }

    const qrData = generateQrData(order.qrStartToken, order.qrStartSecret, order.orderTime);

    res.json({ qrData });
  } catch (error) {
    handleBankIdError(error, res);
  }
}

// ------------------------------------------------------------------
// POST /api/auth/collect
//
// Polls the status of an authentication order.
// Call this every 2 seconds after starting an order.
//
// Body: { orderRef }
//
// Response (pending):
// {
//   status: "pending",
//   hintCode: "outstandingTransaction" | "userSign" | "noClient" | ...
// }
//
// Response (failed):
// {
//   status: "failed",
//   hintCode: "expiredTransaction" | "certificateErr" | "userCancel" | ...
// }
//
// Response (complete):
// {
//   status: "complete",
//   user: {
//     personalNumber: "19970901-2380",
//     name: "Mart Kir",
//     givenName: "Mart",
//     surname: "Kir"
//   }
// }
// ------------------------------------------------------------------
async function collectAuth(req, res) {
  try {
    const { orderRef } = req.body;

    if (!orderRef) {
      return res.status(400).json({ error: 'orderRef is required' });
    }

    const result = await bankid.collectOrder(orderRef);

    if (result.status === 'complete') {
      bankid.deleteOrder(orderRef);
      return res.json({
        status: 'complete',
        user: result.completionData.user,
      });
    }

    if (result.status === 'failed') {
      bankid.deleteOrder(orderRef);
      return res.json({
        status: 'failed',
        hintCode: result.hintCode,
      });
    }

    // Still pending — tell client to keep polling
    res.json({
      status: 'pending',
      hintCode: result.hintCode,
    });
  } catch (error) {
    // BankID returns "No such order" when an order has already been completed,
    // cancelled, or expired. This is an expected race condition — the frontend
    // may fire one last collect call just as the order finishes. Treat it as
    // a graceful end instead of logging it as an error.
    if (isNoSuchOrder(error)) {
      bankid.deleteOrder(req.body.orderRef);
      return res.json({ status: 'failed', hintCode: 'expiredTransaction' });
    }
    handleBankIdError(error, res);
  }
}

// ------------------------------------------------------------------
// POST /api/auth/cancel
//
// Cancels an ongoing authentication order.
// Always call this if the user abandons the flow mid-way.
//
// Body: { orderRef }
//
// Response:
// { message: "Order cancelled" }
// ------------------------------------------------------------------
async function cancelAuth(req, res) {
  try {
    const { orderRef } = req.body;

    if (!orderRef) {
      return res.status(400).json({ error: 'orderRef is required' });
    }

    await bankid.cancelOrder(orderRef);
    bankid.deleteOrder(orderRef);

    res.json({ message: 'Order cancelled' });
  } catch (error) {
    // If the order no longer exists on BankID's side, cancellation is a no-op
    if (isNoSuchOrder(error)) {
      bankid.deleteOrder(req.body.orderRef);
      return res.json({ message: 'Order already completed or expired' });
    }
    handleBankIdError(error, res);
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

// Returns true when BankID says the order doesn't exist.
// This is an expected state (order completed, expired, or already cancelled)
// and should not be treated as a server error.
function isNoSuchOrder(error) {
  return (
    error.response?.data?.errorCode === 'invalidParameters' &&
    error.response?.data?.details === 'No such order'
  );
}

// BankID returns structured error responses.
// Common errorCodes:
//   alreadyInProgress → an order is already active for this personal number
//   invalidParameters → bad request body
//   unauthorized      → certificate issue
//   requestTimeout    → BankID server didn't respond in time
//   maintenance       → BankID is down for maintenance
function handleBankIdError(error, res) {
  if (error.response) {
    const { errorCode, details } = error.response.data;
    console.error('[BankID Error]', errorCode, details);
    return res.status(error.response.status).json({ error: errorCode, details });
  }
  console.error('[Server Error]', error.message);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { startAuth, getQrCode, collectAuth, cancelAuth };
