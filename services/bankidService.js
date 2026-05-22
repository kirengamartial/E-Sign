const https = require('https');
const fs = require('fs');
const axios = require('axios');
const config = require('../config/bankid');

// ------------------------------------------------------------------
// HTTPS agent
// The BankID API requires mutual TLS — we must present our client
// certificate on every request. The .p12 file contains both the
// private key and the certificate chain.
//
// rejectUnauthorized: false is only acceptable for the test environment
// because the test server uses a self-signed root CA. In production
// this must be true (or you provide BankID's production CA cert).
// ------------------------------------------------------------------
const httpsAgent = new https.Agent({
  pfx: fs.readFileSync(config.certPath),
  passphrase: config.certPassphrase,
  rejectUnauthorized: !config.isTest,
});

const apiClient = axios.create({
  baseURL: config.baseUrl,
  httpsAgent,
  headers: { 'Content-Type': 'application/json' },
});

// ------------------------------------------------------------------
// In-memory order store
// When /auth starts an order we store the QR secrets here so the
// /qr endpoint can generate the animated QR without exposing secrets
// to the client. Keyed by orderRef.
// In production you would use Redis or a database.
// ------------------------------------------------------------------
const orderStore = new Map();

function saveOrder(orderRef, data) {
  orderStore.set(orderRef, data);
}

function getOrder(orderRef) {
  return orderStore.get(orderRef);
}

function deleteOrder(orderRef) {
  orderStore.delete(orderRef);
}

// ------------------------------------------------------------------
// BankID API calls
// ------------------------------------------------------------------

// Start an authentication order.
// endUserIp: the IP address of the end user (required by BankID).
// Returns: orderRef, autoStartToken, qrStartToken, qrStartSecret
async function startAuth(endUserIp) {
  const response = await apiClient.post('/auth', { endUserIp });
  return response.data;
}

// Poll the status of an order.
// Call this every 2 seconds until status is "complete" or "failed".
//
// Possible statuses:
//   pending  → user hasn't acted yet (check hintCode for details)
//   failed   → authentication failed  (check hintCode for reason)
//   complete → success, completionData contains the user info
async function collectOrder(orderRef) {
  const response = await apiClient.post('/collect', { orderRef });
  return response.data;
}

// Cancel an ongoing order.
// Call this if the user closes the login dialog before completing.
async function cancelOrder(orderRef) {
  await apiClient.post('/cancel', { orderRef });
}

// Start a signing order.
// userVisibleText : plain text the user reads in the BankID app (max 1500 chars)
// documentHash    : SHA-256 hex of the document — sent as non-visible data for
//                   cryptographic binding (user doesn't see it, but it's in the signature)
//
// Note: We intentionally do NOT set userVisibleDataFormat to avoid app version
// compatibility issues (error 146). Plain text works across all BankID app versions.
async function startSign(endUserIp, userVisibleText, documentHash) {
  const response = await apiClient.post('/sign', {
    endUserIp,
    userVisibleData: Buffer.from(userVisibleText).toString('base64'),
    userNonVisibleData: Buffer.from(documentHash).toString('base64'),
  });
  return response.data;
}

module.exports = {
  startAuth,
  startSign,
  collectOrder,
  cancelOrder,
  saveOrder,
  getOrder,
  deleteOrder,
};
