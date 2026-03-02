import { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Save,
    Settings,
    FileSpreadsheet,
    CheckCircle2,
    Trophy,
    BarChart3,
    Medal,
    TrendingUp,
    Download,
    Pencil,
    X,
    LayoutGrid,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ExcelUpload from '../components/ExcelUpload';
import { supabase } from '../lib/supabase';
import type { SessionCriteria } from '../lib/supabase';
import * as XLSX from 'xlsx';

const AdminDashboard = () => {
    const [eventName, setEventName] = useState('');
    const [numSessions, setNumSessions] = useState(1);
    const [studentsData, setStudentsData] = useState<any[]>([]);
    const [sessions, setSessions] = useState<{ number: number; criteria: SessionCriteria[] }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'create' | 'manage' | 'analytics'>('create');
    const [existingEvents, setExistingEvents] = useState<any[]>([]);
    const [editingEvent, setEditingEvent] = useState<any>(null);
    const [analyticsEvent, setAnalyticsEvent] = useState<any>(null);
    const [leaderboard, setLeaderboard] = useState<{
        sessions: { number: number; topTeams: any[] }[];
        overall: any[];
    } | null>(null);

    useEffect(() => {
        // Initialize sessions when numSessions changes
        const newSessions = Array.from({ length: numSessions }, (_, i) => ({
            number: i + 1,
            criteria: sessions[i]?.criteria || [{ id: Math.random().toString(36).substr(2, 9), label: 'Creativity', maxMarks: 10 }]
        }));
        setSessions(newSessions);
    }, [numSessions]);

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        const { data } = await supabase
            .from('evaluation_events')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setExistingEvents(data);
    };

    const addCriterion = (sessionIndex: number) => {
        const newSessions = [...sessions];
        newSessions[sessionIndex].criteria.push({
            id: Math.random().toString(36).substr(2, 9),
            label: '',
            maxMarks: 10
        });
        setSessions(newSessions);
    };

    const removeCriterion = (sessionIndex: number, criterionIndex: number) => {
        const newSessions = [...sessions];
        newSessions[sessionIndex].criteria.splice(criterionIndex, 1);
        setSessions(newSessions);
    };

    const updateCriterion = (sessionIndex: number, criterionIndex: number, field: keyof SessionCriteria, value: any) => {
        const newSessions = [...sessions];
        newSessions[sessionIndex].criteria[criterionIndex] = {
            ...newSessions[sessionIndex].criteria[criterionIndex],
            [field]: value
        };
        setSessions(newSessions);
    };

    const handleEditEvent = async (event: any) => {
        setEditingEvent(event);
        setEventName(event.name);
        setNumSessions(event.num_sessions);

        // Fetch sessions for this event
        const { data: sessData } = await supabase
            .from('review_sessions')
            .select('*')
            .eq('event_id', event.id)
            .order('session_number', { ascending: true });

        if (sessData) {
            setSessions(sessData.map(s => ({
                number: s.session_number,
                criteria: s.criteria
            })));
        }

        setActiveTab('create');
    };

    const cancelEdit = () => {
        setEditingEvent(null);
        setEventName('');
        setNumSessions(1);
        setSessions([{ number: 1, criteria: [{ id: Math.random().toString(36).substr(2, 9), label: 'Creativity', maxMarks: 10 }] }]);
        setStudentsData([]);
    };

    const handleSaveEvent = async () => {
        if (!eventName) return toast.error('Please enter an event name');

        // If creating new event, check for student data
        if (!editingEvent && studentsData.length === 0) return toast.error('Please upload student data');

        // Validate criteria
        for (const session of sessions) {
            if (session.criteria.length === 0) return toast.error(`Session ${session.number} needs at least one criterion`);
            if (session.criteria.some(c => !c.label)) return toast.error(`All criteria in Session ${session.number} must have labels`);
        }

        setIsSaving(true);
        try {
            if (editingEvent) {
                // Update existing event
                const { error: eventError } = await supabase
                    .from('evaluation_events')
                    .update({ name: eventName, num_sessions: numSessions })
                    .eq('id', editingEvent.id);

                if (eventError) throw eventError;

                // Update or Re-create sessions
                const sessionsToUpsert = sessions.map(s => ({
                    event_id: editingEvent.id,
                    session_number: s.number,
                    criteria: s.criteria
                }));

                // First, delete sessions that are no longer needed (if numSessions decreased)
                await supabase
                    .from('review_sessions')
                    .delete()
                    .eq('event_id', editingEvent.id)
                    .gt('session_number', numSessions);

                const { error: sessError } = await supabase
                    .from('review_sessions')
                    .upsert(sessionsToUpsert, { onConflict: 'event_id,session_number' });

                if (sessError) throw sessError;

                toast.success('Event updated successfully!');
                cancelEdit();
                fetchEvents();
                setActiveTab('manage');
            } else {
                // Original Create Logic
                await handleCreateEvent();
            }
        } catch (err: any) {
            console.error(err);
            toast.error('Error saving event: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const fetchLeaderboard = async (event: any) => {
        setAnalyticsEvent(event);
        try {
            // 1. Fetch sessions
            const { data: sessData } = await supabase
                .from('review_sessions')
                .select('id, session_number')
                .eq('event_id', event.id)
                .order('session_number', { ascending: true });

            if (!sessData) return;

            // 2. Fetch all reviews for these sessions
            const sessionIds = sessData.map(s => s.id);
            const { data: reviewsData } = await supabase
                .from('reviews')
                .select('*, teams(name)')
                .in('session_id', sessionIds);

            if (!reviewsData) return;

            // 3. Group and sum scores
            const sessionRankings = sessData.map(session => {
                const sessionReviews = reviewsData.filter(r => r.session_id === session.id);
                const teamScores = sessionReviews.map(r => ({
                    teamName: r.teams?.name || 'Unknown',
                    score: Object.values(r.marks).reduce((sum: number, val: any) => sum + Number(val), 0)
                }));

                return {
                    number: session.session_number,
                    topTeams: teamScores.sort((a, b) => b.score - a.score).slice(0, 3)
                };
            });

            // 4. Calculate Overall
            const overallMap = new Map();
            reviewsData.forEach(r => {
                const teamName = r.teams?.name || 'Unknown';
                const score = Object.values(r.marks).reduce((sum: number, val: any) => sum + Number(val), 0);
                overallMap.set(teamName, (overallMap.get(teamName) || 0) + score);
            });

            const overallRankings = Array.from(overallMap.entries())
                .map(([name, score]) => ({ teamName: name, score }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            setLeaderboard({
                sessions: sessionRankings,
                overall: overallRankings
            });
            setActiveTab('analytics');
        } catch (err) {
            console.error(err);
            toast.error('Failed to load leaderboard');
        }
    };

    const handleCreateEvent = async () => {
        // 0. Pre-process Student Data (Fill Down logic for Team Names and PS)
        let lastTeam = 'Unassigned';
        let lastPS = '';
        const processedData = studentsData.map(s => {
            // Find potential team/PS keys
            const rawTeam = s.team_id || s.team || s['team name'] || s['Team Name'] || s['TEAM'] || '';
            const rawPS = s.ps || s['PS'] || s['problem statement'] || s['Problem Statement'] || '';
            const studentName = s.name || s['student name'] || s['Student Name'] || s['Name'] || '';
            const studentId = (s.student_id || s.id || s['Sl No.'] || s['sl no'] || Math.random().toString()).toString();

            if (rawTeam && rawTeam.toString().trim() !== '') {
                lastTeam = rawTeam.toString().trim();
                lastPS = rawPS.toString().trim();
            }

            return {
                ...s,
                final_team: lastTeam,
                final_ps: lastPS,
                final_name: studentName,
                final_id: studentId
            };
        }).filter(s => s.final_name); // Ignore rows with no names

        // 1. Create Event
        const { data: eventData, error: eventError } = await supabase
            .from('evaluation_events')
            .insert([{ name: eventName, num_sessions: numSessions }])
            .select()
            .single();

        if (eventError) throw eventError;

        // 2. Create Sessions
        const sessionsToInsert = sessions.map(s => ({
            event_id: eventData.id,
            session_number: s.number,
            criteria: s.criteria
        }));

        const { error: sessError } = await supabase.from('review_sessions').insert(sessionsToInsert);
        if (sessError) throw sessError;

        // 3. Process Teams and Students
        // Get unique teams from processed data
        const teamMapWithPS = new Map();
        processedData.forEach(s => {
            if (!teamMapWithPS.has(s.final_team)) {
                teamMapWithPS.set(s.final_team, s.final_ps);
            }
        });

        const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .upsert(Array.from(teamMapWithPS.entries()).map(([name, ps]) => ({ name, ps })), { onConflict: 'name' })
            .select();

        if (teamsError) throw teamsError;

        // Map team names to IDs
        const teamMap = teamsData.reduce((acc, team) => {
            acc[team.name] = team.id;
            return acc;
        }, {} as Record<string, string>);

        // Insert Students
        const studentsToInsert = processedData.map((s: any) => ({
            team_id: teamMap[s.final_team],
            student_id: s.final_id,
            name: s.final_name,
            details: s
        }));

        // 4. Deduplicate studentsToInsert to prevent internal collision during bulk upsert
        const uniqueStudentsMap = new Map();
        studentsToInsert.forEach(s => {
            const key = `${s.team_id}_${s.student_id}`;
            uniqueStudentsMap.set(key, s);
        });
        const deduplicatedStudents = Array.from(uniqueStudentsMap.values());

        const { error: studError } = await supabase
            .from('students')
            .upsert(deduplicatedStudents, { onConflict: 'team_id,student_id' });

        if (studError) {
            console.error('Student insertion error:', studError);
            toast.error('Some students could not be saved: ' + studError.message);
        }

        toast.success(`Event created with ${processedData.length} students across ${teamMapWithPS.size} teams!`);
        cancelEdit();
        fetchEvents();
        setActiveTab('manage');
    };

    const downloadMarks = async (eventId: string, eventName: string) => {
        try {
            // 1. Fetch sessions
            const { data: sessData } = await supabase
                .from('review_sessions')
                .select('id, session_number, criteria')
                .eq('event_id', eventId)
                .order('session_number', { ascending: true });

            if (!sessData || sessData.length === 0) return toast.error('No sessions found for this event');

            // 2. Fetch all teams and their students
            const { data: teamsWithStudents } = await supabase
                .from('teams')
                .select('id, name, ps, students(student_id, name)')
                .order('name');

            if (!teamsWithStudents) return;

            // 3. Fetch all reviews for these sessions
            const sessionIds = sessData.map(s => s.id);
            const { data: reviewsData } = await supabase
                .from('reviews')
                .select('*')
                .in('session_id', sessionIds);

            if (!reviewsData) return toast.error('No reviews submitted yet');

            // 4. Format data student-wise
            const xlsxData: any[] = [];

            // We only care about teams that have students
            teamsWithStudents.forEach(team => {
                if (!team.students || team.students.length === 0) return;

                team.students.forEach((student: any) => {
                    const row: any = {
                        'Team Name': team.name,
                        'PS': team.ps || 'N/A',
                        'Student Name': student.name,
                    };

                    // For each session defined in the event
                    sessData.forEach(session => {
                        const sNum = session.session_number;
                        // Find review for this team and session
                        const review = reviewsData.find(r => r.team_id === team.id && r.session_id === session.id);

                        if (review) {
                            // Calculate total marks for this session
                            const totalMarks = Object.values(review.marks).reduce((sum: number, val: any) => sum + Number(val), 0);
                            row[`S${sNum} Marks`] = totalMarks;
                            row[`S${sNum} Reviewer`] = review.reviewer_id;
                            row[`S${sNum} Attendance`] = review.attendance[student.student_id] ? 'Present' : 'Absent';
                            row[`S${sNum} Timestamp`] = new Date(review.created_at).toLocaleString();
                        } else {
                            row[`S${sNum} Marks`] = 'N/A';
                            row[`S${sNum} Reviewer`] = 'N/A';
                            row[`S${sNum} Attendance`] = 'N/A';
                            row[`S${sNum} Timestamp`] = 'N/A';
                        }
                    });

                    xlsxData.push(row);
                });
            });

            if (xlsxData.length === 0) {
                return toast.error('No student data available to export');
            }

            const ws = XLSX.utils.json_to_sheet(xlsxData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Evaluation Summary");
            XLSX.writeFile(wb, `${eventName}_consolidated_report.xlsx`);
            toast.success('Download started');
        } catch (err: any) {
            console.error(err);
            toast.error('Failed to export marks: ' + err.message);
        }
    };

    const handleDeleteEvent = async (eventId: string, eventName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${eventName}"? This will remove all sessions and reviews associated with it.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('evaluation_events')
                .delete()
                .eq('id', eventId);

            if (error) throw error;

            toast.success('Event deleted successfully');
            fetchEvents();
        } catch (err: any) {
            toast.error('Failed to delete event: ' + err.message);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="glass" style={{ display: 'flex', padding: '0.5rem', gap: '0.5rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1.25rem' }}>
                <button
                    onClick={() => {
                        if (editingEvent) cancelEdit();
                        setActiveTab('create');
                    }}
                    style={{
                        flex: 1,
                        padding: '1rem',
                        borderRadius: '0.85rem',
                        background: (activeTab === 'create' || editingEvent) ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                        color: (activeTab === 'create' || editingEvent) ? 'var(--primary)' : 'var(--text-muted)',
                        transition: 'all 0.3s ease',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Plus size={18} />
                    {editingEvent ? 'Edit Event' : 'Create Event'}
                </button>
                <button
                    onClick={() => setActiveTab('manage')}
                    style={{
                        flex: 1,
                        padding: '1rem',
                        borderRadius: '0.85rem',
                        background: activeTab === 'manage' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                        color: activeTab === 'manage' ? 'var(--primary)' : 'var(--text-muted)',
                        transition: 'all 0.3s ease',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <LayoutGrid size={18} />
                    Manage Events
                </button>
                <button
                    onClick={() => {
                        if (existingEvents.length > 0) {
                            fetchLeaderboard(existingEvents[0]);
                        } else {
                            setActiveTab('analytics');
                        }
                    }}
                    style={{
                        flex: 1,
                        padding: '1rem',
                        borderRadius: '0.85rem',
                        background: activeTab === 'analytics' ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                        color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
                        transition: 'all 0.3s ease',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Trophy size={18} />
                    Analytics & Leaderboard
                </button>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'create' ? (
                    <motion.div
                        key="tab-create"
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -10 }}
                        transition={{ duration: 0.3 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
                    >
                        <section className="glass" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Settings className="text-primary" /> {editingEvent ? 'Edit Event Details' : 'Basic Configuration'}
                                </h2>
                                {editingEvent && (
                                    <button className="btn btn-outline" onClick={cancelEdit}>
                                        <X size={18} /> Cancel Edit
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Event Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Hackathon 2026"
                                        value={eventName}
                                        onChange={(e) => setEventName(e.target.value)}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Number of Review Sessions</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <input
                                            type="range"
                                            min="1"
                                            max="5"
                                            value={numSessions}
                                            onChange={(e) => setNumSessions(parseInt(e.target.value))}
                                            style={{ flex: 1 }}
                                        />
                                        <span className="badge" style={{ background: 'var(--accent)', color: 'white', minWidth: '40px', textAlign: 'center' }}>
                                            {numSessions}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <FileSpreadsheet className="text-primary" /> Student Data
                            </h2>
                            {editingEvent ? (
                                <div className="glass" style={{ padding: '1.5rem', opacity: 0.7 }}>
                                    <p style={{ margin: 0, color: 'var(--text-muted)' }}>Student data modification is disabled during event edit.</p>
                                </div>
                            ) : studentsData.length === 0 ? (
                                <ExcelUpload onDataLoaded={setStudentsData} />
                            ) : (
                                <div className="glass" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <CheckCircle2 color="var(--accent)" />
                                        <div>
                                            <h4 style={{ margin: 0 }}>Data Loaded</h4>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{studentsData.length} students across multiple teams</p>
                                        </div>
                                    </div>
                                    <button className="btn btn-outline" onClick={() => setStudentsData([])}>Change File</button>
                                </div>
                            )}
                        </section>

                        <section>
                            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <TrendingUp className="text-primary" /> Review Criteria per Session
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                                {sessions.map((session, sIdx) => (
                                    <motion.div
                                        key={session.number}
                                        initial={{ scale: 0.95, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="glass"
                                        style={{ padding: '1.5rem' }}
                                    >
                                        <h3 style={{ marginBottom: '1rem', color: 'var(--accent)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                                            Session {session.number}
                                        </h3>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {session.criteria.map((criterion, cIdx) => (
                                                <div key={criterion.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Criterion Label</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Label"
                                                            value={criterion.label}
                                                            onChange={(e) => updateCriterion(sIdx, cIdx, 'label', e.target.value)}
                                                            style={{ padding: '0.5rem' }}
                                                        />
                                                    </div>
                                                    <div style={{ width: '80px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max Marks</label>
                                                        <input
                                                            type="number"
                                                            value={criterion.maxMarks}
                                                            onChange={(e) => updateCriterion(sIdx, cIdx, 'maxMarks', parseInt(e.target.value))}
                                                            style={{ padding: '0.5rem' }}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => removeCriterion(sIdx, cIdx)}
                                                        style={{ padding: '0.5rem', background: 'none', color: 'var(--error)' }}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '0.5rem', width: '100%', fontSize: '0.875rem' }}
                                                onClick={() => addCriterion(sIdx)}
                                            >
                                                <Plus size={16} /> Add Criterion
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button
                                className="btn btn-primary"
                                style={{ padding: '1rem 3rem', fontSize: '1.125rem' }}
                                onClick={handleSaveEvent}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving...' : editingEvent ? 'Update Event' : 'Confirm & Save Event'}
                                <Save size={20} />
                            </button>
                        </div>
                    </motion.div>
                ) : activeTab === 'manage' ? (
                    <motion.div
                        key="tab-manage"
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="glass"
                        style={{ padding: '2.5rem' }}
                    >
                        <h2 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <LayoutGrid className="text-primary" /> Existing Events
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {existingEvents.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    <p>No events found. Start by creating a new evaluation event!</p>
                                </div>
                            ) : (
                                existingEvents.map((event, index) => (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="glass"
                                        style={{
                                            padding: '1.75rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid rgba(255,255,255,0.05)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                            <div style={{
                                                width: '56px',
                                                height: '56px',
                                                borderRadius: '1rem',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--primary)'
                                            }}>
                                                <TrendingUp size={28} />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{event.name}</h3>
                                                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                    <CheckCircle2 size={14} /> {event.num_sessions} Sessions • Created {new Date(event.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
                                                onClick={() => fetchLeaderboard(event)}
                                            >
                                                <Trophy size={16} /> Results
                                            </button>
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '0.65rem 1rem' }}
                                                onClick={() => handleEditEvent(event)}
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '0.65rem 1rem', color: 'var(--info)', borderColor: 'rgba(14, 165, 233, 0.4)' }}
                                                onClick={() => downloadMarks(event.id, event.name)}
                                            >
                                                <Download size={16} />
                                            </button>
                                            <button
                                                className="btn btn-outline"
                                                style={{ padding: '0.65rem 1rem', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                                onClick={() => handleDeleteEvent(event.id, event.name)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="tab-analytics"
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -10 }}
                        transition={{ duration: 0.3 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
                    >
                        <section className="glass" style={{ padding: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <BarChart3 className="text-primary" /> Event Analytics: {analyticsEvent?.name || 'Select an Event'}
                                </h2>
                                <select
                                    className="glass"
                                    style={{ padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                                    value={analyticsEvent?.id || ''}
                                    onChange={(e) => {
                                        const event = existingEvents.find(ev => ev.id === e.target.value);
                                        if (event) fetchLeaderboard(event);
                                    }}
                                >
                                    <option value="" style={{ background: '#1a1a1a' }}>Select Event...</option>
                                    {existingEvents.map(ev => (
                                        <option key={ev.id} value={ev.id} style={{ background: '#1a1a1a' }}>{ev.name}</option>
                                    ))}
                                </select>
                            </div>

                            {!leaderboard ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Select an event to view the leaderboard findings.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                                    {/* Overall Rankings */}
                                    <div className="glass" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))', padding: '2rem' }}>
                                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
                                            <Trophy /> Overall Top Teams (Combined Sessions)
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                                            {leaderboard.overall.map((team, idx) => (
                                                <div key={team.teamName} style={{
                                                    textAlign: 'center',
                                                    padding: '1.5rem',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    borderRadius: '1rem',
                                                    border: idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                                    position: 'relative',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                                                    </div>
                                                    <h4 style={{ margin: '0 0 0.5rem 0' }}>{team.teamName}</h4>
                                                    <div className="badge" style={{ background: 'var(--primary)' }}>{team.score} Total Marks</div>
                                                    {idx === 0 && <div style={{ position: 'absolute', top: 10, right: 10 }}><Medal size={20} color="gold" /></div>}
                                                </div>
                                            ))}
                                            {leaderboard.overall.length === 0 && <p>No data available yet.</p>}
                                        </div>
                                    </div>

                                    {/* Per Session Rankings */}
                                    <div>
                                        <h3 style={{ marginBottom: '1.5rem' }}>Session-wise Rankings</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                            {leaderboard.sessions.map(sess => (
                                                <div key={sess.number} className="glass" style={{ padding: '1.5rem' }}>
                                                    <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', color: 'var(--accent)' }}>
                                                        Session {sess.number}
                                                    </h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        {sess.topTeams.map((team, idx) => (
                                                            <div key={team.teamName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                    <span style={{ fontWeight: 800, color: 'var(--text-muted)', width: '20px' }}>{idx + 1}.</span>
                                                                    <span>{team.teamName}</span>
                                                                </div>
                                                                <span className="badge" style={{ fontSize: '0.75rem' }}>{team.score} M</span>
                                                            </div>
                                                        ))}
                                                        {sess.topTeams.length === 0 && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No reviews yet.</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminDashboard;
