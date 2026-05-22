import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useAuth } from '../context/AuthContext';
import {
  uploadDocument, startSigning, collectSigning,
  cancelSigning, getQrData, getDownloadUrl,
} from '../services/bankidApi';

// Maps BankID hint codes to readable messages
const HINTS = {
  outstandingTransaction: 'Open the BankID app and scan the code',
  noClient:              'Open the BankID app on your phone',
  userSign:              'Read and confirm the signing request in your BankID app',
  started:               'Starting BankID...',
  expiredTransaction:    'The request expired. Please try again.',
  userCancel:            'You cancelled the signing.',
};

// ── Page states ──────────────────────────────────────────────────────
// upload   → drag & drop / file picker
// confirm  → show doc info, checkbox, sign button
// signing  → live QR code
// complete → success + download button
// ─────────────────────────────────────────────────────────────────────

export default function SignPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep]           = useState('upload');
  const [document, setDocument]   = useState(null); // { documentId, filename, hash, file }
  const [confirmed, setConfirmed] = useState(false);
  const [qrData, setQrData]       = useState('');
  const [signStatus, setSignStatus] = useState('starting');
  const [hintCode, setHintCode]   = useState('');
  const [signedDocId, setSignedDocId] = useState(null);
  const [error, setError]         = useState('');
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef       = useRef(null);
  const orderRefRef        = useRef(null);
  const qrIntervalRef      = useRef(null);
  const collectIntervalRef = useRef(null);
  const doneRef            = useRef(false);

  // Cleanup intervals on unmount
  useEffect(() => () => cleanup(), []);

  // ── File handling ──────────────────────────────────────────────────

  async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a valid PDF file.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const result = await uploadDocument(file);
      setDocument({ ...result, file });
      setStep('confirm');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function onFileInput(e) { handleFile(e.target.files[0]); }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  // ── Signing flow ───────────────────────────────────────────────────

  async function beginSigning() {
    doneRef.current = false;
    setStep('signing');
    setSignStatus('starting');
    setQrData('');
    setHintCode('');
    setError('');

    try {
      const { orderRef } = await startSigning(
        document.documentId, document.filename, document.hash
      );
      if (doneRef.current) return;
      orderRefRef.current = orderRef;
      setSignStatus('pending');

      // Refresh QR every second
      qrIntervalRef.current = setInterval(async () => {
        if (doneRef.current) return;
        try {
          const { qrData } = await getQrData(orderRef);
          if (doneRef.current) return;
          setQrData(qrData);
        } catch { /* ignore */ }
      }, 1000);

      // Poll collect every 2 seconds
      collectIntervalRef.current = setInterval(async () => {
        if (doneRef.current) return;
        try {
          const result = await collectSigning(orderRef);
          if (doneRef.current) return;

          if (result.status === 'complete') {
            cleanup();
            setSignStatus('complete');
            setSignedDocId(result.documentId);
            setStep('complete');
          } else if (result.status === 'failed') {
            cleanup();
            setSignStatus('failed');
            setHintCode(result.hintCode);
          } else {
            setHintCode(result.hintCode);
          }
        } catch { /* ignore */ }
      }, 2000);

    } catch (err) {
      if (doneRef.current) return;
      setSignStatus('failed');
      setError(err.message);
    }
  }

  async function handleCancel() {
    cleanup();
    if (orderRefRef.current) await cancelSigning(orderRefRef.current);
    setStep('confirm');
    setSignStatus('starting');
  }

  function cleanup() {
    doneRef.current = true;
    clearInterval(qrIntervalRef.current);
    clearInterval(collectIntervalRef.current);
    qrIntervalRef.current = null;
    collectIntervalRef.current = null;
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="text-slate-400 hover:text-slate-700 transition mr-1"
            >
              ←
            </button>
            <div className="w-8 h-8 bg-bankid-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-semibold text-slate-900">E-Sign</span>
          </div>
          {user && (
            <span className="text-sm text-slate-500">
              Signed in as <span className="font-medium text-slate-700">{user.name}</span>
            </span>
          )}
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">

        {/* Progress steps */}
        <StepIndicator current={step} />

        {/* ── STEP: Upload ── */}
        {step === 'upload' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Upload Document</h1>
            <p className="text-slate-500 text-sm mb-8">
              Upload the PDF you want to sign with BankID
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-bankid-500 bg-bankid-50'
                  : 'border-slate-200 hover:border-bankid-500 hover:bg-slate-50'
              }`}
            >
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              {uploading ? (
                <p className="text-slate-500 text-sm">Uploading...</p>
              ) : (
                <>
                  <p className="text-slate-700 font-medium mb-1">
                    Drop your PDF here, or <span className="text-bankid-500">browse</span>
                  </p>
                  <p className="text-slate-400 text-sm">PDF only · Max 10 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={onFileInput}
            />

            {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
          </div>
        )}

        {/* ── STEP: Confirm ── */}
        {step === 'confirm' && document && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Review & Sign</h1>
            <p className="text-slate-500 text-sm mb-8">
              Confirm the document details before signing
            </p>

            {/* Document card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{document.filename}</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono truncate">
                    SHA-256: {document.hash}
                  </p>
                </div>
              </div>
            </div>

            {/* What the user will see in BankID app */}
            <div className="bg-bankid-50 border border-bankid-100 rounded-xl p-4 mb-6">
              <p className="text-xs font-semibold text-bankid-700 mb-2 uppercase tracking-wide">
                You will see this in your BankID app:
              </p>
              <p className="text-sm text-slate-700 font-semibold">Sign Document</p>
              <p className="text-xs text-slate-600 mt-1">
                <span className="font-medium">Document:</span> {document.filename}
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5 break-all">
                SHA-256: {document.hash.slice(0, 16)}...{document.hash.slice(-8)}
              </p>
              <p className="text-xs text-slate-600 mt-2 italic">
                "By approving, I confirm that I have read and accept the contents of this document."
              </p>
            </div>

            {/* Confirmation checkbox */}
            <label className="flex items-start gap-3 cursor-pointer mb-8 group">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-bankid-700 focus:ring-bankid-500"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900 transition leading-relaxed">
                I approve the submission of this document and confirm that I intend to sign it with my BankID.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('upload'); setDocument(null); setConfirmed(false); }}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
              >
                Change file
              </button>
              <button
                onClick={beginSigning}
                disabled={!confirmed}
                className={`flex-1 py-3 rounded-xl font-semibold transition ${
                  confirmed
                    ? 'bg-bankid-700 hover:bg-bankid-900 text-white active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Sign with BankID
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Signing (QR) ── */}
        {step === 'signing' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-bankid-900 to-bankid-700 px-6 py-5 flex items-center gap-4">
              <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">iD</span>
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">Sign with BankID</h2>
                <p className="text-bankid-100 text-xs mt-0.5">
                  Signing: {document?.filename}
                </p>
              </div>
            </div>

            <div className="p-8">
              <div className="flex items-center justify-center mb-6 min-h-[200px]">
                {signStatus === 'starting' && (
                  <div className="w-12 h-12 border-4 border-bankid-700 border-t-transparent rounded-full animate-spin" />
                )}
                {signStatus === 'pending' && qrData && (
                  <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-inner">
                    <QRCode value={qrData} size={180} />
                  </div>
                )}
                {signStatus === 'failed' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-red-500 text-sm text-center">
                      {HINTS[hintCode] || error || 'Signing failed'}
                    </p>
                  </div>
                )}
              </div>

              {signStatus === 'pending' && (
                <>
                  <p className="text-center text-sm text-slate-500 mb-5">
                    {HINTS[hintCode] || 'Waiting for BankID app...'}
                  </p>
                  <ol className="space-y-2.5 mb-6">
                    {[
                      'Open the BankID app on your phone',
                      'Tap "Scan QR code"',
                      'Read the document details and approve',
                    ].map((text, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                        <span className="flex-shrink-0 w-6 h-6 bg-bankid-50 text-bankid-700 rounded-full flex items-center justify-center font-semibold text-xs">
                          {i + 1}
                        </span>
                        {text}
                      </li>
                    ))}
                  </ol>
                </>
              )}

              <div className="flex flex-col gap-2">
                {signStatus === 'failed' && (
                  <button
                    onClick={beginSigning}
                    className="w-full bg-bankid-700 text-white font-semibold py-3 rounded-xl hover:bg-bankid-900 transition"
                  >
                    Try again
                  </button>
                )}
                <button
                  onClick={handleCancel}
                  className="w-full text-slate-400 hover:text-slate-600 font-medium py-2 text-sm transition"
                >
                  ← Cancel signing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Complete ── */}
        {step === 'complete' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">Document Signed!</h2>
            <p className="text-slate-500 text-sm mb-2">
              <span className="font-medium text-slate-700">{document?.filename}</span> has been
              successfully signed with BankID.
            </p>
            <p className="text-slate-400 text-xs mb-8">
              A signature certificate page has been added to your PDF.
            </p>

            <div className="flex flex-col gap-3">
              <a
                href={getDownloadUrl(signedDocId)}
                download
                className="w-full flex items-center justify-center gap-2 bg-bankid-700 hover:bg-bankid-900 text-white font-semibold py-3 rounded-xl transition active:scale-[0.98]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Signed PDF
              </a>
              <button
                onClick={() => { setStep('upload'); setDocument(null); setConfirmed(false); setSignedDocId(null); }}
                className="w-full py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition"
              >
                Sign another document
              </button>
              <button
                onClick={() => navigate('/home')}
                className="text-slate-400 hover:text-slate-600 text-sm font-medium transition"
              >
                Back to home
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Progress indicator at the top
function StepIndicator({ current }) {
  const steps = [
    { key: 'upload',   label: 'Upload' },
    { key: 'confirm',  label: 'Confirm' },
    { key: 'signing',  label: 'Sign' },
    { key: 'complete', label: 'Done' },
  ];
  const currentIndex = steps.findIndex(s => s.key === current);

  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center gap-2 flex-1">
          <div className={`flex items-center gap-2 ${i <= currentIndex ? 'text-bankid-700' : 'text-slate-300'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < currentIndex  ? 'bg-bankid-700 text-white' :
              i === currentIndex ? 'bg-bankid-700 text-white ring-4 ring-bankid-100' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span className="text-xs font-medium hidden sm:block">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 ${i < currentIndex ? 'bg-bankid-700' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
