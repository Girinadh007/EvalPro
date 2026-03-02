import { useState, useEffect } from 'react';
import {
    Search,
    Clock,
    ArrowRight,
    ArrowLeft,
    User,
    Sparkles,
    CheckCircle,
    Info,
    ChevronRight,
    ChevronLeft,
    BarChart,
    MessageSquare,
    RotateCcw,
    Trophy,
    Users
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

const ReviewerDashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [teams, setTeams] = useState<any[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<any>(null);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [step, setStep] = useState<'identity' | 'team' | 'session' | 'attendance' | 'review'>('identity');

    const [attendance, setAttendance] = useState<Record<string, boolean>>({});
    const [marks, setMarks] = useState<Record<string, number>>({});
    const [remarks, setRemarks] = useState('');
    const [reviewerName, setReviewerName] = useState(() => localStorage.getItem('eval_reviewer_name') || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completedSessions, setCompletedSessions] = useState<string[]>([]);

    // Review Wizard State
    const [activeCriterionIndex, setActiveCriterionIndex] = useState(0);
    const [isFinalSummary, setIsFinalSummary] = useState(false);

    useEffect(() => {
        fetchEvents();

        // Re-fetch when the tab becomes active to catch any admin changes
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchEvents();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (step === 'review') {
                if (e.key === 'ArrowRight' || (e.key === 'Enter' && !isFinalSummary)) {
                    if (activeCriterionIndex < (selectedSession?.criteria.length || 0) - 1) {
                        setActiveCriterionIndex(p => p + 1);
                    } else if (!isFinalSummary) {
                        setIsFinalSummary(true);
                    }
                } else if (e.key === 'ArrowLeft') {
                    if (isFinalSummary) {
                        setIsFinalSummary(false);
                    } else if (activeCriterionIndex > 0) {
                        setActiveCriterionIndex(p => p - 1);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step, activeCriterionIndex, isFinalSummary, selectedSession]);

    useEffect(() => {
        if (searchTerm.length >= 2) {
            searchTeams();
        } else {
            setTeams([]);
        }
    }, [searchTerm]);

    useEffect(() => {
        if (selectedTeam && selectedEvent) {
            fetchSessionsAndStatus();
        }
    }, [selectedTeam, selectedEvent]);

    const fetchEvents = async () => {
        const { data } = await supabase.from('evaluation_events').select('*').order('created_at', { ascending: false });
        if (data) {
            if (data.length > 0) {
                if (!selectedEvent || !data.find(e => e.id === selectedEvent.id)) {
                    setSelectedEvent(data[0]);
                }
            } else {
                setSelectedEvent(null);
            }
        }
    };

    const searchTeams = async () => {
        const { data: teamsByName } = await supabase
            .from('teams')
            .select('*, students(*)')
            .ilike('name', `%${searchTerm}%`)
            .limit(5);

        const { data: studentsByName } = await supabase
            .from('students')
            .select('*, teams(*, students(*))')
            .ilike('name', `%${searchTerm}%`)
            .limit(5);

        const combined: any[] = [...(teamsByName || [])];
        const teamIdsResult = new Set(combined.map(t => t.id));

        studentsByName?.forEach((s: any) => {
            if (s.teams && !teamIdsResult.has(s.teams.id)) {
                combined.push(s.teams);
                teamIdsResult.add(s.teams.id);
            }
        });

        setTeams(combined);
    };

    const fetchSessionsAndStatus = async () => {
        const { data: sessData } = await supabase
            .from('review_sessions')
            .select('*')
            .eq('event_id', selectedEvent.id)
            .order('session_number', { ascending: true });

        if (sessData) {
            setSessions(sessData);
            const { data: revData } = await supabase
                .from('reviews')
                .select('session_id')
                .eq('team_id', selectedTeam.id);

            if (revData) {
                setCompletedSessions(revData.map(r => r.session_id));
            }
        }
    };

    const handleTeamSelect = (team: any) => {
        if (!selectedEvent) return toast.error('Please select an event first');
        setSelectedTeam(team);
        const initialAttendance: Record<string, boolean> = {};
        if (team.students) {
            team.students.forEach((s: any) => {
                initialAttendance[s.student_id] = true;
            });
        }
        setAttendance(initialAttendance);
        setStep('session');
    };

    const handleSessionSelect = (session: any) => {
        if (completedSessions.includes(session.id)) {
            toast.error('This session review has already been submitted for this team!');
            return;
        }
        setSelectedSession(session);
        const initialMarks: Record<string, number> = {};
        session.criteria.forEach((c: any) => {
            initialMarks[c.id] = 0;
        });
        setMarks(initialMarks);
        setActiveCriterionIndex(0);
        setIsFinalSummary(false);
        setStep('attendance');
    };

    const handleSubmitReview = async () => {
        if (!reviewerName.trim()) {
            toast.error('Please set your identity first');
            setStep('identity');
            return;
        }
        setIsSubmitting(true);
        try {
            const { data: existing } = await supabase
                .from('reviews')
                .select('id')
                .eq('team_id', selectedTeam.id)
                .eq('session_id', selectedSession.id)
                .maybeSingle();

            if (existing) {
                toast.error('Another reviewer just submitted this session for this team!');
                setIsSubmitting(false);
                setStep('session');
                fetchSessionsAndStatus();
                return;
            }

            const { error } = await supabase.from('reviews').insert([{
                team_id: selectedTeam.id,
                session_id: selectedSession.id,
                attendance,
                marks,
                remarks,
                reviewer_id: reviewerName
            }]);

            if (error) throw error;

            toast.custom(() => (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="glass"
                    style={{
                        padding: '2.5rem 4rem',
                        background: 'linear-gradient(135deg, var(--accent) 0%, var(--secondary) 100%)',
                        color: 'white',
                        borderRadius: '2.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1.5rem',
                        boxShadow: '0 40px 80px -20px var(--accent-glow)',
                        zIndex: 9999,
                        border: '2px solid rgba(255,255,255,0.2)'
                    }}
                >
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 10, -10, 0]
                        }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                    >
                        <Trophy size={64} fill="rgba(255,255,255,0.2)" />
                    </motion.div>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.03em' }}>Excellent!</h3>
                        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '1.1rem' }}>Review for <strong>{selectedTeam?.name}</strong> submitted by {reviewerName}.</p>
                    </div>
                </motion.div>
            ), { duration: 4000 });

            setStep('team');
            setSelectedTeam(null);
            setSelectedSession(null);
            setRemarks('');
            setSearchTerm('');
            setIsFinalSummary(false);
            setActiveCriterionIndex(0);
        } catch (err: any) {
            toast.error('Submission failed: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: step === 'review' ? '1200px' : '900px', margin: '0 auto', paddingBottom: '5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <button
                    onClick={() => setStep(reviewerName ? 'team' : 'identity')}
                    style={{
                        padding: '1rem',
                        background: 'none',
                        color: 'var(--primary)',
                        borderBottom: step !== 'identity' ? '2px solid var(--primary)' : 'none',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <BarChart size={18} /> Evaluation Portal
                </button>

                {reviewerName && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0 1rem' }}>
                        <div className="badge" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <User size={14} style={{ marginRight: '0.5rem' }} /> {reviewerName}
                        </div>
                        <button
                            onClick={() => { setStep('identity'); }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}
                        >
                            Change Identity
                        </button>
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {step === 'identity' && (
                    <motion.div
                        key="identity-setup"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="glass" style={{ padding: '5rem 3rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                            <motion.div
                                initial={{ scale: 0.5, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '2.5rem',
                                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 2.5rem',
                                    boxShadow: '0 25px 50px -12px var(--primary-glow)'
                                }}
                            >
                                <User size={48} color="white" />
                            </motion.div>
                            <h1 style={{ marginBottom: '1rem', fontSize: '3rem', letterSpacing: '-0.04em' }}>Welcome back.</h1>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '3.5rem', fontSize: '1.2rem', lineHeight: 1.6 }}>Please enter your name to access the evaluation tools.</p>

                            <div style={{ textAlign: 'left', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Type your name here..."
                                        value={reviewerName}
                                        onChange={(e) => setReviewerName(e.target.value)}
                                        className="glass"
                                        style={{
                                            width: '100%',
                                            padding: '1.5rem',
                                            fontSize: '1.25rem',
                                            textAlign: 'center',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '1.5rem'
                                        }}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    className="btn btn-primary"
                                    disabled={!reviewerName.trim()}
                                    style={{ width: '100%', padding: '1.25rem', justifyContent: 'center', fontSize: '1.2rem', borderRadius: '1.5rem' }}
                                    onClick={() => {
                                        localStorage.setItem('eval_reviewer_name', reviewerName);
                                        setStep('team');
                                    }}
                                >
                                    Access Portal <ArrowRight size={22} style={{ marginLeft: '0.75rem' }} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 'team' && (
                    <motion.div
                        key="team-selection"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
                            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', letterSpacing: '-0.03em' }}>Find a Team</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Search by team name or student ID to begin evaluation.</p>
                        </div>

                        <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto 4rem' }}>
                            <div style={{ position: 'absolute', left: '1.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.6 }}>
                                <Search size={24} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search teams or students..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="glass search-input"
                                style={{
                                    width: '100%',
                                    padding: '1.5rem 1.5rem 1.5rem 4rem',
                                    fontSize: '1.25rem',
                                    borderRadius: '2rem',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                            <AnimatePresence mode="popLayout">
                                {teams.map((team, idx) => (
                                    <motion.div
                                        key={team.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <button
                                            onClick={() => handleTeamSelect(team)}
                                            className="glass team-card-premium"
                                            style={{
                                                width: '100%',
                                                padding: '2rem',
                                                textAlign: 'left',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '1.5rem',
                                                cursor: 'pointer',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                height: '100%'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '1rem', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                                    <Users size={24} />
                                                </div>
                                                <ArrowRight className="card-arrow" size={20} />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{team.name}</h3>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    {team.students?.map((s: any) => (
                                                        <span key={s.id} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                                            {s.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {searchTerm.length >= 2 && teams.length === 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                <Sparkles size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                                <p>No teams found matching your search.</p>
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {step === 'session' && (
                    <motion.div
                        key="session-selection"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                    >
                        <div className="glass" style={{ padding: '3.5rem', maxWidth: '700px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '3rem' }}>
                                <button onClick={() => setStep('team')} className="btn-icon" style={{ padding: '0.75rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <ArrowLeft size={20} />
                                </button>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '2rem' }}>Select Session</h2>
                                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)' }}>{selectedTeam?.name}</p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                {sessions.map((session, idx) => (
                                    <motion.button
                                        key={session.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        onClick={() => handleSessionSelect(session)}
                                        className="glass session-btn"
                                        disabled={completedSessions.includes(session.id)}
                                        style={{
                                            padding: '2rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            opacity: completedSessions.includes(session.id) ? 0.4 : 1,
                                            cursor: completedSessions.includes(session.id) ? 'not-allowed' : 'pointer',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div style={{
                                            width: '56px',
                                            height: '56px',
                                            borderRadius: '50%',
                                            background: completedSessions.includes(session.id) ? 'var(--accent)' : 'rgba(99, 102, 241, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: completedSessions.includes(session.id) ? 'white' : 'var(--primary)',
                                            marginBottom: '0.5rem'
                                        }}>
                                            {completedSessions.includes(session.id) ? <CheckCircle size={28} /> : <Clock size={28} />}
                                        </div>
                                        <span style={{ fontWeight: 800, fontSize: '1.25rem' }}>Session {session.session_number}</span>
                                        {completedSessions.includes(session.id) && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase' }}>Completed</div>
                                        )}
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 'attendance' && (
                    <motion.div
                        key="attendance"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <div className="glass" style={{ padding: '3.5rem', maxWidth: '700px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '2rem' }}>Attendance</h2>
                                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)' }}>{selectedTeam?.name} - S{selectedSession?.session_number}</p>
                                </div>
                                <button
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem', borderRadius: '1rem' }}
                                    onClick={() => {
                                        const allPresent: Record<string, boolean> = {};
                                        selectedTeam?.students?.forEach((s: any) => {
                                            allPresent[s.student_id] = true;
                                        });
                                        setAttendance(allPresent);
                                        toast.success('Everyone marked present');
                                    }}
                                >
                                    Select All
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
                                {selectedTeam?.students?.map((student: any) => (
                                    <div key={student.id} className="glass" style={{
                                        padding: '1.25rem 2rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: attendance[student.student_id] ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)',
                                        border: attendance[student.student_id] ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid rgba(239, 68, 68, 0.1)',
                                        borderRadius: '1.5rem'
                                    }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{student.name}</div>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button
                                                onClick={() => setAttendance(prev => ({ ...prev, [student.student_id]: true }))}
                                                className={`btn ${attendance[student.student_id] ? 'btn-primary' : 'btn-outline'}`}
                                                style={{
                                                    padding: '0.6rem 1.2rem',
                                                    fontSize: '0.85rem',
                                                    background: attendance[student.student_id] ? 'var(--accent)' : 'transparent',
                                                    borderColor: attendance[student.student_id] ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                                                    borderRadius: '1rem'
                                                }}
                                            >
                                                Present
                                            </button>
                                            <button
                                                onClick={() => setAttendance(prev => ({ ...prev, [student.student_id]: false }))}
                                                className={`btn ${!attendance[student.student_id] ? 'btn-primary' : 'btn-outline'}`}
                                                style={{
                                                    padding: '0.6rem 1.2rem',
                                                    fontSize: '0.85rem',
                                                    background: !attendance[student.student_id] ? 'var(--error)' : 'transparent',
                                                    borderColor: !attendance[student.student_id] ? 'var(--error)' : 'rgba(255,255,255,0.1)',
                                                    borderRadius: '1rem'
                                                }}
                                            >
                                                Absent
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button className="btn btn-outline" style={{ padding: '0.8rem 1.5rem' }} onClick={() => setStep('session')}>Back</button>
                                <button className="btn btn-primary" style={{ padding: '1rem 2.5rem' }} onClick={() => setStep('review')}>Start Marking</button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 'review' && (
                    <motion.div
                        key="review-wizard"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="review-container"
                        style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1000px', margin: '0 auto' }}
                    >
                        {/* 📅 ITEM 9: Session Context Card - Sticky Top */}
                        <motion.div
                            initial={{ y: -20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="glass"
                            style={{
                                padding: '1.5rem 2rem',
                                position: 'sticky',
                                top: '100px',
                                zIndex: 50,
                                background: 'rgba(15, 23, 42, 0.9)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                boxShadow: '0 15px 30px -10px rgba(0,0,0,0.4)',
                                backdropFilter: 'blur(20px)',
                                borderRadius: '1.5rem'
                            }}
                        >
                            <div style={{ display: 'flex', gap: '2.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Team</p>
                                        <h3 style={{ margin: 0, fontSize: '1rem' }}>{selectedTeam?.name}</h3>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary)' }}>
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Session</p>
                                        <h3 style={{ margin: 0, fontSize: '1rem' }}>S{selectedSession?.session_number}</h3>
                                    </div>
                                </div>
                                {selectedTeam?.ps && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '300px' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                            <Info size={20} />
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Problem Statement</p>
                                            <h3 style={{ margin: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedTeam.ps}</h3>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 🚦 ITEM 2: Section Progress Navigation */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                {selectedSession?.criteria.map((_: any, idx: number) => (
                                    <div
                                        key={idx}
                                        style={{
                                            width: '30px',
                                            height: '4px',
                                            borderRadius: '2px',
                                            background: idx === activeCriterionIndex && !isFinalSummary ? 'var(--primary)' : idx < activeCriterionIndex ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                ))}
                                <div style={{
                                    width: '30px',
                                    height: '4px',
                                    borderRadius: '2px',
                                    background: isFinalSummary ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                    marginLeft: '0.25rem'
                                }} />
                            </div>
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {!isFinalSummary ? (
                                <motion.div
                                    key={`criterion-${activeCriterionIndex}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="glass"
                                    style={{ padding: '4rem', borderRadius: '2.5rem' }}
                                >
                                    {/* 🧩 ITEM 3: Criteria Driven Cards */}
                                    <div style={{ marginBottom: '3rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                                            <div style={{
                                                fontSize: '0.85rem',
                                                fontWeight: 800,
                                                color: 'var(--primary)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.1em',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                padding: '0.4rem 1rem',
                                                borderRadius: '2rem'
                                            }}>
                                                Criterion {activeCriterionIndex + 1} of {selectedSession?.criteria.length}
                                            </div>
                                            <div style={{ fontSize: '3rem', fontWeight: 900, opacity: 0.05 }}>
                                                {String(activeCriterionIndex + 1).padStart(2, '0')}
                                            </div>
                                        </div>
                                        <h2 style={{ fontSize: '3rem', marginBottom: '1rem', letterSpacing: '-0.04em' }}>
                                            {selectedSession?.criteria[activeCriterionIndex].label}
                                        </h2>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1.6 }}>
                                            Rate the performance for this category. The maximum score allowed is **{selectedSession?.criteria[activeCriterionIndex].maxMarks}**.
                                        </p>
                                    </div>

                                    {/* Rating Interactive Control */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '3rem',
                                        background: 'rgba(255,255,255,0.01)',
                                        padding: '4rem',
                                        borderRadius: '2.5rem',
                                        border: '1px solid rgba(255,255,255,0.03)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {Array.from({ length: selectedSession?.criteria[activeCriterionIndex].maxMarks + 1 }).map((_, i) => (
                                                <motion.button
                                                    key={i}
                                                    whileHover={{ scale: 1.1, y: -5 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setMarks(prev => ({ ...prev, [selectedSession?.criteria[activeCriterionIndex].id]: i }))}
                                                    style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        borderRadius: '1.5rem',
                                                        border: '2px solid',
                                                        borderColor: marks[selectedSession?.criteria[activeCriterionIndex].id] === i ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                                        background: marks[selectedSession?.criteria[activeCriterionIndex].id] === i ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.02)',
                                                        color: marks[selectedSession?.criteria[activeCriterionIndex].id] === i ? 'var(--primary)' : 'rgba(255,255,255,0.4)',
                                                        fontSize: '1.4rem',
                                                        fontWeight: 900,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                                    }}
                                                >
                                                    {i}
                                                </motion.button>
                                            ))}
                                        </div>

                                        {/* ❗ ITEM 6: Smart Inline Validation */}
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                                                Score: <motion.span key={marks[selectedSession?.criteria[activeCriterionIndex].id]} initial={{ scale: 1.5, color: 'var(--primary)' }} animate={{ scale: 1, color: 'var(--primary)' }} style={{ fontWeight: 900, fontSize: '2rem' }}>{marks[selectedSession?.criteria[activeCriterionIndex].id] || 0}</motion.span> <span style={{ opacity: 0.3 }}>/ {selectedSession?.criteria[activeCriterionIndex].maxMarks}</span>
                                            </div>
                                            <div style={{ height: '6px', width: '100%', maxWidth: '400px', margin: '0 auto', background: 'rgba(255,255,255,0.03)', borderRadius: '3px', overflow: 'hidden' }}>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${((marks[selectedSession?.criteria[activeCriterionIndex].id] || 0) / selectedSession?.criteria[activeCriterionIndex].maxMarks) * 100}%` }}
                                                    style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4rem' }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '1.25rem 2.5rem', borderRadius: '1.5rem' }}
                                            onClick={() => {
                                                if (activeCriterionIndex > 0) {
                                                    setActiveCriterionIndex(activeCriterionIndex - 1);
                                                } else {
                                                    setStep('attendance');
                                                }
                                            }}
                                        >
                                            <ChevronLeft size={20} /> Previous
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '1.25rem 4rem', fontSize: '1.2rem', borderRadius: '1.5rem', boxShadow: '0 20px 40px -10px var(--primary-glow)' }}
                                            onClick={() => {
                                                if (activeCriterionIndex < selectedSession?.criteria.length - 1) {
                                                    setActiveCriterionIndex(activeCriterionIndex + 1);
                                                } else {
                                                    setIsFinalSummary(true);
                                                }
                                            }}
                                        >
                                            {activeCriterionIndex === selectedSession?.criteria.length - 1 ? 'Review Summary' : 'Next Criterion'} <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="final-summary"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="glass"
                                    style={{ padding: '4rem', borderRadius: '2.5rem' }}
                                >
                                    {/* 📊 ITEM 7: Interactive Final Review Page */}
                                    <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                                        <h2 style={{ fontSize: '3.5rem', marginBottom: '1rem', letterSpacing: '-0.04em' }}>Final Review</h2>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '1.3rem' }}>Please double check the scores before submitting.</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '4rem' }}>
                                        {selectedSession?.criteria.map((criterion: any) => (
                                            <motion.div
                                                key={criterion.id}
                                                whileHover={{ y: -5 }}
                                                className="glass"
                                                style={{ padding: '2rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '1.5rem' }}
                                            >
                                                <h4 style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>{criterion.label}</h4>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                    <span style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--primary)' }}>{marks[criterion.id] || 0}</span>
                                                    <span style={{ fontSize: '1.4rem', opacity: 0.2 }}>max {criterion.maxMarks}</span>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setActiveCriterionIndex(selectedSession.criteria.indexOf(criterion));
                                                        setIsFinalSummary(false);
                                                    }}
                                                    style={{
                                                        background: 'rgba(99, 102, 241, 0.05)',
                                                        border: 'none',
                                                        color: 'var(--primary)',
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        marginTop: '2rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        padding: '0.6rem 1rem',
                                                        borderRadius: '0.75rem',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    <RotateCcw size={14} /> Change Score
                                                </button>
                                            </motion.div>
                                        ))}
                                    </div>

                                    <div style={{ marginBottom: '4rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
                                            <MessageSquare size={24} color="var(--primary)" /> Overall Feedback (Optional)
                                        </label>
                                        <textarea
                                            rows={5}
                                            placeholder="Write constructive feedback for the team..."
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                            className="glass"
                                            style={{
                                                width: '100%',
                                                padding: '2rem',
                                                fontSize: '1.2rem',
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                borderRadius: '2rem',
                                                lineHeight: 1.6
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '1.5rem 3rem', borderRadius: '1.5rem' }}
                                            onClick={() => setIsFinalSummary(false)}
                                        >
                                            <ArrowLeft size={20} /> Back to Evaluation
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            style={{
                                                padding: '1.75rem 5rem',
                                                fontSize: '1.4rem',
                                                borderRadius: '2rem',
                                                background: 'linear-gradient(135deg, var(--accent) 0%, var(--secondary) 100%)',
                                                boxShadow: '0 25px 50px -15px var(--accent-glow)',
                                                fontWeight: 800
                                            }}
                                            onClick={handleSubmitReview}
                                            disabled={isSubmitting}
                                        >
                                            {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* 🧠 ITEM 8: Review Enhancer Toolbar (Floating) */}
                        <div style={{
                            position: 'fixed',
                            bottom: '3rem',
                            right: '3rem',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}>
                            <motion.button
                                initial={{ x: 100 }}
                                animate={{ x: 0 }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="glass"
                                title="Reset Evaluation"
                                onClick={() => {
                                    if (window.confirm("Are you sure you want to reset all marks for this session?")) {
                                        const resetMarks: Record<string, number> = {};
                                        selectedSession.criteria.forEach((c: any) => resetMarks[c.id] = 0);
                                        setMarks(resetMarks);
                                        setRemarks('');
                                        toast.success("Marks reset to zero");
                                    }
                                }}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    color: '#f87171',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <RotateCcw size={24} />
                            </motion.button>
                            <motion.button
                                initial={{ x: 100 }}
                                animate={{ x: 0 }}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="glass"
                                title="Evaluation Guide"
                                onClick={() => {
                                    toast("Shortcut: Arrow keys to navigate, Enter to proceed.", {
                                        icon: '⌨️',
                                        style: { borderRadius: '1rem', background: 'rgba(15, 23, 42, 0.9)', color: 'white', border: '1px solid var(--primary)' }
                                    });
                                }}
                                style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    color: 'var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    backdropFilter: 'blur(10px)'
                                }}
                            >
                                <Info size={24} />
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReviewerDashboard;
