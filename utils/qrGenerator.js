const crypto = require('crypto');

// BankID QR code data must be regenerated every second while the user hasn't scanned yet.
//
// Formula (from BankID RP API docs):
//   qrTime     = seconds elapsed since the /auth call was made
//   qrAuthCode = HMAC-SHA256(key=qrStartSecret, data=String(qrTime))  → hex
//   qrData     = "bankid." + qrStartToken + "." + qrTime + "." + qrAuthCode
//
// The client encodes qrData into a QR image and shows it to the user.
// Every second the image changes — the user must scan before it updates again.

function generateQrData(qrStartToken, qrStartSecret, orderTime) {
  const qrTime = Math.floor(Date.now() / 1000) - orderTime;

  const qrAuthCode = crypto
    .createHmac('sha256', qrStartSecret)
    .update(String(qrTime))
    .digest('hex');

  return `bankid.${qrStartToken}.${qrTime}.${qrAuthCode}`;
}

module.exports = { generateQrData };
