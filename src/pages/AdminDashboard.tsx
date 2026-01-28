import { useState, useEffect } from 'react';
import {
    Plus,
    Trash2,
    Save,
    Settings,
    FileSpreadsheet,
    CheckCircle2,
    TrendingUp,
    Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
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
    const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
    const [existingEvents, setExistingEvents] = useState<any[]>([]);

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

    const handleCreateEvent = async () => {
        if (!eventName) return toast.error('Please enter an event name');
        if (studentsData.length === 0) return toast.error('Please upload student data');

        // Validate criteria
        for (const session of sessions) {
            if (session.criteria.length === 0) return toast.error(`Session ${session.number} needs at least one criterion`);
            if (session.criteria.some(c => !c.label)) return toast.error(`All criteria in Session ${session.number} must have labels`);
        }

        setIsSaving(true);
        try {
            // 0. Pre-process Student Data (Fill Down logic for Team Names)
            let lastTeam = 'Unassigned';
            const processedData = studentsData.map(s => {
                // Find potential team key
                const rawTeam = s.team_id || s.team || s['team name'] || s['Team Name'] || s['TEAM'] || '';
                const studentName = s.name || s['student name'] || s['Student Name'] || s['Name'] || '';
                const studentId = (s.student_id || s.id || s['Sl No.'] || s['sl no'] || Math.random().toString()).toString();

                if (rawTeam && rawTeam.toString().trim() !== '') {
                    lastTeam = rawTeam.toString().trim();
                }

                return {
                    ...s,
                    final_team: lastTeam,
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
            const teamNames = Array.from(new Set(processedData.map(s => s.final_team)));

            const { data: teamsData, error: teamsError } = await supabase
                .from('teams')
                .upsert(teamNames.map(name => ({ name })), { onConflict: 'name' })
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

            toast.success(`Event created with ${processedData.length} students across ${teamNames.length} teams!`);
            setEventName('');
            setStudentsData([]);
            fetchEvents();
            setActiveTab('manage');
        } catch (err: any) {
            console.error(err);
            toast.error('Error saving event: ' + err.message);
        } finally {
            setIsSaving(false);
        }
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
                .select('id, name, students(student_id, name)')
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
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                <button
                    onClick={() => setActiveTab('create')}
                    style={{
                        padding: '1rem 2rem',
                        background: 'none',
                        color: activeTab === 'create' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'create' ? '2px solid var(--primary)' : 'none',
                        fontWeight: 600
                    }}
                >
                    Create Event
                </button>
                <button
                    onClick={() => setActiveTab('manage')}
                    style={{
                        padding: '1rem 2rem',
                        background: 'none',
                        color: activeTab === 'manage' ? 'var(--primary)' : 'var(--text-muted)',
                        borderBottom: activeTab === 'manage' ? '2px solid var(--primary)' : 'none',
                        fontWeight: 600
                    }}
                >
                    Manage Events
                </button>
            </div>

            {activeTab === 'create' ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <section className="glass" style={{ padding: '2rem' }}>
                        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Settings className="text-primary" /> Basic Configuration
                        </h2>

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
                                    <span className="badge" style={{ background: 'var(--primary)', color: 'white', minWidth: '40px', textAlign: 'center' }}>
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
                        {studentsData.length === 0 ? (
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
                                    <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
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
                            onClick={handleCreateEvent}
                            disabled={isSaving}
                        >
                            {isSaving ? 'Creating Event...' : 'Confirm & Save Event'}
                            <Save size={20} />
                        </button>
                    </div>
                </motion.div>
            ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass" style={{ padding: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>Existing Events</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {existingEvents.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No events found. Create your first one!</p>
                        ) : (
                            existingEvents.map(event => (
                                <div key={event.id} className="glass" style={{
                                    padding: '1.5rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: 'rgba(255,255,255,0.03)'
                                }}>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{event.name}</h3>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            {event.num_sessions} Sessions • Created {new Date(event.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                                            onClick={() => downloadMarks(event.id, event.name)}
                                        >
                                            <Download size={18} /> Export Results
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                                            onClick={() => handleDeleteEvent(event.id, event.name)}
                                        >
                                            <Trash2 size={18} /> Delete
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default AdminDashboard;
