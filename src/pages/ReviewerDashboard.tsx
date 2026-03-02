import { useState, useEffect } from 'react';
import {
    Search,
    CheckCircle2,
    Clock,
    ArrowRight,
    ArrowLeft,
    User,
    Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

const ReviewerDashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [teams, setTeams] = useState<any[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);
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
            setEvents(data);
            // Only update selected event if current one is gone or nothing selected
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
        // Search teams by name
        const { data: teamsByName } = await supabase
            .from('teams')
            .select('*, students(*)')
            .ilike('name', `%${searchTerm}%`)
            .limit(5);

        // Search students by name and get their teams (including PS)
        const { data: studentsByName } = await supabase
            .from('students')
            .select('*, teams(*, students(*))')
            .ilike('name', `%${searchTerm}%`)
            .limit(5);

        // Combine and unique by team ID
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

            toast.success('Review submitted successfully!');
            // Persistent reviewerName is NOT cleared
            setStep('team');
            setSelectedTeam(null);
            setSelectedSession(null);
            setRemarks('');
            setSearchTerm('');
        } catch (err: any) {
            toast.error('Submission failed: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                <button
                    onClick={() => setStep(reviewerName ? 'team' : 'identity')}
                    style={{
                        padding: '1rem',
                        background: 'none',
                        color: 'var(--primary)',
                        borderBottom: '2px solid var(--primary)',
                        fontWeight: 600,
                        cursor: 'default'
                    }}
                >
                    Review Process
                </button>

                {reviewerName && (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0 1rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Reviewing as: <strong>{reviewerName}</strong></span>
                        <button
                            onClick={() => { setStep('identity'); }}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                        >
                            Change
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
                        <div className="glass" style={{ padding: '4rem 3rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
                            <motion.div
                                initial={{ scale: 0.5, rotate: -20 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                                style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '2rem',
                                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 2rem',
                                    boxShadow: '0 20px 40px -10px var(--primary-glow)'
                                }}
                            >
                                <User size={40} color="white" />
                            </motion.div>
                            <h1 style={{ marginBottom: '1rem', fontSize: '2.5rem' }}>Welcome</h1>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '3rem', fontSize: '1.1rem', lineHeight: 1.6 }}>Identify yourself to begin evaluating teams and providing feedback.</p>

                            <div style={{ textAlign: 'left', width: '100%' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    Full Name
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Enter your name..."
                                        value={reviewerName}
                                        onChange={(e) => setReviewerName(e.target.value)}
                                        className="glass"
                                        style={{
                                            width: '100%',
                                            padding: '1.25rem',
                                            fontSize: '1.25rem',
                                            textAlign: 'center',
                                            background: 'rgba(255,255,255,0.02)'
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        className="btn btn-primary"
                                        disabled={!reviewerName.trim()}
                                        style={{ padding: '1.25rem', justifyContent: 'center', fontSize: '1.1rem' }}
                                        onClick={() => {
                                            localStorage.setItem('eval_reviewer_name', reviewerName);
                                            setStep('team');
                                        }}
                                    >
                                        Start Reviewing <ArrowRight size={22} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 'team' && (
                    <motion.div
                        key="team-select"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="glass" style={{ padding: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2.5rem' }}>
                                <button onClick={() => setStep('identity')} className="btn btn-outline" style={{ padding: '0.75rem' }}>
                                    <ArrowLeft size={20} />
                                </button>
                                <h1 style={{ margin: 0, fontSize: '2.5rem' }}>Find Team</h1>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                        Current Evaluation Event
                                    </label>
                                    <select
                                        className="glass"
                                        style={{
                                            width: '100%',
                                            padding: '1rem',
                                            borderRadius: '1rem',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'white',
                                            border: '1px solid var(--glass-border)',
                                            fontSize: '1.1rem'
                                        }}
                                        value={selectedEvent?.id || ''}
                                        onChange={(e) => setSelectedEvent(events.find(ev => ev.id === e.target.value))}
                                    >
                                        {events.map(event => (
                                            <option key={event.id} value={event.id} style={{ background: '#0f172a' }}>
                                                {event.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ position: 'relative', alignSelf: 'flex-end' }}>
                                    <div style={{ position: 'relative' }}>
                                        <Search style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={24} />
                                        <input
                                            type="text"
                                            placeholder="Search team or member..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            style={{ width: '100%', paddingLeft: '3.5rem', fontSize: '1.1rem', height: '3.75rem' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                                <AnimatePresence mode="popLayout">
                                    {teams.length === 0 && searchTerm.length >= 2 ? (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                                            No teams match your search criteria.
                                        </div>
                                    ) : teams.map((team, index) => (
                                        <motion.button
                                            key={team.id}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="glass"
                                            onClick={() => handleTeamSelect(team)}
                                            style={{
                                                padding: '2rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                gap: '1.5rem',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}
                                            whileHover={{
                                                y: -5,
                                                background: 'rgba(99, 102, 241, 0.05)',
                                                borderColor: 'rgba(99, 102, 241, 0.3)'
                                            }}
                                        >
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '0.75rem',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--primary)',
                                                marginBottom: '0.5rem'
                                            }}>
                                                <Sparkles size={24} />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{team.name}</h3>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                                    <span className="badge" style={{ fontSize: '0.7rem' }}>
                                                        {team.students ? team.students.length : 0} Members
                                                    </span>
                                                    <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                                                        Ready for Eval
                                                    </span>
                                                </div>
                                            </div>
                                            <ArrowRight
                                                size={24}
                                                style={{
                                                    position: 'absolute',
                                                    right: '1.5rem',
                                                    top: '2rem',
                                                    opacity: 0.3,
                                                    color: 'var(--primary)'
                                                }}
                                            />
                                        </motion.button>
                                    ))}
                                </AnimatePresence>
                                {teams.length === 0 && searchTerm.length < 2 && (
                                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', opacity: 0.5, border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '2rem' }}>
                                        <Search size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                        <p style={{ fontSize: '1.1rem' }}>Enter at least 2 characters to search for teams</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 'session' && (
                    <motion.div
                        key="session-select"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        <div className="glass" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                <button onClick={() => setStep('team')} className="btn btn-outline" style={{ padding: '0.5rem' }}><ArrowLeft size={18} /></button>
                                <h2 style={{ margin: 0 }}>Select Review Session</h2>
                            </div>
                            <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem 1rem', display: 'inline-block', alignSelf: 'flex-start' }}>
                                    Reviewing: <span style={{ fontWeight: 'bold' }}>{selectedTeam?.name}</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                {sessions.map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => handleSessionSelect(session)}
                                        className="glass"
                                        disabled={completedSessions.includes(session.id)}
                                        style={{
                                            padding: '1.5rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            opacity: completedSessions.includes(session.id) ? 0.5 : 1,
                                            cursor: completedSessions.includes(session.id) ? 'not-allowed' : 'pointer',
                                            border: completedSessions.includes(session.id) ? '1px solid var(--accent)' : '1px solid var(--border-color)'
                                        }}
                                    >
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            background: completedSessions.includes(session.id) ? 'var(--accent)' : 'rgba(99, 102, 241, 0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {completedSessions.includes(session.id) ? <CheckCircle2 size={20} color="white" /> : <Clock size={20} color="var(--primary)" />}
                                        </div>
                                        <span style={{ fontWeight: 'bold' }}>Session {session.session_number}</span>
                                    </button>
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
                        <div className="glass" style={{ padding: '2.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <div>
                                    <h2 style={{ margin: 0 }}>Attendance</h2>
                                </div>
                                <button
                                    className="btn btn-outline"
                                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}
                                    onClick={() => {
                                        const allPresent: Record<string, boolean> = {};
                                        selectedTeam?.students?.forEach((s: any) => {
                                            allPresent[s.student_id] = true;
                                        });
                                        setAttendance(allPresent);
                                        toast.success('All marked as present');
                                    }}
                                >
                                    Mark All Present
                                </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                                {selectedTeam?.students?.map((student: any) => (
                                    <div key={student.id} className="glass" style={{
                                        padding: '1rem 1.5rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: attendance[student.student_id] ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ fontWeight: 600 }}>{student.name}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => setAttendance(prev => ({ ...prev, [student.student_id]: true }))}
                                                className={`btn ${attendance[student.student_id] ? 'btn-primary' : 'btn-outline'}`}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    fontSize: '0.875rem',
                                                    background: attendance[student.student_id] ? 'var(--accent)' : 'transparent',
                                                    borderColor: attendance[student.student_id] ? 'var(--accent)' : 'var(--border-color)'
                                                }}
                                            >
                                                Present
                                            </button>
                                            <button
                                                onClick={() => setAttendance(prev => ({ ...prev, [student.student_id]: false }))}
                                                className={`btn ${!attendance[student.student_id] ? 'btn-primary' : 'btn-outline'}`}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    fontSize: '0.875rem',
                                                    background: !attendance[student.student_id] ? 'var(--error)' : 'transparent',
                                                    borderColor: !attendance[student.student_id] ? 'var(--error)' : 'var(--border-color)'
                                                }}
                                            >
                                                Absent
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <button className="btn btn-outline" onClick={() => setStep('session')}>Back</button>
                                <button className="btn btn-primary" onClick={() => setStep('review')}>Next: Marking</button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 'review' && (
                    <motion.div
                        key="review-marking"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="glass" style={{ padding: '2.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0 }}>Mark Evaluation</h2>
                                <div className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
                                    Team: {selectedTeam?.name}
                                </div>
                            </div>

                            {selectedTeam?.ps && (
                                <div className="glass" style={{ padding: '1rem', borderLeft: '4px solid var(--primary)', background: 'rgba(255,255,255,0.02)', marginBottom: '2rem' }}>
                                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Selected Problem Statement:</p>
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: '1.1rem' }}>{selectedTeam.ps}</p>
                                </div>
                            )}
                            {selectedSession?.criteria.map((criterion: any) => (
                                <div key={criterion.id} style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <label>{criterion.label}</label>
                                        <span>{marks[criterion.id]} / {criterion.maxMarks}</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        max={criterion.maxMarks}
                                        value={marks[criterion.id]}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            if (val > criterion.maxMarks) {
                                                toast.error(`Max marks for ${criterion.label} is ${criterion.maxMarks}`);
                                                setMarks(prev => ({ ...prev, [criterion.id]: criterion.maxMarks }));
                                            } else {
                                                setMarks(prev => ({ ...prev, [criterion.id]: val }));
                                            }
                                        }}
                                        className="glass"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            fontSize: '1.25rem',
                                            fontWeight: 'bold',
                                            textAlign: 'center',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--border-color)',
                                            color: 'white',
                                            borderRadius: '0.5rem'
                                        }}
                                    />
                                </div>
                            ))}
                            <textarea
                                rows={4}
                                placeholder="Remarks"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                style={{ width: '100%', marginTop: '1rem' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                                <button className="btn btn-outline" onClick={() => setStep('attendance')}>Back</button>
                                <button className="btn btn-primary" onClick={handleSubmitReview} disabled={isSubmitting}>
                                    {isSubmitting ? 'Submitting...' : 'Submit Final Review'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ReviewerDashboard;
