import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import {
  Users,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ReviewerDashboard from './pages/ReviewerDashboard';
import './App.css';

function App() {
  const [userRole, setUserRole] = useState<'head' | 'reviewer' | 'none'>('none');

  // Simple session check (localStorage for persistence of role for demo)
  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole === 'head' || savedRole === 'reviewer') {
      setUserRole(savedRole);
    }
  }, []);

  const handleLogin = (role: 'head' | 'reviewer') => {
    setUserRole(role);
    localStorage.setItem('user_role', role);
  };

  const handleLogout = () => {
    setUserRole('none');
    localStorage.removeItem('user_role');
  };

  const AnimatedBackground = () => (
    <div className="bg-blobs">
      <div className="blob"></div>
      <div className="blob"></div>
      <div className="blob"></div>
    </div>
  );

  if (userRole === 'none') {
    return (
      <div className="app-container">
        <AnimatedBackground />
        <Toaster position="top-right" />
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <AnimatedBackground />
      <Toaster position="top-right" />

      {/* Premium Header */}
      <header className="glass" style={{
        margin: '1.5rem',
        padding: '1.25rem 2.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: '1.5rem',
        zIndex: 100,
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            padding: '0.65rem',
            borderRadius: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px -5px var(--primary-glow)'
          }}>
            <ShieldCheck size={28} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', margin: 0, letterSpacing: '-0.05em' }}>
              Eval<span style={{ color: 'var(--primary)' }}>System</span> <span style={{ color: 'var(--secondary)' }}>Pro</span>
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div className="badge" style={{
            background: 'rgba(99, 102, 241, 0.1)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.5rem 1.25rem',
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}>
            <Users size={16} />
            <span style={{ fontWeight: 800 }}>{userRole === 'head' ? 'Administration' : 'Reviewer'}</span>
          </div>
          <button
            className="btn btn-outline"
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.9rem',
              borderRadius: '0.85rem'
            }}
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="container animate-fade">
        {userRole === 'head' ? (
          <AdminDashboard />
        ) : (
          <ReviewerDashboard />
        )}
      </main>

      <footer style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.9rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        marginTop: '4rem'
      }}>
        <div style={{ marginBottom: '1rem', fontWeight: 700 }}>EvalSystem Pro &copy; 2026</div>
        <div style={{ opacity: 0.5 }}>Advanced Event Management & Team Evaluation Platform</div>
      </footer>
    </div>
  );
}

export default App;
