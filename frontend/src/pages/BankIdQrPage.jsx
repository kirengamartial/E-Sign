import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useAuth } from '../context/AuthContext';
import { startAuth, getQrData, collectAuth, cancelAuth } from '../services/bankidApi';

// Maps BankID hint codes to human-readable messages shown below the QR
const HINT_MESSAGES = {
  outstandingTransaction: 'Open the BankID app and scan the code',
  noClient:              'Open the BankID app on your phone',
  userSign:              'Confirm the sign-in in your BankID app',
  started:               'Starting BankID...',
  expiredTransaction:    'The request expired. Please try again.',
  certificateErr:        'Certificate error. Please try again.',
  userCancel:            'You cancelled the sign-in.',
  cancelled:             'The request was cancelled.',
  startFailed:           'Could not start BankID. Try again.',
};

export default function BankIdQrPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [qrData, setQrData]   = useState('');
  const [status, setStatus]   = useState('starting'); // starting | pending | complete | failed
  const [hintCode, setHintCode] = useState('');
  const [error, setError]     = useState('');

  const orderRefRef        = useRef(null);
  const qrIntervalRef      = useRef(null);
  const collectIntervalRef = useRef(null);
  const doneRef            = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    initAuth();
    return cleanup;
  }, []);

  async function initAuth() {
    try {
      const { orderRef } = await startAuth();
      if (doneRef.current) return; // component unmounted while awaiting
      orderRefRef.current = orderRef;
      setStatus('pending');

      // Refresh QR code every second (BankID requires this — the code is time-based)
      qrIntervalRef.current = setInterval(async () => {
        if (doneRef.current) return;
        try {
          const { qrData } = await getQrData(orderRef);
          if (doneRef.current) return;
          setQrData(qrData);
        } catch { /* silently ignore mid-flight errors */ }
      }, 1000);

      // Poll for result every 2 seconds (BankID enforces max once per 2s)
      collectIntervalRef.current = setInterval(async () => {
        if (doneRef.current) return;
        try {
          const result = await collectAuth(orderRef);
          if (doneRef.current) return;

          if (result.status === 'complete') {
            cleanup();
            setStatus('complete');
            setUser(result.user);
            setTimeout(() => navigate('/home'), 1200);
          } else if (result.status === 'failed') {
            cleanup();
            setStatus('failed');
            setHintCode(result.hintCode);
          } else {
            setHintCode(result.hintCode);
          }
        } catch { /* silently ignore */ }
      }, 2000);

    } catch (err) {
      if (doneRef.current) return;
      setStatus('failed');
      setError(err.message);
    }
  }

  function cleanup() {
    doneRef.current = true;
    clearInterval(qrIntervalRef.current);
    clearInterval(collectIntervalRef.current);
    qrIntervalRef.current = null;
    collectIntervalRef.current = null;
  }

  async function handleCancel() {
    cleanup();
    if (orderRefRef.current) await cancelAuth(orderRefRef.current);
    navigate('/');
  }

  async function handleRetry() {
    cleanup();
    setStatus('starting');
    setQrData('');
    setHintCode('');
    setError('');
    initAuth();
  }

  const hint = HINT_MESSAGES[hintCode] || 'Waiting for BankID app...';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Top bar */}
          <div className="bg-gradient-to-r from-bankid-900 to-bankid-700 px-6 py-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center">
              <BankIdLogo />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg leading-tight">Sign in with BankID</h1>
              <p className="text-bankid-100 text-xs mt-0.5">Swedish digital identification</p>
            </div>
          </div>

          <div className="p-8">
            {/* QR / Status area */}
            <div className="flex items-center justify-center mb-6 min-h-[220px]">

              {/* Loading */}
              {status === 'starting' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-bankid-700 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm">Starting BankID...</p>
                </div>
              )}

              {/* Live QR code */}
              {status === 'pending' && qrData && (
                <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-inner">
                  <QRCode value={qrData} size={180} />
                </div>
              )}

              {/* Success */}
              {status === 'complete' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-green-600 font-semibold">Authenticated!</p>
                  <p className="text-slate-400 text-xs">Redirecting...</p>
                </div>
              )}

              {/* Failed */}
              {status === 'failed' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </div>
                  <p className="text-red-500 font-medium text-sm text-center">
                    {HINT_MESSAGES[hintCode] || error || 'Something went wrong'}
                  </p>
                </div>
              )}
            </div>

            {/* Hint text */}
            {status === 'pending' && (
              <p className="text-center text-sm text-slate-500 mb-6">{hint}</p>
            )}

            {/* Step instructions */}
            {status === 'pending' && (
              <ol className="space-y-2.5 mb-6">
                {[
                  'Open the BankID app on your phone',
                  'Tap "Scan QR code"',
                  'Point your camera at the code above',
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="flex-shrink-0 w-6 h-6 bg-bankid-50 text-bankid-700 rounded-full flex items-center justify-center font-semibold text-xs">
                      {i + 1}
                    </span>
                    {text}
                  </li>
                ))}
              </ol>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {status === 'failed' && (
                <button
                  onClick={handleRetry}
                  className="w-full bg-bankid-700 hover:bg-bankid-900 text-white font-semibold py-3 rounded-xl transition active:scale-[0.98]"
                >
                  Try again
                </button>
              )}
              <button
                onClick={handleCancel}
                className="w-full text-slate-400 hover:text-slate-600 font-medium py-2 text-sm transition"
              >
                ← Back to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BankIdLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="white" fillOpacity="0.15" />
      <text x="14" y="19" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">iD</text>
    </svg>
  );
}
