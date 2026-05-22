import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel (brand) ── */}
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-bankid-900 via-bankid-700 to-bankid-500 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow">
            <span className="text-bankid-700 font-bold text-lg">E</span>
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">E-Sign</span>
        </div>

        <div>
          <h2 className="text-white text-4xl font-bold leading-snug mb-4">
            Secure document signing,<br />powered by BankID.
          </h2>
          <p className="text-bankid-100 text-base leading-relaxed">
            Sign and verify documents with the same trusted identity used by Swedish banks and government services.
          </p>
        </div>

        <p className="text-bankid-100 text-sm">© 2025 E-Sign. All rights reserved.</p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-bankid-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-bankid-700 font-semibold text-xl">E-Sign</span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-1">Welcome back</h1>
          <p className="text-slate-500 mb-8">Sign in to your account to continue</p>

          {/* Email / Password */}
          <form className="space-y-4 mb-6" onSubmit={e => e.preventDefault()}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bankid-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-bankid-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                <input type="checkbox" className="rounded border-slate-300 text-bankid-700 focus:ring-bankid-500" />
                Remember me
              </label>
              <button type="button" className="text-bankid-500 hover:text-bankid-700 font-medium transition">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-bankid-700 hover:bg-bankid-900 active:scale-[0.98] text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-sm"
            >
              Sign in
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-50 text-slate-400">or continue with</span>
            </div>
          </div>

          {/* Provider buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/bankid')}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-bankid-700 text-bankid-700 font-semibold py-3 rounded-xl hover:bg-bankid-50 active:scale-[0.98] transition-all duration-200 shadow-sm"
            >
              <BankIdIcon />
              Sign in with BankID
            </button>

            <button
              disabled
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-400 font-medium py-3 rounded-xl cursor-not-allowed select-none"
            >
              <GoogleIcon />
              Sign in with Google
              <span className="ml-auto text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">Soon</span>
            </button>
          </div>

          <p className="text-center text-sm text-slate-500 mt-8">
            Don't have an account?{' '}
            <button className="text-bankid-500 hover:text-bankid-700 font-medium transition">
              Create account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function BankIdIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect width="22" height="22" rx="6" fill="#193B6E" />
      <text x="11" y="15.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">iD</text>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
