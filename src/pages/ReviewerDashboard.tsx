import { useState, useEffect } from 'react';
import {
    Search,
    CheckCircle2,
    Clock,
    ArrowRight,
    ArrowLeft,
    Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

const ReviewerDashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [teams, setTeams] = useState<any[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [step, setStep] = useState<'identity' | 'team' | 'session' | 'attendance' | 'review' | 'results'>('identity');
    const [results, setResults] = useState<any[]>([]);

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

        // Search students by name and get their teams
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

    const fetchAllResults = async () => {
        if (!selectedEvent && events.length > 0) {
            setSelectedEvent(events[0]);
        }

        const targetEventId = selectedEvent?.id || events[0]?.id;
        if (!targetEventId) return;

        const { data: sessData } = await supabase
            .from('review_sessions')
            .select('id, session_number, criteria')
            .eq('event_id', targetEventId);

        if (!sessData) return;

        const sessionIds = sessData.map(s => s.id);
        const { data: reviewsData } = await supabase
            .from('reviews')
            .select('*, teams(name)')
            .in('session_id', sessionIds);

        if (reviewsData) {
            const formatted = reviewsData.map(r => {
                const session = sessData.find(s => s.id === r.session_id);
                const totalMarks = Object.values(r.marks).reduce((a: any, b: any) => Number(a) + Number(b), 0);
                const maxMarks = session?.criteria.reduce((a: any, b: any) => a + (b.maxMarks || 0), 0);
                return {
                    ...r,
                    team_name: r.teams?.name,
                    session_number: session?.session_number,
                    score_summary: `${totalMarks} / ${maxMarks}`
                };
            });
            setResults(formatted);
        }
    };

    const downloadResults = () => {
        if (results.length === 0) return toast.error('No results to download');
        const ws = XLSX.utils.json_to_sheet(results.map(r => ({
            'Team': r.team_name,
            'Session': r.session_number,
            'Score': r.score_summary,
            'Remarks': r.remarks,
            'Reviewer': r.reviewer_id,
            'Timestamp': new Date(r.created_at || '').toLocaleString()
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Combined Results");
        XLSX.writeFile(wb, "Evaluation_Results.xlsx");
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                <button
                    onClick={() => setStep(reviewerName ? 'team' : 'identity')}
                    style={{
                        padding: '1rem',
                        background: 'none',
                        color: (step !== 'results') ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: (step !== 'results') ? '2px solid var(--primary)' : 'none',
                        fontWeight: 600
                    }}
                >
                    Review Process
                </button>
                <button
                    onClick={() => { setStep('results'); fetchAllResults(); }}
                    style={{
                        padding: '1rem',
                        background: 'none',
                        color: step === 'results' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: step === 'results' ? '2px solid var(--primary)' : 'none',
                        fontWeight: 600
                    }}
                >
                    View All Results
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
                {step === 'results' && (
                    <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="glass" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h2 style={{ margin: 0 }}>Evaluation Results</h2>
                                <button className="btn btn-primary" onClick={downloadResults}>
                                    <Download size={18} /> Download Combined Marks
                                </button>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: '1rem' }}>Team</th>
                                            <th style={{ padding: '1rem' }}>Session</th>
                                            <th style={{ padding: '1rem' }}>Score</th>
                                            <th style={{ padding: '1rem' }}>Reviewer</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((res) => (
                                            <tr key={res.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '1rem' }}>{res.team_name}</td>
                                                <td style={{ padding: '1rem' }}>S{res.session_number}</td>
                                                <td style={{ padding: '1rem' }}><span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent)' }}>{res.score_summary}</span></td>
                                                <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{res.reviewer_id}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {results.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No reviews submitted yet.</p>}
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 'identity' && (
                    <motion.div
                        key="identity-setup"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: 'rgba(99, 102, 241, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem'
                            }}>
                                <CheckCircle2 size={32} color="var(--primary)" />
                            </div>
                            <h2 style={{ marginBottom: '0.5rem' }}>Welcome, Reviewer!</h2>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem' }}>Please identify yourself to begin the evaluation process.</p>

                            <div style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    Select or Enter Your Name
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                    {['Reviewer 1', 'Reviewer 2', 'Reviewer 3', 'Reviewer 4', 'Reviewer 5'].map(name => (
                                        <button
                                            key={name}
                                            onClick={() => {
                                                setReviewerName(name);
                                            }}
                                            className="badge"
                                            style={{
                                                cursor: 'pointer',
                                                background: reviewerName === name ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                                color: reviewerName === name ? 'white' : 'var(--text-muted)',
                                                border: '1px solid var(--border-color)',
                                                padding: '0.6rem 1rem',
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Enter custom name..."
                                        value={reviewerName}
                                        onChange={(e) => setReviewerName(e.target.value)}
                                        className="glass"
                                        style={{ flex: 1, padding: '0.875rem' }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        disabled={!reviewerName.trim()}
                                        onClick={() => {
                                            localStorage.setItem('eval_reviewer_name', reviewerName);
                                            setStep('team');
                                        }}
                                    >
                                        Next <ArrowRight size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 'team' && (
                    <motion.div
                        key="team-select"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                    >
                        <div className="glass" style={{ padding: '2.5rem' }}>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    Select Evaluation Event
                                </label>
                                <select
                                    className="glass"
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        border: '1px solid var(--border-color)',
                                        outline: 'none',
                                        fontSize: '1rem'
                                    }}
                                    value={selectedEvent?.id || ''}
                                    onChange={(e) => setSelectedEvent(events.find(ev => ev.id === e.target.value))}
                                >
                                    {events.map(event => (
                                        <option key={event.id} value={event.id} style={{ background: '#1a1a1a' }}>
                                            {event.name}
                                        </option>
                                    ))}
                                    {events.length === 0 && <option value="">No events available</option>}
                                </select>
                            </div>

                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Search className="text-primary" /> Find Team for Review
                            </h2>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    placeholder="Search team name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ width: '100%', paddingLeft: '3rem', fontSize: '1.125rem' }}
                                    autoFocus
                                />
                                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                            </div>

                            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {teams.map(team => (
                                    <button
                                        key={team.id}
                                        className="glass"
                                        onClick={() => handleTeamSelect(team)}
                                        style={{
                                            padding: '1.25rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            textAlign: 'left',
                                            width: '100%',
                                            cursor: 'pointer',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid var(--border-color)'
                                        }}
                                    >
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.125rem' }}>{team.name}</h4>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{team.students ? team.students.length : 0} Members</p>
                                        </div>
                                        <ArrowRight size={20} color="var(--primary)" />
                                    </button>
                                ))}
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

                            <div style={{ marginBottom: '2rem' }}>
                                <div className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem 1rem' }}>
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
                            <h2 style={{ marginBottom: '0.5rem' }}>Attendance</h2>
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
                                        <button
                                            onClick={() => setAttendance(prev => ({ ...prev, [student.student_id]: !prev[student.student_id] }))}
                                            className={`btn ${attendance[student.student_id] ? 'btn-primary' : 'btn-outline'}`}
                                            style={{ background: attendance[student.student_id] ? 'var(--accent)' : 'transparent' }}
                                        >
                                            {attendance[student.student_id] ? 'Present' : 'Absent'}
                                        </button>
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
                            <h2 style={{ marginBottom: '1.5rem' }}>Mark Evaluation</h2>
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
