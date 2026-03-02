import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import {
  Users,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
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

  const { scrollY } = useScroll();
  const [showHeader, setShowHeader] = useState(true);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    if (latest > previous && latest > 150) {
      setShowHeader(false);
    } else {
      setShowHeader(true);
    }
  });

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

      {/* Premium Header - Dynamic Visibility */}
      <motion.header
        className="glass main-header"
        initial={{ y: 0, opacity: 1 }}
        animate={{
          y: showHeader ? 0 : -100,
          opacity: showHeader ? 1 : 0
        }}
        transition={{ duration: 0.4, ease: "circOut" }}
        style={{
          pointerEvents: showHeader ? 'auto' : 'none'
        }}
      >
        <div className="header-brand">
          <div className="brand-icon">
            <ShieldCheck size={24} color="white" />
          </div>
          <h1 className="brand-text">
            Eval<span>System</span> <span className="secondary-text">Pro</span>
          </h1>
        </div>

        <div className="header-actions">
          <div className="badge role-badge">
            <Users size={14} />
            <span>{userRole === 'head' ? 'Admin' : 'Reviewer'}</span>
          </div>
          <button
            className="btn btn-outline logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            <span className="btn-text">Sign Out</span>
          </button>
        </div>
      </motion.header>

      <main className="container animate-fade" style={{ paddingTop: '10rem' }}>
        {userRole === 'head' ? (
          <AdminDashboard />
        ) : (
          <ReviewerDashboard />
        )}
      </main>

      <footer style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        marginTop: '6rem',
        background: 'rgba(255,255,255,0.01)'
      }}>
        <div style={{ marginBottom: '1rem', fontWeight: 800, letterSpacing: '0.05em' }}>EVALPRO &copy; 2026</div>
        <div style={{ opacity: 0.4 }}>Performance Excellence & Intelligent Evaluation</div>
      </footer>
    </div>
  );
}

export default App;
