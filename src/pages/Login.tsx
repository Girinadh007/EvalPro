import { useState } from 'react';
import { ShieldCheck, Lock, User, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

interface LoginProps {
    onLogin: (role: 'head' | 'reviewer') => void;
}

const Login = ({ onLogin }: LoginProps) => {
    const [password, setPassword] = useState('');
    const [isHeadMode, setIsHeadMode] = useState(false);

    const handleHeadLogin = (e: any) => {
        e.preventDefault();
        const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
        if (password === adminPass) {
            toast.success('Welcome, Evaluation Head!');
            onLogin('head');
        } else {
            toast.error('Invalid administrative password');
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass"
                style={{
                    maxWidth: '400px',
                    width: '100%',
                    padding: '2.5rem',
                    textAlign: 'center'
                }}
            >
                <div style={{
                    background: 'var(--primary)',
                    width: '64px',
                    height: '64px',
                    borderRadius: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem auto',
                    boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)'
                }}>
                    <ShieldCheck size={32} color="white" />
                </div>

                <h2 style={{ marginBottom: '0.5rem', fontSize: '1.75rem' }}>EvalSystem Pro</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    Select your portal to continue with evaluations
                </p>

                {!isHeadMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '1rem' }}
                            onClick={() => onLogin('reviewer')}
                        >
                            <User size={20} />
                            Reviewer Portal
                            <ArrowRight size={18} style={{ marginLeft: 'auto' }} />
                        </button>

                        <button
                            className="btn btn-outline"
                            style={{ width: '100%', padding: '1rem' }}
                            onClick={() => setIsHeadMode(true)}
                        >
                            <Lock size={20} />
                            Admin Access
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleHeadLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ textAlign: 'left' }}>
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>
                                Admin Password
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                style={{ width: '100%' }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem' }}>
                            Sign In as Head
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline"
                            style={{ width: '100%', border: 'none' }}
                            onClick={() => setIsHeadMode(false)}
                        >
                            Back to selection
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
};

export default Login;
