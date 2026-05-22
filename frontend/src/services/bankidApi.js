const BASE_AUTH = '/api/auth';
const BASE_SIGN = '/api/sign';

// ── Auth ─────────────────────────────────────────────────────────────

// Start a BankID authentication order.
// Returns { orderRef, autoStartToken }
export async function startAuth() {
  const res = await fetch(`${BASE_AUTH}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endUserIp: '127.0.0.1' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start authentication');
  }
  return res.json();
}

// Get the current QR code data string for an order.
// Returns { qrData } — pass into the QR code component.
export async function getQrData(orderRef) {
  const res = await fetch(`${BASE_AUTH}/qr/${orderRef}`);
  if (!res.ok) throw new Error('Failed to get QR data');
  return res.json();
}

// Poll the status of an auth order.
export async function collectAuth(orderRef) {
  const res = await fetch(`${BASE_AUTH}/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderRef }),
  });
  if (!res.ok) throw new Error('Failed to collect auth status');
  return res.json();
}

// Cancel an auth order.
export async function cancelAuth(orderRef) {
  await fetch(`${BASE_AUTH}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderRef }),
  });
}

// ── Sign ──────────────────────────────────────────────────────────────

// Upload a PDF file. Returns { documentId, filename, hash }
export async function uploadDocument(file) {
  const form = new FormData();
  form.append('document', file);

  const res = await fetch(`${BASE_SIGN}/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to upload document');
  }
  return res.json();
}

// Start a BankID signing order for a document.
// Returns { orderRef, autoStartToken }
export async function startSigning(documentId, filename, documentHash) {
  const res = await fetch(`${BASE_SIGN}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, filename, documentHash, endUserIp: '127.0.0.1' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start signing');
  }
  return res.json();
}

// Poll the signing order status.
export async function collectSigning(orderRef) {
  const res = await fetch(`${BASE_SIGN}/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderRef }),
  });
  if (!res.ok) throw new Error('Failed to collect signing status');
  return res.json();
}

// Cancel a signing order.
export async function cancelSigning(orderRef) {
  await fetch(`${BASE_SIGN}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderRef }),
  });
}

// Download URL for a signed document (use as href or window.location)
export function getDownloadUrl(documentId) {
  return `${BASE_SIGN}/download/${documentId}`;
}
