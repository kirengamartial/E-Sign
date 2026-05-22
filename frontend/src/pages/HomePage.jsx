import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


export default function HomePage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    setUser(null);
    navigate('/');
  }

  const initials = user
    ? `${user.givenName?.[0] || ''}${user.surname?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-bankid-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-semibold text-slate-900 text-lg tracking-tight">E-Sign</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-bankid-50 rounded-full flex items-center justify-center border-2 border-bankid-100">
                <span className="text-bankid-700 font-semibold text-sm">{initials}</span>
              </div>
              <span className="text-slate-700 font-medium text-sm hidden sm:block">{user?.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-800 font-medium px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-12">

        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">
            Welcome back, {user?.givenName} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Signed in as{' '}
            <span className="font-medium text-slate-700">{user?.personalNumber}</span>{' '}
            via BankID
          </p>
        </div>

        {/* Identity card */}
        <div className="bg-gradient-to-br from-bankid-900 via-bankid-700 to-bankid-500 rounded-2xl p-7 text-white mb-8 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-bankid-100 text-xs font-semibold uppercase tracking-widest mb-2">
                Verified Identity
              </p>
              <h2 className="text-2xl font-bold">{user?.name}</h2>
              <p className="text-bankid-100 mt-1 text-sm font-mono">{user?.personalNumber}</p>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-bankid-100 text-xs">Authenticated via BankID · {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            color="blue"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
            title="Documents"
            description="View and manage all your documents"
          />
          <FeatureCard
            color="green"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />}
            title="Sign"
            description="Sign documents securely with BankID"
            onClick={() => navigate('/sign')}
          />
          <FeatureCard
            color="purple"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}
            title="History"
            description="Review your past signing activity"
          />
        </div>
      </main>
    </div>
  );
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-500' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-500' },
};

function FeatureCard({ color, icon, title, description, onClick }) {
  const { bg, icon: iconColor } = colorMap[color];
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}>
      <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
        <svg className={`w-5 h-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icon}
        </svg>
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-slate-500 text-sm">{description}</p>
    </div>
  );
}
