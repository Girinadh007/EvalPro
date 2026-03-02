import { useState } from 'react';
import { ShieldCheck, Lock, User, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';

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
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="glass"
                style={{
                    maxWidth: '440px',
                    width: '100%',
                    padding: '3.5rem 3rem',
                    textAlign: 'center',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                <div style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                    width: '72px',
                    height: '72px',
                    borderRadius: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 2rem auto',
                    boxShadow: '0 15px 35px -5px rgba(99, 102, 241, 0.5)'
                }}>
                    <ShieldCheck size={36} color="white" />
                </div>

                <h2 style={{ marginBottom: '0.75rem', fontSize: '2.25rem', fontWeight: 900 }}>
                    Portal Access
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '1.1rem', lineHeight: 1.6 }}>
                    Select your access point to begin management or evaluations
                </p>

                <AnimatePresence mode="wait">
                    {!isHeadMode ? (
                        <motion.div
                            key="selection"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                        >
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '1.25rem' }}
                                onClick={() => onLogin('reviewer')}
                            >
                                <User size={22} />
                                <span style={{ fontSize: '1.1rem' }}>Reviewer Login</span>
                                <ArrowRight size={20} style={{ marginLeft: 'auto' }} />
                            </button>

                            <button
                                className="btn btn-outline"
                                style={{ width: '100%', padding: '1.25rem', border: '1px dashed rgba(255,255,255,0.2)' }}
                                onClick={() => setIsHeadMode(true)}
                            >
                                <Lock size={20} />
                                <span>Administrative Access</span>
                            </button>
                        </motion.div>
                    ) : (
                        <motion.form
                            key="login"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                            onSubmit={handleHeadLogin}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                        >
                            <div style={{ textAlign: 'left' }}>
                                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'block', fontWeight: 600 }}>
                                    Administrative Password
                                </label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1.25rem' }}>
                                Sign In as Head
                            </button>

                            <button
                                type="button"
                                className="btn btn-outline"
                                style={{ width: '100%', border: 'none', opacity: 0.7 }}
                                onClick={() => setIsHeadMode(false)}
                            >
                                Back to selection
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default Login;
