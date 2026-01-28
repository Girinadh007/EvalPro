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

  if (userRole === 'none') {
    return (
      <div className="app-container">
        <Toaster position="top-right" />
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Toaster position="top-right" />

      {/* Premium Header */}
      <header className="glass" style={{
        margin: '1rem',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: '1rem',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'var(--primary)',
            padding: '0.5rem',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '1.25rem' }}>EvalSystem <span style={{ color: 'var(--primary)', opacity: 0.8 }}>Pro</span></h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={14} />
            {userRole === 'head' ? 'Administration' : 'Reviewer'}
          </div>
          <button
            className="btn btn-outline"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Sign Out
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

      <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        &copy; 2026 EvalSystem Pro. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
