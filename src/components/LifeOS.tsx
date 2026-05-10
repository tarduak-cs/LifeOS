import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, Dumbbell, BookOpen, MessageSquare, Sun, Moon, TrendingUp, Plus, Trash2, Check, X, ChevronLeft, ChevronRight, Search, Download, Upload, Calendar, Heart, Award, Settings, PanelLeftClose, PanelLeftOpen, Sparkles, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { loadProfile, saveProfile as saveProfileToDB } from '../lib/profile';
import { loadHealthLogs, saveHealthLog } from '../lib/health';
import { loadRoutineItems, saveRoutineItems, loadRoutineCompletions, saveRoutineCompletionsForDate } from '../lib/routines';
import { importWhoopCsv } from '../lib/imports/whoop';
import { importOuraCsv } from '../lib/imports/oura';
import { getQuoteOfTheDay } from '../lib/quotes';
import { loadJournal, saveJournalEntry } from '../lib/journal';
import { useSaveStatus, SaveIndicator } from '../lib/saveStatus';
import { loadBehaviors, saveBehaviors as saveBehaviorsToDB, loadBehaviorLogs, saveBehaviorLogsForDate } from '../lib/behaviors';
import { loadSymptoms, saveSymptoms as saveSymptomsToDB, loadSymptomLogs, saveSymptomLogsForDate } from '../lib/symptoms';
import { loadWorkouts, saveWorkoutForDate, loadPRs, savePR, deletePR, loadPrograms, savePrograms as saveProgramsToDB } from '../lib/workouts';
import { submitFeedback } from '../lib/feedback';

// ============ STORAGE ============
const storage = {
    async get(key) { try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; } },
    async set(key, value) { try { await window.storage.set(key, JSON.stringify(value)); return true; } catch { return false; } },
};

// ============ HELPERS ============
const todayKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const formatDateLong = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const calcSleepHours = (s, w) => { if (!s || !w) return null; const [sh, sm] = s.split(':').map(Number); const [wh, wm] = w.split(':').map(Number); let m = (wh * 60 + wm) - (sh * 60 + sm); if (m < 0) m += 1440; return Math.round((m / 60) * 10) / 10; };
const calc1RM = (weight, reps) => { if (!weight || !reps || reps < 1) return null; return Math.round(Number(weight) * (1 + Number(reps) / 30)); };

const calcReadiness = (log, baselines) => {
    if (!log) return null;
    let score = 0, factors = 0;
    if (log.sleepHours) { const s = log.sleepHours; score += s >= 7 && s <= 9 ? 100 : s >= 6 && s <= 10 ? 75 : s >= 5 ? 50 : 25; factors++; }
    if (log.hrv && baselines.hrv) { const r = log.hrv / baselines.hrv; score += r >= 1 ? 100 : r >= 0.9 ? 80 : r >= 0.8 ? 60 : 40; factors++; }
    else if (log.hrv) { score += 70; factors++; }
    if (log.rhr && baselines.rhr) { const d = log.rhr - baselines.rhr; score += d <= 0 ? 100 : d <= 3 ? 80 : d <= 6 ? 60 : 40; factors++; }
    else if (log.rhr) { score += 70; factors++; }
    if (log.mood) { score += log.mood * 10; factors++; }
    if (log.energy) { score += log.energy * 10; factors++; }
    return factors === 0 ? null : Math.round(score / factors);
};

const calcBaselines = (healthLog) => {
    const entries = Object.values(healthLog).filter(e => e);
    const avg = (key) => { const vals = entries.map(e => e[key]).filter(v => v && !isNaN(v)); return vals.length ? Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 10) / 10 : null; };
    return { hrv: avg('hrv'), rhr: avg('rhr'), sleep: avg('sleepHours') };
};

// ============ DEFAULTS ============
const DEFAULT_MORNING = [
    { id: 'm-water', text: 'Drink water (hydration)' },
    { id: 'm-bed', text: 'Make bed' },
    { id: 'm-walk', text: 'Walk / fresh air' },
    { id: 'm-stretch', text: 'Stretch / mobility' },
    { id: 'm-yoga', text: 'Yoga' },
    { id: 'm-meditate', text: 'Meditation' },
    { id: 'm-log', text: 'Log health metrics' },
    { id: 'm-plan', text: 'Review day plan' },
];
const DEFAULT_NIGHT = [
    { id: 'n-phone', text: 'Phone away by 10pm' },
    { id: 'n-skin', text: 'Brush + skincare' },
    { id: 'n-read', text: 'Read 10 min' },
    { id: 'n-journal', text: 'Journal entry' },
    { id: 'n-tomorrow', text: 'Plan tomorrow' },
    { id: 'n-lights', text: 'Lights out by 11pm' },
];
const DEFAULT_BEHAVIORS = [
    { id: 'b-caffeine-late', text: 'Caffeine after 2pm' },
    { id: 'b-alcohol', text: 'Alcohol' },
    { id: 'b-screen-bed', text: 'Screens in bed' },
    { id: 'b-late-meal', text: 'Late meal' },
    { id: 'b-stress', text: 'High stress day' },
];

// ============ APP ============
export default function LifeOS() {
    const [view, setView] = useState('today');
    const [date, setDate] = useState(todayKey());
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [profile, setProfile] = useState({ name: '' });
    const [healthLog, setHealthLog] = useState({});
    const [morningRoutine, setMorningRoutine] = useState(DEFAULT_MORNING);
    const [nightRoutine, setNightRoutine] = useState(DEFAULT_NIGHT);
    const [routineCompletion, setRoutineCompletion] = useState({});
    const [workouts, setWorkouts] = useState({});
    const [programs, setPrograms] = useState([]);
    const [journal, setJournal] = useState({});
    const [prs, setPrs] = useState({});
    const [behaviors, setBehaviors] = useState(DEFAULT_BEHAVIORS);
    const [behaviorLog, setBehaviorLog] = useState({});
    const [symptoms, setSymptoms] = useState([]);
    const [symptomLog, setSymptomLog] = useState({});

    useEffect(() => {
        (async () => {
            const [profileData, healthData, routineItemsData, routineCompletionsData, journalData, behaviorsData, behaviorLogsData, symptomsData, symptomLogsData, workoutsData, programsData, prsData] = await Promise.all([
                loadProfile(),
                loadHealthLogs(),
                loadRoutineItems(),
                loadRoutineCompletions(),
                loadJournal(),
                loadBehaviors(),
                loadBehaviorLogs(),
                loadSymptoms(),
                loadSymptomLogs(),
                loadWorkouts(),
                loadPrograms(),
                loadPRs(),
            ]);
            setProfile(profileData);
            setHealthLog(healthData);
            setMorningRoutine(routineItemsData.morning);
            setNightRoutine(routineItemsData.night);
            setRoutineCompletion(routineCompletionsData);
            setJournal(journalData);
            setBehaviors(behaviorsData);
            setBehaviorLog(behaviorLogsData);
            setSymptoms(symptomsData);
            setSymptomLog(symptomLogsData);
            setWorkouts(workoutsData);
            setPrograms(programsData);
            setPrs(prsData);
            setLoading(false);
        })();
    }, []);

    const saveProfile = (data) => { setProfile(data); saveProfileToDB(data); };

    const saveHealth = (data) => {
        setHealthLog(data);
        for (const date in data) {
            if (JSON.stringify(data[date]) !== JSON.stringify(healthLog[date])) {
                saveHealthLog(date, data[date]);
            }
        }
    };

    const saveMR = async (data) => {
        setMorningRoutine(data);
        const updated = await saveRoutineItems('morning', data);
        setMorningRoutine(updated);
    };
    const saveNR = async (data) => {
        setNightRoutine(data);
        const updated = await saveRoutineItems('night', data);
        setNightRoutine(updated);
    };
    const saveRC = (data) => {
        setRoutineCompletion(data);
        for (const date in data) {
            if (JSON.stringify(data[date]) !== JSON.stringify(routineCompletion[date])) {
                saveRoutineCompletionsForDate(
                    date,
                    data[date].morning || [],
                    data[date].night || [],
                    data[date].skipReasons || {}
                );
            }
        }
    };

    const saveJournal = (data) => {
        setJournal(data);
        for (const date in data) {
            if (JSON.stringify(data[date]) !== JSON.stringify(journal[date])) {
                saveJournalEntry(date, data[date]);
            }
        }
    };

    const saveBehaviors = async (data) => {
        setBehaviors(data);
        const updated = await saveBehaviorsToDB(data);
        setBehaviors(updated);
    };
    const saveBL = (data) => {
        setBehaviorLog(data);
        for (const date in data) {
            if (JSON.stringify(data[date]) !== JSON.stringify(behaviorLog[date])) {
                saveBehaviorLogsForDate(date, data[date] || {});
            }
        }
    };

    const saveSymptoms = async (data) => {
        setSymptoms(data);
        const updated = await saveSymptomsToDB(data);
        setSymptoms(updated);
    };
    const saveSL = (data) => {
        setSymptomLog(data);
        for (const date in data) {
            if (JSON.stringify(data[date]) !== JSON.stringify(symptomLog[date])) {
                saveSymptomLogsForDate(date, data[date] || {});
            }
        }
    };

    const saveWorkouts = async (data) => {
        setWorkouts(data);
        for (const date in data) {
            if (JSON.stringify(data[date]) !== JSON.stringify(workouts[date])) {
                const updated = await saveWorkoutForDate(date, data[date]);
                setWorkouts(prev => ({ ...prev, [date]: updated }));
            }
        }
    };

    const savePrograms = async (data) => {
        setPrograms(data);
        const updated = await saveProgramsToDB(data);
        setPrograms(updated);
    };

    const savePRs = (data) => {
        setPrs(data);
        // Find new/updated PRs
        for (const exerciseName in data) {
            if (JSON.stringify(data[exerciseName]) !== JSON.stringify(prs[exerciseName])) {
                savePR(exerciseName, data[exerciseName]);
            }
        }
        // Find deleted PRs
        for (const exerciseName in prs) {
            if (!(exerciseName in data)) {
                deletePR(exerciseName);
            }
        }
    };

    const baselines = useMemo(() => calcBaselines(healthLog), [healthLog]);

    if (loading) return <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center"><div className="text-zinc-500 text-sm">Loading...</div></div>;

    const props = { date, setDate, profile, saveProfile, healthLog, saveHealth, morningRoutine, saveMR, nightRoutine, saveNR, routineCompletion, saveRC, workouts, saveWorkouts, programs, savePrograms, journal, saveJournal, prs, savePRs, behaviors, saveBehaviors, behaviorLog, saveBL, symptoms, saveSymptoms, symptomLog, saveSL, baselines, setView };

    return (
        <div className="min-h-screen text-zinc-100 font-sans">
            <CircadianBackground />
            <div className="flex min-h-screen">
                <Sidebar view={view} setView={setView} open={sidebarOpen} setOpen={setSidebarOpen} />
                <main className={`flex-1 min-w-0 transition-all duration-200 ${sidebarOpen ? 'md:ml-64' : 'md:ml-14'} pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8`}>
                    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
                        <DateBar date={date} setDate={setDate} view={view} profile={profile} />
                        {view === 'today' && <TodayView {...props} />}
                        {view === 'health' && <HealthView {...props} />}
                        {view === 'routines' && <RoutinesView {...props} />}
                        {view === 'gym' && <GymView {...props} />}
                        {view === 'journal' && <JournalView {...props} />}
                        {view === 'symptoms' && <SymptomsView {...props} />}
                        {view === 'trends' && <TrendsView {...props} />}
                        {view === 'insights' && <InsightsView {...props} />}
                        {view === 'history' && <HistoryView {...props} />}
                        {view === 'settings' && <SettingsView {...props} />}
                    </div>
                </main>
            </div>
            {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
            <button
                onClick={() => setFeedbackOpen(true)}
                className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-4 right-4 z-40 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-full px-4 py-2 text-xs flex items-center gap-2 shadow-lg"
            >
                <MessageSquare size={14} /> Feedback
            </button>
        </div>
    );
}

// ============ CIRCADIAN BACKGROUND ============
// Fixed full-viewport landscape photo behind the entire app. Five images mapped
// to time-of-day; all five stay mounted so we get a true 2-second cross-fade
// via opacity when the hour boundary crosses. Soft overlay sits on top of the
// photo; per-card backdrop-blur handles text readability above that.
const CIRCADIAN_IMAGES = {
    dawn:      '/backgrounds/dawn.jpg',
    morning:   '/backgrounds/morning.jpg',
    afternoon: '/backgrounds/afternoon.jpg',
    evening:   '/backgrounds/evening.jpg',
    night:     '/backgrounds/night.jpg',
} as const;
type CircadianMode = keyof typeof CIRCADIAN_IMAGES;

function modeForHour(h: number): CircadianMode {
    if (h >= 5  && h < 8)  return 'dawn';
    if (h >= 8  && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
}

function CircadianBackground() {
    const [hour, setHour] = useState(() => new Date().getHours());

    useEffect(() => {
        const id = setInterval(() => setHour(new Date().getHours()), 5 * 60 * 1000);
        return () => clearInterval(id);
    }, []);

    // Preload every image so cross-fades aren't blocked on network.
    useEffect(() => {
        Object.values(CIRCADIAN_IMAGES).forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }, []);

    const currentMode = modeForHour(hour);

    return (
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
            {(Object.entries(CIRCADIAN_IMAGES) as [CircadianMode, string][]).map(([mode, src]) => (
                <div
                    key={mode}
                    className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out"
                    style={{
                        backgroundImage: `url(${src})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        opacity: mode === currentMode ? 1 : 0,
                    }}
                />
            ))}
            <div
                className="absolute inset-0"
                style={{
                    background: 'linear-gradient(180deg, rgba(9, 9, 11, 0.35) 0%, rgba(9, 9, 11, 0.45) 50%, rgba(9, 9, 11, 0.55) 100%)',
                }}
            />
        </div>
    );
}

// ============ SIDEBAR ============
function Sidebar({ view, setView, open, setOpen }) {
    const items = [
        { id: 'today', label: 'Today', icon: Home, color: 'text-teal-400' },
        { id: 'health', label: 'Health', icon: Heart, color: 'text-rose-400' },
        { id: 'routines', label: 'Routines', icon: Sun, color: 'text-amber-400' },
        { id: 'gym', label: 'Gym', icon: Dumbbell, color: 'text-orange-400' },
        { id: 'journal', label: 'Journal', icon: BookOpen, color: 'text-purple-400' },
        { id: 'symptoms', label: 'Symptoms', icon: AlertCircle, color: 'text-red-400' },
        { id: 'insights', label: 'Insights', icon: Sparkles, color: 'text-emerald-400' },
        { id: 'settings', label: 'Settings', icon: Settings, color: 'text-zinc-400' },
    ];
    return (
        <>
            <aside className={`hidden md:flex fixed left-0 top-0 bottom-0 ${open ? 'w-64' : 'w-14'} bg-zinc-900/95 backdrop-blur-lg border-r border-zinc-800/60 flex-col p-2 transition-all duration-200 z-40`}>
                <div className="flex items-center justify-between mb-4 px-2 py-2">
                    {open && <div><div className="text-base font-medium">LifeOS</div><div className="text-[10px] text-zinc-500">your life, tracked</div></div>}
                    <button onClick={() => setOpen(!open)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400" title={open ? "Collapse" : "Expand"}>
                        {open ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                    </button>
                </div>
                <nav className="flex flex-col gap-0.5">
                    {items.map(item => {
                        const Icon = item.icon;
                        const active = view === item.id;
                        return (
                            <button key={item.id} onClick={() => setView(item.id)} className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm ${active ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`} title={!open ? item.label : ''}>
                                <Icon size={16} className={`flex-shrink-0 ${item.color}`} />
                                {open && <span>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>
            </aside>
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800/60 z-50 pb-[env(safe-area-inset-bottom)]">
                <div className="flex overflow-x-auto gap-1 px-2 py-1.5 snap-x [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    {items.map(item => {
                        const Icon = item.icon;
                        const active = view === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                className={`flex-shrink-0 snap-start flex flex-col items-center gap-1 min-w-[64px] px-2 py-1.5 rounded-md transition-colors ${active ? 'bg-zinc-800/70' : 'active:bg-zinc-800/40'}`}
                            >
                                <Icon size={18} className={active ? item.color : 'text-zinc-500'} />
                                <span className={`text-[10px] leading-none ${active ? 'text-zinc-100 font-medium' : 'text-zinc-500'}`}>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </>
    );
}

// ============ DATE BAR ============
function DateBar({ date, setDate, view, profile }) {
    if (['insights', 'history', 'settings'].includes(view)) return null;
    const isToday = date === todayKey();
    const shift = (delta) => {
        const d = new Date(date + 'T00:00:00');
        d.setDate(d.getDate() + delta);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setDate(`${y}-${m}-${day}`);
    };
    const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
    return (
        <div className="mb-6">
            {view === 'today' && profile.name && <div className="mb-4"><div className="text-2xl font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{greeting()}, {profile.name}.</div></div>}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <button onClick={() => shift(-1)} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 flex-shrink-0"><ChevronLeft size={18} /></button>
                    <div className="min-w-0">
                        <div className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight truncate drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                            <span className="sm:hidden">{formatDate(date)}</span>
                            <span className="hidden sm:inline">{formatDateLong(date)}</span>
                        </div>
                        {!isToday ? <button onClick={() => setDate(todayKey())} className="text-xs text-zinc-300 hover:text-zinc-100 transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Jump to today</button> : <div className="text-xs text-zinc-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">Today</div>}
                    </div>
                    <button onClick={() => shift(1)} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 flex-shrink-0"><ChevronRight size={18} /></button>
                </div>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-md px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600" />
            </div>
        </div>
    );
}

// ============ TODAY ============
function TodayView({ date, healthLog, morningRoutine, nightRoutine, routineCompletion, journal, saveJournal, behaviors, saveBehaviors, behaviorLog, saveBL, baselines, setView }) {
    const todayRC = routineCompletion[date] || { morning: [], night: [] };
    const todayBL = behaviorLog[date] || {};
    const quote = getQuoteOfTheDay(new Date(date + 'T00:00:00'));

    // Readiness reflects yesterday's recovery
    const yesterdayKey = (() => {
        const d = new Date(date + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    })();
    const yesterdayHealth = healthLog[yesterdayKey] || {};
    const readiness = calcReadiness(yesterdayHealth, baselines);
    const readinessLabel = readiness === null ? '—' : readiness >= 85 ? 'Primed' : readiness >= 70 ? 'Good' : readiness >= 50 ? 'Moderate' : 'Recover';
    const readinessHint = readiness === null ? 'Log your morning metrics to calculate' : readiness >= 80 ? 'Push hard today' : readiness >= 60 ? 'Train normally' : 'Prioritize recovery';
    const readinessColor = readiness === null ? 'text-zinc-600' : readiness >= 80 ? 'text-teal-400' : readiness >= 60 ? 'text-amber-400' : 'text-red-400';

    // Slow reveal of the readiness number on mount.
    const [readinessLoaded, setReadinessLoaded] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setReadinessLoaded(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const morningPct = Math.round((todayRC.morning.length / Math.max(morningRoutine.length, 1)) * 100);
    const nightPct = Math.round((todayRC.night.length / Math.max(nightRoutine.length, 1)) * 100);

    const calcRecentRate = (type) => {
        let hits = 0;
        const list = type === 'morning' ? morningRoutine : nightRoutine;
        if (!list.length) return { hits: 0, total: 14 };
        for (let i = 0; i < 14; i++) {
            const d = new Date(date + 'T00:00:00');
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const k = `${y}-${m}-${day}`;
            if ((routineCompletion[k]?.[type]?.length || 0) >= list.length) hits++;
        }
        return { hits, total: 14 };
    };

    // Daily intention — debounced save into journal[date].intention
    const [intentionDraft, setIntentionDraft] = useState(() => journal[date]?.intention || '');
    const [intentionStatus, setIntentionStatus] = useSaveStatus();
    const intentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        setIntentionDraft(journal[date]?.intention || '');
    }, [date]);
    const onIntentionChange = (v: string) => {
        setIntentionDraft(v);
        setIntentionStatus('saving');
        if (intentionTimer.current) clearTimeout(intentionTimer.current);
        intentionTimer.current = setTimeout(() => {
            const cur = journal[date] || {};
            saveJournal({ ...journal, [date]: { ...cur, intention: v } });
            setIntentionStatus('saved');
        }, 600);
    };

    // Evening reflection — debounced save into journal[date].reflection
    const [reflectionDraft, setReflectionDraft] = useState(() => journal[date]?.reflection || '');
    const [reflectionStatus, setReflectionStatus] = useSaveStatus();
    const reflectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        setReflectionDraft(journal[date]?.reflection || '');
    }, [date]);
    const onReflectionChange = (v: string) => {
        setReflectionDraft(v);
        setReflectionStatus('saving');
        if (reflectionTimer.current) clearTimeout(reflectionTimer.current);
        reflectionTimer.current = setTimeout(() => {
            const cur = journal[date] || {};
            saveJournal({ ...journal, [date]: { ...cur, reflection: v } });
            setReflectionStatus('saved');
        }, 600);
    };

    // Evening reflection only appears after 6pm local time.
    const showEvening = new Date().getHours() >= 18;

    const [behaviorStatus, setBehaviorStatus] = useSaveStatus();
    const toggleBehavior = (id) => {
        setBehaviorStatus('saving');
        const cur = todayBL[id]; const updated = { ...todayBL };
        if (cur === true) updated[id] = false;
        else if (cur === false) delete updated[id];
        else updated[id] = true;
        saveBL({ ...behaviorLog, [date]: updated });
        setTimeout(() => setBehaviorStatus('saved'), 400);
    };

    const [behaviorsEditing, setBehaviorsEditing] = useState(false);
    const [newBehavior, setNewBehavior] = useState('');
    const addBehavior = () => {
        if (!newBehavior.trim()) return;
        saveBehaviors([...behaviors, { id: `b-${Date.now()}`, text: newBehavior.trim() }]);
        setNewBehavior('');
    };

    return (
        <div className="space-y-6 md:space-y-8">
            {/* Quote of the day */}
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-xl p-6">
                <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em] mb-3">Today's reflection</div>
                <blockquote className="text-zinc-100 text-base leading-relaxed italic">"{quote.text}"</blockquote>
                <div className="text-xs md:text-sm text-zinc-300 mt-2">— {quote.author}{quote.context ? <span className="text-zinc-400"> · {quote.context}</span> : null}</div>
            </div>

            {/* Daily intention */}
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-xl p-5">
                <div className="flex items-baseline justify-between mb-3">
                    <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">Today's intention</div>
                    <SaveIndicator status={intentionStatus} />
                </div>
                <input
                    type="text"
                    value={intentionDraft}
                    onChange={(e) => onIntentionChange(e.target.value)}
                    placeholder="What matters most today?"
                    className="w-full bg-transparent italic text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none border-b border-transparent focus:border-zinc-700 transition-colors py-1"
                />
            </div>

            {/* Readiness */}
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">Readiness</div>
                        <div className="flex items-baseline gap-3 mt-1">
                            <div className={`text-5xl font-medium ${readinessColor} transition-opacity duration-[1200ms] ease-out ${readinessLoaded ? 'opacity-100' : 'opacity-0'}`}>{readiness ?? '—'}</div>
                            <div className="text-sm text-zinc-200">{readinessLabel}</div>
                        </div>
                        <div className="text-xs md:text-sm text-zinc-300 mt-2">{readinessHint}</div>
                    </div>
                    <Sparkles className="text-zinc-600" size={24} />
                </div>
            </div>

            {/* Practices (left) + behaviors (right) — 2-col on lg+ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <Card title="Morning practice" subtitle={`${todayRC.morning.length}/${morningRoutine.length} today · ${calcRecentRate('morning').hits} of last 14 days`} action={() => setView('routines')}>
                        <ProgressBar pct={morningPct} color="amber" />
                    </Card>
                    <Card title="Evening practice" subtitle={`${todayRC.night.length}/${nightRoutine.length} today · ${calcRecentRate('night').hits} of last 14 days`} action={() => setView('routines')}>
                        <ProgressBar pct={nightPct} color="purple" />
                    </Card>
                </div>

                {(behaviors.length > 0 || behaviorsEditing) && (
                    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4 h-full">
                        <div className="flex items-baseline justify-between mb-3">
                            <div>
                                <div className="text-sm font-medium">Today's behaviors</div>
                                <div className="text-xs md:text-sm text-zinc-300 mt-0.5">Tap to toggle: ✓ yes · ✗ no · ○ skip</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <SaveIndicator status={behaviorStatus} />
                                <button onClick={() => setBehaviorsEditing(!behaviorsEditing)} className="text-xs text-zinc-500 hover:text-zinc-300">{behaviorsEditing ? 'Done' : 'Edit'}</button>
                            </div>
                        </div>
                        {behaviors.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {behaviors.map(b => {
                                    const v = todayBL[b.id];
                                    const cls = v === true ? 'bg-red-500/20 border-red-500/50 text-red-300' : v === false ? 'bg-teal-500/20 border-teal-500/50 text-teal-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400';
                                    return <button key={b.id} onClick={() => toggleBehavior(b.id)} className={`px-3 py-1.5 rounded-md border text-xs ${cls}`}>{v === true ? '✓' : v === false ? '✗' : '○'} {b.text}</button>;
                                })}
                            </div>
                        )}
                        {behaviorsEditing && (
                            <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1">
                                {behaviors.map(b => (
                                    <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800/50 rounded">
                                        <input value={b.text} onChange={(e) => saveBehaviors(behaviors.map(x => x.id === b.id ? { ...x, text: e.target.value } : x))} className="flex-1 bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-zinc-700" />
                                        <button onClick={() => saveBehaviors(behaviors.filter(x => x.id !== b.id))} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                <div className="flex gap-2 mt-2">
                                    <input value={newBehavior} onChange={(e) => setNewBehavior(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addBehavior(); }} placeholder="Add behavior (e.g. cold shower)..." className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500" />
                                    <button onClick={addBehavior} disabled={!newBehavior.trim()} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 disabled:opacity-40"><Plus size={14} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Evening reflection (only after 6pm local) */}
            {showEvening && (
                <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-xl p-5">
                    <div className="flex items-baseline justify-between mb-3">
                        <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">Evening reflection</div>
                        <SaveIndicator status={reflectionStatus} />
                    </div>
                    <textarea
                        value={reflectionDraft}
                        onChange={(e) => onReflectionChange(e.target.value)}
                        rows={3}
                        placeholder="How was today?"
                        className="w-full bg-transparent text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none border-b border-transparent focus:border-zinc-700 transition-colors py-1"
                    />
                </div>
            )}
        </div>
    );
}

// Animate a numeric value counting up from 0 (or the previous non-numeric state)
// over `duration` ms. Snaps when target transitions number → number.
function useCountUp(target, duration = 600) {
    const [display, setDisplay] = useState(0);
    const prevRef = useRef<number | null>(null);
    useEffect(() => {
        const prev = prevRef.current;
        const isNum = typeof target === 'number' && isFinite(target);
        if (!isNum) {
            prevRef.current = null;
            setDisplay(0);
            return;
        }
        if (typeof prev !== 'number') {
            const start = performance.now();
            let raf = 0;
            const tick = (now: number) => {
                const t = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - t, 3);
                setDisplay(target * eased);
                if (t < 1) raf = requestAnimationFrame(tick);
                else setDisplay(target);
            };
            raf = requestAnimationFrame(tick);
            prevRef.current = target;
            return () => cancelAnimationFrame(raf);
        }
        setDisplay(target);
        prevRef.current = target;
    }, [target, duration]);
    return display;
}

// Mount transition: starts off-state, flips to on-state after first paint so the
// CSS transition (opacity + translate) plays. Used for the stat-card cascade.
function useMountTransition() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);
    return mounted;
}

function StatCard({ label, value, suffix, sub, accent, index = 0 }) {
    const tints = {
        purple: 'bg-purple-500/[0.08] backdrop-blur-md border-purple-500/20 bg-zinc-900/75',
        cyan:   'bg-cyan-500/[0.08] backdrop-blur-md border-cyan-500/20 bg-zinc-900/75',
        rose:   'bg-rose-500/[0.08] backdrop-blur-md border-rose-500/20 bg-zinc-900/75',
        amber:  'bg-amber-500/[0.08] backdrop-blur-md border-amber-500/20 bg-zinc-900/75',
        teal:   'bg-teal-500/[0.08] backdrop-blur-md border-teal-500/20 bg-zinc-900/75',
        zinc:   'bg-zinc-900/85 backdrop-blur-md border-zinc-800/60',
    };
    const tint = tints[accent] || tints.zinc;
    const mounted = useMountTransition();
    const numeric = typeof value === 'number' && isFinite(value) ? value : null;
    const animated = useCountUp(numeric);
    const display = numeric !== null
        ? (Number.isInteger(numeric) ? Math.round(animated) : Math.round(animated * 10) / 10)
        : (value ?? '—');
    return (
        <div
            className={`${tint} border rounded-xl p-5 md:p-6 transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            style={{ transitionDelay: `${index * 50}ms` }}
        >
            <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">{label}</div>
            <div className="flex items-baseline gap-1.5 mt-2">
                <div className="text-3xl md:text-4xl font-semibold text-zinc-50 tabular-nums">{display}</div>
                {suffix && numeric !== null && <span className="text-sm text-zinc-400 font-normal">{suffix}</span>}
            </div>
            {sub && <div className="text-xs text-zinc-300 mt-1.5">{sub}</div>}
        </div>
    );
}

// Pulse the routine checkbox briefly when its checked state toggles.
function RoutineCheckbox({ checked, color }) {
    const cm = {
        amber: { bg: 'bg-amber-500/20', br: 'border-amber-500/60', txt: 'text-amber-400' },
        purple: { bg: 'bg-purple-500/20', br: 'border-purple-500/60', txt: 'text-purple-400' },
    };
    const c = cm[color] || cm.amber;
    const [pulse, setPulse] = useState(false);
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return; }
        setPulse(true);
        const t = setTimeout(() => setPulse(false), 100);
        return () => clearTimeout(t);
    }, [checked]);
    return (
        <div className={`w-4 h-4 rounded border ${checked ? `${c.bg} ${c.br}` : 'border-zinc-600'} flex items-center justify-center flex-shrink-0 transition-transform duration-100 ${pulse ? 'scale-110' : 'scale-100'}`}>
            {checked && <Check size={11} className={c.txt} />}
        </div>
    );
}

// "why skip?" button that fades in smoothly when it mounts (i.e., when the item
// flips from checked back to unchecked).
function SkipButton({ onClick, children }) {
    const mounted = useMountTransition();
    return (
        <button
            onClick={onClick}
            className={`text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded px-2 py-0.5 border border-zinc-800 hover:border-zinc-700 transition-all duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        >
            {children}
        </button>
    );
}
function Card({ title, subtitle, children, action }) {
    return (
        <div onClick={action} className={`bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-xl p-5 md:p-6 transition-all ${action ? 'cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/90' : ''}`}>
            <div className="flex items-baseline justify-between mb-4">
                <div>
                    <div className="text-[15px] font-semibold text-zinc-100">{title}</div>
                    {subtitle && <div className="text-[12px] md:text-[13px] text-zinc-300 mt-1">{subtitle}</div>}
                </div>
            </div>
            {children}
        </div>
    );
}
function ProgressBar({ pct, color = 'teal' }) {
    const c = { amber: 'bg-amber-500', purple: 'bg-purple-500', teal: 'bg-teal-500' };
    return <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full ${c[color]}`} style={{ width: `${pct}%` }} /></div>;
}

// ============ HEALTH ============
function HealthView({ date, healthLog, saveHealth, baselines, profile, saveProfile }) {
    const log = healthLog[date] || {};
    const [saveStatus, setSaveStatus] = useSaveStatus();
    const update = (field, value) => {
        setSaveStatus('saving');
        const updated = { ...healthLog, [date]: { ...log, [field]: value } };
        if (field === 'sleepTime' || field === 'wakeTime') {
            const sleepTime = field === 'sleepTime' ? value : log.sleepTime;
            const wakeTime = field === 'wakeTime' ? value : log.wakeTime;
            const hours = calcSleepHours(sleepTime, wakeTime);
            if (hours !== null) updated[date].sleepHours = hours;
        }
        saveHealth(updated);
        setTimeout(() => setSaveStatus('saved'), 400);
    };
    const readiness = calcReadiness(log, baselines);

    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between">
                <div><h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">Morning log</h2><p className="text-sm md:text-base text-zinc-300 mt-0.5">Daily health check-in</p></div>
                <div className="flex items-center gap-3">
                    <SaveIndicator status={saveStatus} />
                    <div className="flex items-center bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-md p-0.5">
                        {['kg', 'lbs'].map(u => (
                            <button
                                key={u}
                                onClick={() => saveProfile({ ...profile, health_weight_unit: u })}
                                className={`px-2.5 py-1 text-xs rounded ${(profile.health_weight_unit || 'kg') === u ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                {u}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            {readiness !== null && (
                <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm text-zinc-400">Today's readiness</div>
                    <div className={`text-2xl font-medium ${readiness >= 80 ? 'text-teal-400' : readiness >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{readiness}</div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Section title="Sleep">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Sleep time"><input type="time" value={log.sleepTime || ''} onChange={(e) => update('sleepTime', e.target.value)} className="lo-input" /></Field>
                        <Field label="Wake time"><input type="time" value={log.wakeTime || ''} onChange={(e) => update('wakeTime', e.target.value)} className="lo-input" /></Field>
                    </div>
                    <div className="mt-3 p-3 bg-zinc-800/50 rounded-md">
                        <div className="text-xs text-zinc-500">Duration {baselines.sleep && `(avg ${baselines.sleep}h)`}</div>
                        <div className="text-2xl font-medium mt-1">{log.sleepHours ? `${log.sleepHours}h` : '—'}</div>
                    </div>
                </Section>
                <Section title="Heart">
                    <Field label={`RHR (bpm)${baselines.rhr ? ` · avg ${baselines.rhr}` : ''}`}><input type="number" value={log.rhr || ''} onChange={(e) => update('rhr', e.target.value ? Number(e.target.value) : '')} className="lo-input" placeholder="58" /></Field>
                    <Field label={`HRV (ms)${baselines.hrv ? ` · avg ${baselines.hrv}` : ''}`}><input type="number" value={log.hrv || ''} onChange={(e) => update('hrv', e.target.value ? Number(e.target.value) : '')} className="lo-input" placeholder="65" /></Field>
                </Section>
                <Section title="Feeling">
                    <Field label={`Mood (${log.mood || '—'}/10)`}><input type="range" min="1" max="10" value={log.mood || 5} onChange={(e) => update('mood', Number(e.target.value))} className="w-full" /></Field>
                    <Field label={`Energy (${log.energy || '—'}/10)`}><input type="range" min="1" max="10" value={log.energy || 5} onChange={(e) => update('energy', Number(e.target.value))} className="w-full" /></Field>
                    <Field label={`Weight (${profile.health_weight_unit || 'kg'})`}>
                        <input
                            type="number"
                            step="0.1"
                            value={log.weight || ''}
                            onChange={(e) => update('weight', e.target.value ? Number(e.target.value) : '')}
                            className="lo-input"
                            placeholder="—"
                        />
                    </Field>
                </Section>
                <Section title="Notes">
                    <textarea value={log.notes || ''} onChange={(e) => update('notes', e.target.value)} rows={6} placeholder="How did you sleep? Anything affecting today?" className="w-full bg-zinc-800/50 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none" />
                </Section>
            </div>
            <style>{`.lo-input { width: 100%; background: rgb(39 39 42 / 0.5); border: 1px solid rgb(63 63 70); border-radius: 6px; padding: 8px 12px; font-size: 14px; color: rgb(228 228 231); outline: none; } .lo-input:focus { border-color: rgb(113 113 122); }`}</style>
        </div>
    );
}

function Section({ title, children }) { return <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4 md:p-6"><h3 className="text-sm md:text-lg font-medium mb-3">{title}</h3><div className="space-y-3">{children}</div></div>; }
function Field({ label, children }) { return <div><label className="block text-xs text-zinc-500 mb-1.5">{label}</label>{children}</div>; }

// ============ ROUTINES ============
function RoutinesView({ date, morningRoutine, saveMR, nightRoutine, saveNR, routineCompletion, saveRC }) {
    const [skipMenuFor, setSkipMenuFor] = useState(null);
    const todaySkipReasons = (routineCompletion[date]?.skipReasons) || {};

    const setSkipReason = (itemId, reason) => {
        const current = routineCompletion[date] || { morning: [], night: [], skipReasons: {} };
        const updatedReasons = { ...todaySkipReasons };
        if (reason) {
            updatedReasons[itemId] = reason;
        } else {
            delete updatedReasons[itemId];
        }
        saveRC({ ...routineCompletion, [date]: { ...current, skipReasons: updatedReasons } });
        setSkipMenuFor(null);
    };

    const SKIP_REASONS = [
        { id: 'sick', label: '🤒 Sick' },
        { id: 'travel', label: '🌍 Travel' },
        { id: 'busy', label: '🏃 Busy' },
        { id: 'tired', label: '😴 Tired' },
        { id: 'forgot', label: '🤷 Forgot' },
        { id: 'rest', label: '🛌 Rest day' },
    ];

    return (
        <div className="space-y-5">
            <div><h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">Routines</h2><p className="text-sm md:text-base text-zinc-300 mt-0.5">Edit your morning & night checklists</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <RoutineEditor
                    title="Morning"
                    icon={Sun}
                    color="amber"
                    items={morningRoutine}
                    saveItems={saveMR}
                    completed={routineCompletion[date]?.morning || []}
                    onToggle={(id) => {
                        console.log('Toggling. App date is:', date, '· todayKey is:', todayKey());
                        const day = routineCompletion[date] || { morning: [], night: [], skipReasons: {} };
                        const morning = (day.morning || []).includes(id)
                            ? day.morning.filter(x => x !== id)
                            : [...(day.morning || []), id];
                        saveRC({ ...routineCompletion, [date]: { ...day, morning } });
                    }}
                    skipReasons={todaySkipReasons}
                    onSetSkipReason={setSkipReason}
                    skipMenuFor={skipMenuFor}
                    setSkipMenuFor={setSkipMenuFor}
                    skipReasonOptions={SKIP_REASONS}
                />
                <RoutineEditor
                    title="Night"
                    icon={Moon}
                    color="purple"
                    items={nightRoutine}
                    saveItems={saveNR}
                    completed={routineCompletion[date]?.night || []}
                    onToggle={(id) => {
                        const day = routineCompletion[date] || { morning: [], night: [], skipReasons: {} };
                        const night = (day.night || []).includes(id)
                            ? day.night.filter(x => x !== id)
                            : [...(day.night || []), id];
                        saveRC({ ...routineCompletion, [date]: { ...day, night } });
                    }}
                    skipReasons={todaySkipReasons}
                    onSetSkipReason={setSkipReason}
                    skipMenuFor={skipMenuFor}
                    setSkipMenuFor={setSkipMenuFor}
                    skipReasonOptions={SKIP_REASONS}
                />
            </div>
        </div>
    );
}

function RoutineEditor({ title, icon: Icon, color, items, saveItems, completed, onToggle, skipReasons = {}, onSetSkipReason, skipMenuFor, setSkipMenuFor, skipReasonOptions = [] }) {
    const [editing, setEditing] = useState(false);
    const [newText, setNewText] = useState('');
    const [draft, setDraft] = useState(items);  // local copy for smooth editing
    const cm = { amber: { txt: 'text-amber-400', bg: 'bg-amber-500/20', br: 'border-amber-500/60' }, purple: { txt: 'text-purple-400', bg: 'bg-purple-500/20', br: 'border-purple-500/60' } };
    const c = cm[color];

    // When entering edit mode, snapshot the current items into draft
    // When exiting edit mode, push draft back to parent (which saves to Supabase)
    const startEdit = () => { setDraft(items); setEditing(true); };
    const [saveStatus, setSaveStatus] = useSaveStatus();
    const finishEdit = () => {
        setEditing(false);
        if (JSON.stringify(draft) !== JSON.stringify(items)) {
            setSaveStatus('saving');
            saveItems(draft);
            setTimeout(() => setSaveStatus('saved'), 400);
        }
    };

    const list = editing ? draft : items;
    const updateDraft = (newDraft) => setDraft(newDraft);

    const addItem = () => {
        if (!newText.trim()) return;
        updateDraft([...draft, { id: `tmp-${Date.now()}`, text: newText.trim() }]);
        setNewText('');
    };
    const move = (idx, dir) => {
        const ni = [...draft]; const t = idx + dir;
        if (t < 0 || t >= ni.length) return;
        [ni[idx], ni[t]] = [ni[t], ni[idx]];
        updateDraft(ni);
    };

    return (
        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Icon size={16} className={c.txt} /><h3 className="text-sm font-medium">{title}</h3><span className="text-xs text-zinc-500">({completed.length}/{list.length})</span></div>
                <div className="flex items-center gap-3">
                    <SaveIndicator status={saveStatus} />
                    <button onClick={editing ? finishEdit : startEdit} className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded">{editing ? 'Done' : 'Edit'}</button>
                </div>
            </div>
            <div className="space-y-1">
                {list.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                        {editing ? (
                            <>
                                <div className="flex flex-col text-zinc-600">
                                    <button onClick={() => move(idx, -1)} disabled={idx === 0} className="hover:text-zinc-400 disabled:opacity-30 leading-none text-xs">▲</button>
                                    <button onClick={() => move(idx, 1)} disabled={idx === list.length - 1} className="hover:text-zinc-400 disabled:opacity-30 leading-none text-xs">▼</button>
                                </div>
                                <input value={item.text} onChange={(e) => updateDraft(draft.map(i => i.id === item.id ? { ...i, text: e.target.value } : i))} className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-500" />
                                <button onClick={() => updateDraft(draft.filter(i => i.id !== item.id))} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                            </>
                        ) : (
                            <div className="w-full">
                                <div className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-zinc-800/50 group">
                                    <button onClick={() => onToggle(item.id)} className="flex items-center gap-3 flex-1 text-left">
                                        <RoutineCheckbox checked={completed.includes(item.id)} color={color} />
                                        <span className={`text-sm md:text-base ${completed.includes(item.id) ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{item.text}</span>
                                        {skipReasons[item.id] && !completed.includes(item.id) && (
                                            <span className="text-xs text-zinc-500 ml-2">{skipReasonOptions.find(r => r.id === skipReasons[item.id])?.label || skipReasons[item.id]}</span>
                                        )}
                                    </button>
                                    {!completed.includes(item.id) && setSkipMenuFor && (
                                        <SkipButton onClick={() => setSkipMenuFor(skipMenuFor?.itemId === item.id ? null : { itemId: item.id })}>
                                            {skipReasons[item.id] ? 'change' : 'why skip?'}
                                        </SkipButton>
                                    )}
                                </div>
                                {skipMenuFor?.itemId === item.id && !completed.includes(item.id) && (
                                    <div className="ml-7 mt-1 mb-2 flex flex-wrap gap-1.5">
                                        {skipReasonOptions.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => {
                                                    onSetSkipReason(item.id, r.id);
                                                    setSkipMenuFor(null);
                                                }}
                                                className={`text-xs px-2 py-1 rounded border ${skipReasons[item.id] === r.id ? 'bg-zinc-700 border-zinc-600 text-zinc-100' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                        {skipReasons[item.id] && (
                                            <button
                                                onClick={() => {
                                                    onSetSkipReason(item.id, null);
                                                    setSkipMenuFor(null);
                                                }}
                                                className="text-xs px-2 py-1 rounded border bg-zinc-800 border-zinc-700 text-rose-400 hover:bg-zinc-700"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {editing && (
                <div className="mt-3 flex gap-2">
                    <input value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} placeholder="Add item..." className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-500" />
                    <button onClick={addItem} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700"><Plus size={14} /></button>
                </div>
            )}
        </div>
    );
}

// ============ GYM ============
function GymView({ date, workouts, saveWorkouts, programs, savePrograms, prs, savePRs, profile, saveProfile }) {
    const [tab, setTab] = useState('today');
    const [exerciseDrafts, setExerciseDrafts] = useState({});  // local edits keyed by exercise id
    const workout = workouts[date] || { exercises: [], notes: '' };

    const getLastSession = (name) => {
        if (!name) return null;
        const sd = Object.keys(workouts).filter(d => d < date).sort().reverse();
        for (const d of sd) {
            const ex = workouts[d].exercises?.find(e => e.name === name && e.sets?.some(s => s.weight || s.reps));
            if (ex) return { date: d, sets: ex.sets };
        }
        return null;
    };

    const addExercise = (name = '') => {
        const ex = { id: `tmp-${Date.now()}`, name, sets: [{ reps: '', weight: '' }] };
        saveWorkouts({ ...workouts, [date]: { ...workout, exercises: [...workout.exercises, ex] } });
    };
    const updateExercise = (idx, u) => {
        const exs = [...workout.exercises]; exs[idx] = { ...exs[idx], ...u };
        saveWorkouts({ ...workouts, [date]: { ...workout, exercises: exs } });
    };
    const deleteExercise = (idx) => saveWorkouts({ ...workouts, [date]: { ...workout, exercises: workout.exercises.filter((_, i) => i !== idx) } });
    const addSet = (exIdx) => {
        const exs = [...workout.exercises];
        const last = exs[exIdx].sets[exs[exIdx].sets.length - 1];
        exs[exIdx].sets.push({ reps: last?.reps || '', weight: last?.weight || '' });
        saveWorkouts({ ...workouts, [date]: { ...workout, exercises: exs } });
    };
    const updateSet = (exIdx, setIdx, field, value) => {
        const exs = [...workout.exercises];
        exs[exIdx].sets[setIdx][field] = value;
        saveWorkouts({ ...workouts, [date]: { ...workout, exercises: exs } });
        if (field === 'weight' && value) {
            const w = Number(value); const exName = exs[exIdx].name;
            if (exName && (!prs[exName] || w > prs[exName].weight)) {
                const reps = exs[exIdx].sets[setIdx].reps;
                savePRs({ ...prs, [exName]: { weight: w, reps: Number(reps) || 1, date } });
            }
        }
    };
    const deleteSet = (exIdx, setIdx) => {
        const exs = [...workout.exercises];
        exs[exIdx].sets = exs[exIdx].sets.filter((_, i) => i !== setIdx);
        saveWorkouts({ ...workouts, [date]: { ...workout, exercises: exs } });
    };
    const loadProgram = (program) => {
        const exs = program.exercises.map(e => ({
            id: `tmp-${Date.now()}-${Math.random()}`,
            name: e.name,
            sets: Array(e.targetSets || 3).fill(0).map(() => ({ reps: e.targetReps || '', weight: '' })),
        }));
        saveWorkouts({ ...workouts, [date]: { ...workout, exercises: [...workout.exercises, ...exs], programId: program.id } });
    };

    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between">
                <div><h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">Gym</h2><p className="text-sm md:text-base text-zinc-300 mt-0.5">Workouts, programs, PRs</p></div>
                <div className="flex items-center bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-md p-0.5">
                    {['kg', 'lbs'].map(u => (
                        <button
                            key={u}
                            onClick={() => saveProfile({ ...profile, gym_weight_unit: u })}
                            className={`px-2.5 py-1 text-xs rounded ${(profile.gym_weight_unit || 'lbs') === u ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {u}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex gap-1 border-b border-zinc-800">
                {[{ id: 'today', label: "Today's workout" }, { id: 'programs', label: 'Programs' }, { id: 'prs', label: 'PRs' }].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 text-sm border-b-2 ${tab === t.id ? 'border-teal-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>{t.label}</button>
                ))}
            </div>

            {tab === 'today' && (
                <div className="space-y-3">
                    {programs.length > 0 && workout.exercises.length === 0 && (
                        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                            <div className="text-xs text-zinc-500 mb-2">Quick start from program:</div>
                            <div className="flex flex-wrap gap-2">{programs.map(p => <button key={p.id} onClick={() => loadProgram(p)} className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm hover:bg-zinc-700">{p.name}</button>)}</div>
                        </div>
                    )}
                    {workout.exercises.map((ex, exIdx) => {
                        const last = getLastSession(ex.name);
                        const oneRM = ex.sets.reduce((max, s) => { const r = calc1RM(s.weight, s.reps); return r > max ? r : max; }, 0);
                        return (
                            <div key={ex.id} className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        value={exerciseDrafts[ex.id] ?? ex.name}
                                        onChange={(e) => setExerciseDrafts({ ...exerciseDrafts, [ex.id]: e.target.value })}
                                        onBlur={() => {
                                            const newName = exerciseDrafts[ex.id];
                                            if (newName !== undefined && newName !== ex.name) {
                                                updateExercise(exIdx, { name: newName });
                                            }
                                            const { [ex.id]: _, ...rest } = exerciseDrafts;
                                            setExerciseDrafts(rest);
                                        }}
                                        placeholder="Exercise name"
                                        className="flex-1 bg-transparent border-b border-zinc-700 px-1 py-1 text-base font-medium focus:outline-none focus:border-zinc-500"
                                    />
                                    <button onClick={() => deleteExercise(exIdx)} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={16} /></button>
                                </div>
                                {last && (
                                    <div className="mb-3 px-2.5 py-1.5 bg-zinc-800/40 rounded text-xs text-zinc-400 flex items-center gap-2">
                                        <Calendar size={11} className="text-zinc-500" />
                                        <span className="text-zinc-500">Last ({formatDate(last.date)}):</span>
                                        <span className="font-mono">{last.sets.map(s => `${s.reps || '—'}×${s.weight || '—'}${s.weight ? ' ' + (profile.gym_weight_unit || 'lbs') : ''}`).join(' · ')}</span>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <div className="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 px-2 uppercase tracking-wide"><div className="col-span-2">Set</div><div className="col-span-4">Reps</div><div className="col-span-5">Weight ({profile.gym_weight_unit || 'lbs'})</div><div className="col-span-1"></div></div>
                                    {ex.sets.map((set, setIdx) => (
                                        <div key={setIdx} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-2 text-sm text-zinc-400 px-2">{setIdx + 1}</div>
                                            <input
                                                type="number"
                                                defaultValue={set.reps}
                                                onBlur={(e) => { if (e.target.value !== String(set.reps)) updateSet(exIdx, setIdx, 'reps', e.target.value); }}
                                                className="col-span-4 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
                                                placeholder="—"
                                            />
                                            <input
                                                type="number"
                                                step="0.5"
                                                defaultValue={set.weight}
                                                onBlur={(e) => { if (e.target.value !== String(set.weight)) updateSet(exIdx, setIdx, 'weight', e.target.value); }}
                                                className="col-span-5 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-500"
                                                placeholder="—"
                                            />
                                            <button onClick={() => deleteSet(exIdx, setIdx)} className="col-span-1 text-zinc-600 hover:text-red-400"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <button onClick={() => addSet(exIdx)} className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"><Plus size={12} /> Add set</button>
                                    <div className="flex gap-3 text-xs text-zinc-500">
                                        {oneRM > 0 && <span>est. 1RM: <span className="text-zinc-300">{oneRM} {profile.gym_weight_unit || 'lbs'}</span></span>}
                                        {ex.name && prs[ex.name] && <span className="text-amber-400 flex items-center gap-1"><Award size={11} /> {prs[ex.name].weight}×{prs[ex.name].reps} {profile.gym_weight_unit || 'lbs'}</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <button onClick={() => addExercise()} className="w-full bg-zinc-900/80 backdrop-blur-md border border-dashed border-zinc-700/60 rounded-lg py-3 text-sm text-zinc-400 hover:bg-zinc-800/50 flex items-center justify-center gap-2"><Plus size={16} /> Add exercise</button>
                    <Section title="Workout notes">
                        <textarea
                            key={date}
                            defaultValue={workout.notes || ''}
                            onBlur={(e) => { if (e.target.value !== (workout.notes || '')) saveWorkouts({ ...workouts, [date]: { ...workout, notes: e.target.value } }); }}
                            rows={3}
                            placeholder="How did it feel?"
                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
                        />
                    </Section>
                </div>
            )}
            {tab === 'programs' && <ProgramsTab programs={programs} savePrograms={savePrograms} />}
            {tab === 'prs' && <PRsTab prs={prs} savePRs={savePRs} />}
        </div>
    );
}
function ProgramsTab({ programs, savePrograms }) {
    const [draft, setDraft] = useState(programs);

    // Re-sync local draft when parent state changes (e.g. after save returns new UUIDs)
    React.useEffect(() => { setDraft(programs); }, [programs]);

    // Push the current draft to the parent (which saves to Supabase)
    const commit = () => {
        if (JSON.stringify(draft) !== JSON.stringify(programs)) {
            savePrograms(draft);
        }
    };

    const updateProgram = (id, u) => setDraft(draft.map(p => p.id === id ? { ...p, ...u } : p));

    return (
        <div className="space-y-3">
            {draft.map(p => (
                <div key={p.id} className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <input
                            value={p.name}
                            onChange={(e) => updateProgram(p.id, { name: e.target.value })}
                            onBlur={commit}
                            className="bg-transparent text-base font-medium focus:outline-none border-b border-transparent focus:border-zinc-700"
                        />
                        <button onClick={() => { const next = draft.filter(x => x.id !== p.id); setDraft(next); savePrograms(next); }} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                    </div>
                    <div className="space-y-1.5">
                        {p.exercises.map((ex, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2">
                                <input value={ex.name} onChange={(e) => { const exs = [...p.exercises]; exs[idx].name = e.target.value; updateProgram(p.id, { exercises: exs }); }} onBlur={commit} placeholder="Exercise" className="col-span-6 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-500" />
                                <input type="number" value={ex.targetSets || ''} onChange={(e) => { const exs = [...p.exercises]; exs[idx].targetSets = Number(e.target.value); updateProgram(p.id, { exercises: exs }); }} onBlur={commit} placeholder="Sets" className="col-span-2 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-500" />
                                <input type="number" value={ex.targetReps || ''} onChange={(e) => { const exs = [...p.exercises]; exs[idx].targetReps = Number(e.target.value); updateProgram(p.id, { exercises: exs }); }} onBlur={commit} placeholder="Reps" className="col-span-3 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-zinc-500" />
                                <button onClick={() => { const exs = p.exercises.filter((_, i) => i !== idx); const next = draft.map(x => x.id === p.id ? { ...x, exercises: exs } : x); setDraft(next); savePrograms(next); }} className="col-span-1 text-zinc-500 hover:text-red-400"><X size={14} /></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => { const next = draft.map(x => x.id === p.id ? { ...x, exercises: [...x.exercises, { name: '', targetSets: 3, targetReps: 10 }] } : x); setDraft(next); savePrograms(next); }} className="mt-2 text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"><Plus size={12} /> Add exercise</button>
                </div>
            ))}
            <button onClick={() => { const next = [...draft, { id: `tmp-${Date.now()}`, name: 'New Program', exercises: [] }]; setDraft(next); savePrograms(next); }} className="w-full bg-zinc-900/80 backdrop-blur-md border border-dashed border-zinc-700/60 rounded-lg py-3 text-sm text-zinc-400 hover:bg-zinc-800/50 flex items-center justify-center gap-2"><Plus size={16} /> New program</button>
        </div>
    );
}

function PRsTab({ prs, savePRs }) {
    const entries = Object.entries(prs).sort((a, b) => b[1].weight - a[1].weight);
    if (!entries.length) return <div className="text-center text-zinc-500 py-8 text-sm">No PRs yet. Log workouts and your maxes will appear here.</div>;

    const handleDelete = (name) => {
        if (!confirm(`Delete PR for ${name}?`)) return;
        const { [name]: _, ...rest } = prs;
        savePRs(rest);
    };

    const updateField = (name, field, value) => {
        const cur = prs[name];
        const next = { ...cur, [field]: value };
        if (JSON.stringify(next) === JSON.stringify(cur)) return;
        savePRs({ ...prs, [name]: next });
    };

    return (
        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-zinc-800/50"><tr className="text-left text-xs text-zinc-500"><th className="px-4 py-2.5 font-normal">Exercise</th><th className="px-4 py-2.5 font-normal">Weight</th><th className="px-4 py-2.5 font-normal">Reps</th><th className="px-4 py-2.5 font-normal">Est. 1RM</th><th className="px-4 py-2.5 font-normal">Date</th><th className="px-4 py-2.5 font-normal w-10"></th></tr></thead>
                <tbody>
                    {entries.map(([name, pr]) => (
                        <tr key={name} className="border-t border-zinc-800 group">
                            <td className="px-4 py-2.5 font-medium">{name}</td>
                            <td className="px-2 py-1">
                                <input
                                    type="number"
                                    step="0.5"
                                    defaultValue={pr.weight}
                                    onBlur={(e) => updateField(name, 'weight', Number(e.target.value))}
                                    className="w-20 bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-500 rounded px-2 py-1 text-amber-400 focus:outline-none focus:bg-zinc-800"
                                />
                            </td>
                            <td className="px-2 py-1">
                                <input
                                    type="number"
                                    defaultValue={pr.reps}
                                    onBlur={(e) => updateField(name, 'reps', Number(e.target.value) || 1)}
                                    className="w-16 bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-500 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:bg-zinc-800"
                                />
                            </td>
                            <td className="px-4 py-2.5 text-zinc-400">{calc1RM(pr.weight, pr.reps) || '—'}</td>
                            <td className="px-2 py-1">
                                <input
                                    type="date"
                                    defaultValue={pr.date}
                                    onBlur={(e) => updateField(name, 'date', e.target.value)}
                                    className="bg-transparent border border-transparent hover:border-zinc-700 focus:border-zinc-500 rounded px-2 py-1 text-zinc-400 text-xs focus:outline-none focus:bg-zinc-800"
                                />
                            </td>
                            <td className="px-4 py-2.5">
                                <button onClick={() => handleDelete(name)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ============ JOURNAL ============
function JournalView({ date, setDate, journal, saveJournal }) {
    const [search, setSearch] = useState('');
    const [saveStatus, setSaveStatus] = useSaveStatus();
    const entry = journal[date] || { text: '', mood: null };
    const update = (field, value) => {
        setSaveStatus('saving');
        saveJournal({ ...journal, [date]: { ...entry, [field]: value } });
        // small delay so the user actually sees "Saving" before "Saved"
        setTimeout(() => setSaveStatus('saved'), 400);
    };
    const all = Object.entries(journal).filter(([_, e]) => e.text).sort((a, b) => b[0].localeCompare(a[0]));
    const filtered = search ? all.filter(([_, e]) => e.text.toLowerCase().includes(search.toLowerCase())) : all;
    return (
        <div className="space-y-5">
            <div><h2 className="text-xl md:text-3xl font-medium">Journal</h2><p className="text-sm md:text-base text-zinc-300">Free writing, mood, history</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-xs text-zinc-500">Mood</div>
                            <div className="flex gap-1">{['😞', '😕', '😐', '🙂', '😊'].map((emoji, i) => <button key={i} onClick={() => update('mood', i + 1)} className={`w-9 h-9 rounded-md text-lg ${entry.mood === i + 1 ? 'bg-zinc-700 scale-110' : 'hover:bg-zinc-800'}`}>{emoji}</button>)}</div>
                        </div>
                        <textarea value={entry.text} onChange={(e) => update('text', e.target.value)} rows={14} placeholder="What's on your mind?" className="w-full bg-transparent text-zinc-200 text-sm leading-relaxed focus:outline-none resize-none" />
                        {entry.text && <div className="text-xs text-zinc-600 mt-2">{entry.text.length} chars · {entry.text.split(/\s+/).filter(Boolean).length} words</div>}
                        <div className="mt-1"><SaveIndicator status={saveStatus} /></div>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-3">
                        <div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries..." className="w-full bg-zinc-800 border border-zinc-700 rounded pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500" /></div>
                    </div>
                    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                        <div className="text-xs text-zinc-500 px-3 py-2 border-b border-zinc-800">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</div>
                        {filtered.length === 0 ? <div className="text-xs text-zinc-600 px-3 py-4 text-center">No entries yet</div> :
                            filtered.map(([d, e]) => (
                                <button key={d} onClick={() => setDate(d)} className={`w-full text-left px-3 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/50 ${d === date ? 'bg-zinc-800/30' : ''}`}>
                                    <div className="flex items-center justify-between"><div className="text-xs text-zinc-300">{formatDate(d)}</div>{e.mood && <div className="text-sm">{['😞', '😕', '😐', '🙂', '😊'][e.mood - 1]}</div>}</div>
                                    <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{e.text}</div>
                                </button>
                            ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============ SYMPTOMS ============
function SymptomsView({ date, symptoms, saveSymptoms, symptomLog, saveSL }) {
    const [newName, setNewName] = useState('');
    const todayLog = symptomLog[date] || {};
    const [saveStatus, setSaveStatus] = useSaveStatus();
    const addSymptom = () => { if (!newName.trim()) return; saveSymptoms([...symptoms, { id: `s-${Date.now()}`, name: newName.trim() }]); setNewName(''); };
    const setSeverity = (id, severity) => {
        setSaveStatus('saving');
        saveSL({ ...symptomLog, [date]: { ...todayLog, [id]: severity } });
        setTimeout(() => setSaveStatus('saved'), 400);
    };
    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between">
                <div><h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">Symptoms</h2><p className="text-sm md:text-base text-zinc-300 mt-0.5">Track headaches, anxiety, pain — anything affecting you</p></div>
                <SaveIndicator status={saveStatus} />
            </div>
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                <div className="text-xs text-zinc-500 mb-3">Today's severity (0 = none, 5 = severe)</div>
                {symptoms.length === 0 ? <div className="text-sm text-zinc-500 text-center py-6">No symptoms tracked yet. Add one below.</div> : (
                    <div className="space-y-3">
                        {symptoms.map(s => {
                            const sev = todayLog[s.id] ?? 0;
                            return (
                                <div key={s.id} className="flex items-center gap-3">
                                    <div className="text-sm text-zinc-200 flex-1">{s.name}</div>
                                    <div className="flex gap-1">{[0, 1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setSeverity(s.id, n)} className={`w-8 h-8 rounded text-xs font-medium ${sev === n ? n === 0 ? 'bg-teal-500/30 text-teal-300' : n <= 2 ? 'bg-amber-500/30 text-amber-300' : 'bg-red-500/30 text-red-300' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>{n}</button>)}</div>
                                    <button onClick={() => saveSymptoms(symptoms.filter(x => x.id !== s.id))} className="text-zinc-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="mt-4 flex gap-2">
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSymptom()} placeholder="Add symptom (e.g. headache, anxiety, joint pain)..." className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
                    <button onClick={addSymptom} className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700"><Plus size={14} /></button>
                </div>
            </div>
        </div>
    );
}

// ============ TRENDS ============
function TrendsView({ healthLog, journal, behaviorLog, behaviors, baselines }) {
    const [range, setRange] = useState(30);
    const [compareMetrics, setCompareMetrics] = useState(['sleep', 'readiness', 'hrv']);
    const dates = [];
    for (let i = range - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dates.push(d.toISOString().split('T')[0]); }
    const sleepData = dates.map(d => ({ date: d.slice(5), sleep: healthLog[d]?.sleepHours || null, mood: healthLog[d]?.mood || null, energy: healthLog[d]?.energy || null, readiness: calcReadiness(healthLog[d], baselines) }));
    const heartData = dates.map(d => ({ date: d.slice(5), rhr: healthLog[d]?.rhr || null, hrv: healthLog[d]?.hrv || null }));
    const avg = (arr) => { const f = arr.filter(x => x !== null && !isNaN(x)); return f.length ? Math.round((f.reduce((a, b) => a + Number(b), 0) / f.length) * 10) / 10 : null; };

    const pixelDays = [];
    for (let i = 364; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = d.toISOString().split('T')[0];
        pixelDays.push({ date: k, mood: healthLog[k]?.mood || journal[k]?.mood });
    }

    const correlations = behaviors.map(b => {
        const yes = [], no = [];
        Object.entries(behaviorLog).forEach(([d, log]) => {
            const r = calcReadiness(healthLog[d], baselines);
            if (r === null) return;
            if (log[b.id] === true) yes.push(r);
            else if (log[b.id] === false) no.push(r);
        });
        if (yes.length < 3 || no.length < 3) return { ...b, sample: yes.length + no.length, insufficient: true };
        const aYes = avg(yes), aNo = avg(no);
        return { ...b, yesAvg: aYes, noAvg: aNo, diff: Math.round((aYes - aNo) * 10) / 10, sample: yes.length + no.length };
    });

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div><h2 className="text-xl md:text-3xl font-medium">Trends</h2><p className="text-sm md:text-base text-zinc-300">Patterns over time</p></div>
                <div className="flex gap-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-md p-1">{[7, 30, 90].map(n => <button key={n} onClick={() => setRange(n)} className={`px-3 py-1 text-xs rounded ${range === n ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}>{n}d</button>)}</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox label="Avg sleep" value={avg(sleepData.map(d => d.sleep)) ? `${avg(sleepData.map(d => d.sleep))}h` : '—'} />
                <StatBox label="Avg HRV" value={avg(heartData.map(d => d.hrv)) ? `${avg(heartData.map(d => d.hrv))}ms` : '—'} />
                <StatBox label="Avg RHR" value={avg(heartData.map(d => d.rhr)) ? `${avg(heartData.map(d => d.rhr))}bpm` : '—'} />
                <StatBox label="Avg readiness" value={avg(sleepData.map(d => d.readiness)) || '—'} />
            </div>
            <ChartCard title="Compare metrics">
                <div className="flex flex-wrap gap-2 mb-4">
                    {[
                        { id: 'sleep', label: 'Sleep (h)', color: '#a78bfa', axis: 'left' },
                        { id: 'readiness', label: 'Readiness', color: '#2dd4bf', axis: 'left' },
                        { id: 'mood', label: 'Mood', color: '#fbbf24', axis: 'left' },
                        { id: 'energy', label: 'Energy', color: '#f97316', axis: 'left' },
                        { id: 'hrv', label: 'HRV (ms)', color: '#22d3ee', axis: 'right' },
                        { id: 'rhr', label: 'RHR (bpm)', color: '#f472b6', axis: 'right' },
                    ].map(m => {
                        const active = compareMetrics.includes(m.id);
                        return (
                            <button
                                key={m.id}
                                onClick={() => setCompareMetrics(active ? compareMetrics.filter(x => x !== m.id) : [...compareMetrics, m.id])}
                                className={`px-3 py-1.5 rounded-md border text-xs transition-colors`}
                                style={{
                                    backgroundColor: active ? m.color + '20' : 'transparent',
                                    borderColor: active ? m.color + '80' : '#3f3f46',
                                    color: active ? m.color : '#a1a1aa',
                                }}
                            >
                                {m.label}
                            </button>
                        );
                    })}
                </div>
                {compareMetrics.length === 0 ? (
                    <div className="text-sm text-zinc-500 text-center py-12">Toggle one or more metrics above to chart them.</div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={sleepData.map((d, i) => ({ ...d, hrv: heartData[i].hrv, rhr: heartData[i].rhr }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                            <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                            <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                            <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} />
                            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 6, fontSize: 12 }} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {compareMetrics.includes('sleep') && <Line yAxisId="left" type="monotone" dataKey="sleep" stroke="#a78bfa" strokeWidth={2} dot={false} name="Sleep (h)" connectNulls />}
                            {compareMetrics.includes('readiness') && <Line yAxisId="left" type="monotone" dataKey="readiness" stroke="#2dd4bf" strokeWidth={2} dot={false} name="Readiness" connectNulls />}
                            {compareMetrics.includes('mood') && <Line yAxisId="left" type="monotone" dataKey="mood" stroke="#fbbf24" strokeWidth={2} dot={false} name="Mood" connectNulls />}
                            {compareMetrics.includes('energy') && <Line yAxisId="left" type="monotone" dataKey="energy" stroke="#f97316" strokeWidth={2} dot={false} name="Energy" connectNulls />}
                            {compareMetrics.includes('hrv') && <Line yAxisId="right" type="monotone" dataKey="hrv" stroke="#22d3ee" strokeWidth={2} dot={false} name="HRV (ms)" connectNulls />}
                            {compareMetrics.includes('rhr') && <Line yAxisId="right" type="monotone" dataKey="rhr" stroke="#f472b6" strokeWidth={2} dot={false} name="RHR (bpm)" connectNulls />}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </ChartCard>
            <ChartCard title="Sleep & readiness">
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={sleepData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={11} /><YAxis yAxisId="left" stroke="#71717a" fontSize={11} domain={[0, 12]} /><YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 6, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line yAxisId="left" type="monotone" dataKey="sleep" stroke="#a78bfa" strokeWidth={2} dot={false} name="Sleep (h)" connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="readiness" stroke="#2dd4bf" strokeWidth={2} dot={false} name="Readiness" connectNulls />
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Heart metrics">
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={heartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={11} /><YAxis yAxisId="left" stroke="#71717a" fontSize={11} /><YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 6, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line yAxisId="left" type="monotone" dataKey="hrv" stroke="#2dd4bf" strokeWidth={2} dot={false} name="HRV (ms)" connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="rhr" stroke="#f472b6" strokeWidth={2} dot={false} name="RHR (bpm)" connectNulls />
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Year in mood">
                <YearInPixels days={pixelDays} />
            </ChartCard>

            <ChartCard title="Behavior impact on readiness">
                <div className="text-xs text-zinc-500 mb-3">Avg readiness on yes vs no days. Need 3+ each side.</div>
                {correlations.every(c => c.insufficient) ? <div className="text-sm text-zinc-500 text-center py-6">Log behaviors and health for ~2 weeks to see correlations.</div> : (
                    <div className="space-y-2">
                        {correlations.map(c => (
                            <div key={c.id} className="flex items-center gap-3 text-sm">
                                <div className="flex-1 text-zinc-300">{c.text}</div>
                                {c.insufficient ? <div className="text-xs text-zinc-600">need more data ({c.sample}/6+)</div> : (
                                    <>
                                        <div className="text-xs text-zinc-500">yes: <span className="text-zinc-300">{c.yesAvg}</span> · no: <span className="text-zinc-300">{c.noAvg}</span></div>
                                        <div className={`text-sm font-medium w-16 text-right ${c.diff > 2 ? 'text-teal-400' : c.diff < -2 ? 'text-red-400' : 'text-zinc-500'}`}>{c.diff > 0 ? '+' : ''}{c.diff}</div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </ChartCard>
        </div>
    );
}

function YearInPixels({ days }) {
    const colors = ['bg-zinc-800', 'bg-red-700', 'bg-orange-700', 'bg-amber-600', 'bg-lime-600', 'bg-teal-500'];
    const weeks = [];
    for (let w = 0; w < 53; w++) weeks.push(days.slice(w * 7, w * 7 + 7));
    return (
        <div className="overflow-x-auto">
            <div className="inline-flex gap-0.5">
                {weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-0.5">
                        {week.map((day, di) => <div key={di} title={`${day.date}: mood ${day.mood || '—'}`} className={`w-2.5 h-2.5 rounded-sm ${colors[day.mood || 0]}`} />)}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-2 mt-3 text-[10px] text-zinc-500"><span>less</span>{colors.map((c, i) => <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`} />)}<span>more</span></div>
        </div>
    );
}

function StatBox({ label, value }) { return <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-3"><div className="text-xs text-zinc-500">{label}</div><div className="text-xl font-medium mt-1">{value}</div></div>; }

function Stat({ label, value, suffix, precision = 0, delta, deltaUnit, deltaInverted, index = 0 }) {
    const mounted = useMountTransition();
    const numeric = typeof value === 'number' && isFinite(value) ? value : null;
    const animated = useCountUp(numeric);
    const display = numeric !== null
        ? (precision === 0 ? Math.round(animated).toString() : animated.toFixed(precision))
        : '—';
    const arrow = delta == null ? '' : Math.abs(delta) < 0.1 ? '→' : delta > 0 ? '↑' : '↓';
    const isGood = delta == null ? null : (deltaInverted ? delta < 0 : delta > 0);
    const color = arrow === '→' ? 'text-zinc-500' : isGood ? 'text-teal-400' : 'text-rose-400';
    return (
        <div
            className={`bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4 transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            style={{ transitionDelay: `${index * 50}ms` }}
        >
            <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">{label}</div>
            <div className="flex items-baseline gap-2 mt-1">
                <div className="text-2xl md:text-3xl font-medium tabular-nums">{display}{numeric !== null && suffix}</div>
                {delta != null && Math.abs(delta) >= 0.1 && (
                    <div className={`text-xs ${color}`}>{arrow} {(Math.round(Math.abs(delta) * 10) / 10).toFixed(1)}{deltaUnit}</div>
                )}
            </div>
        </div>
    );
}
function ChartCard({ title, children }) { return <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4"><div className="text-sm font-medium mb-3">{title}</div>{children}</div>; }

// ============ HISTORY ============
function HistoryView({ healthLog, routineCompletion, workouts, journal, morningRoutine, nightRoutine, profile, behaviors, behaviorLog, symptoms, symptomLog, prs, programs }) {
    const [selected, setSelected] = useState(todayKey());
    const allDates = new Set([...Object.keys(healthLog), ...Object.keys(routineCompletion), ...Object.keys(workouts), ...Object.keys(journal), ...Object.keys(behaviorLog), ...Object.keys(symptomLog)]);
    const sortedDates = [...allDates].sort((a, b) => b.localeCompare(a));
    const exportData = () => {
        const data = { profile, healthLog, routineCompletion, workouts, journal, morningRoutine, nightRoutine, behaviors, behaviorLog, symptoms, symptomLog, prs, programs, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `lifeos-${todayKey()}.json`; a.click();
    };
    const day = { health: healthLog[selected], rc: routineCompletion[selected], workout: workouts[selected], journal: journal[selected] };
    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div><h2 className="text-xl md:text-3xl font-medium">History</h2><p className="text-sm md:text-base text-zinc-300">Time machine for any past day</p></div>
                <button onClick={exportData} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-md text-sm hover:bg-zinc-800"><Download size={14} /> Export JSON</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                    <div className="sticky top-0 bg-zinc-900/90 backdrop-blur-md z-10 border-b border-zinc-800/50">
                        <div className="px-3 py-2">
                            <input
                                type="date"
                                value={selected}
                                onChange={(e) => setSelected(e.target.value)}
                                className="w-full bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-md px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600"
                            />
                        </div>
                        <div className="text-xs text-zinc-500 px-3 py-2 border-t border-zinc-800">{sortedDates.length} {sortedDates.length === 1 ? 'day' : 'days'}</div>
                    </div>
                    {sortedDates.length === 0 ? <div className="text-xs text-zinc-600 px-3 py-4 text-center">No data yet</div> :
                        sortedDates.map(d => {
                            const has = { h: !!healthLog[d], r: !!(routineCompletion[d]?.morning?.length || routineCompletion[d]?.night?.length), w: !!workouts[d]?.exercises?.length, j: !!journal[d]?.text };
                            return (
                                <button key={d} onClick={() => setSelected(d)} className={`w-full text-left px-3 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/50 ${selected === d ? 'bg-zinc-800/40' : ''}`}>
                                    <div className="text-xs font-medium text-zinc-200">{formatDate(d)}</div>
                                    <div className="flex gap-1 mt-1">
                                        {has.h && <span className="text-[10px] px-1 py-0.5 bg-pink-500/10 text-pink-400 rounded">health</span>}
                                        {has.r && <span className="text-[10px] px-1 py-0.5 bg-amber-500/10 text-amber-400 rounded">routines</span>}
                                        {has.w && <span className="text-[10px] px-1 py-0.5 bg-teal-500/10 text-teal-400 rounded">gym</span>}
                                        {has.j && <span className="text-[10px] px-1 py-0.5 bg-purple-500/10 text-purple-400 rounded">journal</span>}
                                    </div>
                                </button>
                            );
                        })}
                </div>
                <div className="md:col-span-2 space-y-3">
                    <div className="text-base font-medium">{formatDateLong(selected)}</div>
                    {day.health && (
                        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                            <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5"><Heart size={12} className="text-pink-400" /> Health</div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {day.health.sleepHours && <div><span className="text-zinc-500">Sleep:</span> {day.health.sleepHours}h</div>}
                                {day.health.rhr && <div><span className="text-zinc-500">RHR:</span> {day.health.rhr}bpm</div>}
                                {day.health.hrv && <div><span className="text-zinc-500">HRV:</span> {day.health.hrv}ms</div>}
                                {day.health.mood && <div><span className="text-zinc-500">Mood:</span> {day.health.mood}/10</div>}
                                {day.health.energy && <div><span className="text-zinc-500">Energy:</span> {day.health.energy}/10</div>}
                                {day.health.weight && <div><span className="text-zinc-500">Weight:</span> {day.health.weight}</div>}
                            </div>
                            {day.health.notes && <div className="mt-2 text-xs text-zinc-400 italic">{day.health.notes}</div>}
                        </div>
                    )}
                    {day.rc && (day.rc.morning?.length > 0 || day.rc.night?.length > 0) && (
                        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                            <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5"><Sun size={12} className="text-amber-400" /> Routines</div>
                            <div className="text-sm space-y-1"><div>Morning: {day.rc.morning?.length || 0}/{morningRoutine.length}</div><div>Night: {day.rc.night?.length || 0}/{nightRoutine.length}</div></div>
                        </div>
                    )}
                    {day.workout?.exercises?.length > 0 && (
                        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                            <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5"><Dumbbell size={12} className="text-teal-400" /> Workout</div>
                            <div className="space-y-2 text-sm">{day.workout.exercises.map((ex, i) => <div key={i}><div className="font-medium">{ex.name}</div><div className="text-xs text-zinc-500">{ex.sets.map(s => `${s.reps || '—'}×${s.weight || '—'}`).join(' · ')}</div></div>)}</div>
                            {day.workout.notes && <div className="mt-2 text-xs text-zinc-400 italic">{day.workout.notes}</div>}
                        </div>
                    )}
                    {day.journal?.text && (
                        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                            <div className="text-xs text-zinc-500 mb-2 flex items-center gap-1.5"><BookOpen size={12} className="text-purple-400" /> Journal</div>
                            <div className="text-sm text-zinc-300 whitespace-pre-wrap">{day.journal.text}</div>
                        </div>
                    )}
                    {!day.health && !day.rc && !day.workout && !day.journal && <div className="text-center text-zinc-600 py-8 text-sm">Nothing logged on this day</div>}
                </div>
            </div>
        </div>
    );
}

// ============ SETTINGS ============
function SettingsView({ profile, saveProfile, healthLog, saveHealth, setView }) {
    const [name, setName] = useState(profile.name || '');
    const [importStatus, setImportStatus] = useState('');
    const [whoopText, setWhoopText] = useState('');
    const [ouraText, setOuraText] = useState('');
    const [ouraImportStatus, setOuraImportStatus] = useState('');

    const [profileStatus, setProfileStatus] = useSaveStatus();
    const saveName = () => {
        setProfileStatus('saving');
        saveProfile({ ...profile, name: name.trim() });
        setTimeout(() => setProfileStatus('saved'), 400);
    };

    const importWhoop = async () => {
        if (!whoopText.trim()) return;
        setImportStatus('Importing...');
        const result = await importWhoopCsv(whoopText);
        if (result.error) {
            setImportStatus(`Error: ${result.error}`);
        } else {
            setImportStatus(`Imported ${result.imported} day${result.imported !== 1 ? 's' : ''} (${result.skipped} skipped from ${result.total} rows). Reload the page to see them.`);
            setWhoopText('');
        }
    };
    const importOura = async () => {
        if (!ouraText.trim()) return;
        setOuraImportStatus('Importing...');
        const result = await importOuraCsv(ouraText);
        if (result.error) {
            setOuraImportStatus(`Error: ${result.error}`);
        } else {
            setOuraImportStatus(`Imported ${result.imported} day${result.imported !== 1 ? 's' : ''} (${result.skipped} skipped from ${result.total} rows). Reload the page to see them.`);
            setOuraText('');
        }
    };

    return (
        <div className="space-y-5">
            <div><h2 className="text-xl md:text-3xl font-medium">Settings</h2><p className="text-sm md:text-base text-zinc-300">Profile, customizations, imports</p></div>

            <Section title="History">
                <button onClick={() => setView('history')} className="bg-zinc-800 border border-zinc-700 px-4 py-2 rounded text-sm hover:bg-zinc-700 text-zinc-200 flex items-center gap-2">
                    <Calendar size={14} /> View full history
                </button>
            </Section>

            <Section title="Profile">
                <Field label="Your name (shown on dashboard)">
                    <div className="flex gap-2">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex" className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500" />
                        <button onClick={saveName} className="px-4 py-2 bg-teal-600/20 border border-teal-500/40 text-teal-300 rounded text-sm hover:bg-teal-600/30">Save</button>
                        <div className="self-center"><SaveIndicator status={profileStatus} /></div>
                    </div>
                </Field>
            </Section>

            <Section title="Import from Whoop">
                <p className="text-xs md:text-sm text-zinc-500"><strong className="text-zinc-300">How to export:</strong> Open the Whoop app → Profile → App Settings → Data Export → Export. You'll get an email with a CSV.</p>
                <p className="text-xs md:text-sm text-zinc-500">Open the CSV in any text editor or Excel, copy all, paste below. I'll auto-detect columns for date, RHR, HRV, and sleep.</p>
                <textarea value={whoopText} onChange={(e) => setWhoopText(e.target.value)} rows={8} placeholder='Paste Whoop CSV here. Headers like: "Cycle start time","Heart rate variability (ms)","Resting heart rate (bpm)","Asleep duration (min)"...' className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-500 resize-none" />
                <div className="flex items-center gap-3">
                    <button onClick={importWhoop} disabled={!whoopText.trim()} className="px-4 py-2 bg-teal-600/20 border border-teal-500/40 text-teal-300 rounded text-sm hover:bg-teal-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"><Upload size={14} /> Import</button>
                    {importStatus && <div className="text-xs text-zinc-400">{importStatus}</div>}
                </div>
            </Section>
            <Section title="Import from Oura">
                <p className="text-xs md:text-sm text-zinc-500"><strong className="text-zinc-300">How to export:</strong> Sign in to <span className="text-zinc-300">cloud.ouraring.com</span> → Trends → pick a date range → Download CSV.</p>
                <p className="text-xs md:text-sm text-zinc-500">Open the CSV in any text editor or Excel, copy all, paste below. I'll auto-detect columns for date, RHR, HRV, and sleep.</p>
                <textarea value={ouraText} onChange={(e) => setOuraText(e.target.value)} rows={8} placeholder='Paste Oura CSV here. Headers like: "date","Total Sleep Duration","Average Resting Heart Rate","Average HRV"...' className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-zinc-500 resize-none" />
                <div className="flex items-center gap-3">
                    <button onClick={importOura} disabled={!ouraText.trim()} className="px-4 py-2 bg-teal-600/20 border border-teal-500/40 text-teal-300 rounded text-sm hover:bg-teal-600/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"><Upload size={14} /> Import</button>
                    {ouraImportStatus && <div className="text-xs text-zinc-400">{ouraImportStatus}</div>}
                </div>
            </Section>
        </div>
    );
}
function FeedbackModal({ onClose }) {
    const [type, setType] = useState('idea');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('idle'); // idle | sending | sent | error
    const [errorMsg, setErrorMsg] = useState('');

    const submit = async () => {
        if (!message.trim()) return;
        setStatus('sending');
        const result = await submitFeedback({
            type,
            message: message.trim(),
            url: window.location.href,
        });
        if (result.ok) {
            setStatus('sent');
            setTimeout(() => onClose(), 1500);
        } else {
            setStatus('error');
            setErrorMsg(result.error || 'Something went wrong');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium">Send feedback</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300"><X size={18} /></button>
                </div>

                <div className="text-sm text-zinc-400 mb-4">Found a bug? Have an idea? Let me know.</div>

                <div className="flex gap-2 mb-4">
                    {[
                        { id: 'bug', label: '🐛 Bug' },
                        { id: 'idea', label: '💡 Idea' },
                        { id: 'other', label: '💬 Other' },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setType(t.id)}
                            className={`px-3 py-1.5 text-xs rounded border ${type === t.id ? 'bg-teal-500/20 border-teal-500/50 text-teal-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder={type === 'bug' ? 'What broke? When did it happen? What did you expect?' : type === 'idea' ? 'What would you like to see?' : 'Tell me anything...'}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
                />

                {status === 'error' && <div className="text-xs text-red-400 mt-2">{errorMsg}</div>}

                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancel</button>
                    <button
                        onClick={submit}
                        disabled={!message.trim() || status === 'sending' || status === 'sent'}
                        className="px-4 py-2 bg-teal-600/20 border border-teal-500/40 text-teal-300 rounded text-sm hover:bg-teal-600/30 disabled:opacity-40"
                    >
                        {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Sent ✓' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============ INSIGHTS ============
function InsightsView({ healthLog, journal, behaviorLog, behaviors, workouts, routineCompletion, morningRoutine, nightRoutine, baselines }) {
    const today = todayKey();

    // ===== Range selector =====
    const RANGES = [
        { id: 'week', label: 'Week', days: 7, title: 'This week', priorLabel: 'vs prior week' },
        { id: 'month', label: 'Month', days: 30, title: 'This month', priorLabel: 'vs prior month' },
        { id: '3mo', label: '3 Months', days: 90, title: 'Last 3 months', priorLabel: 'vs prior 3 months' },
        { id: '6mo', label: '6 Months', days: 180, title: 'Last 6 months', priorLabel: 'vs prior 6 months' },
        { id: 'year', label: 'Year', days: 365, title: 'This year', priorLabel: 'vs prior year' },
    ];
    const [rangeId, setRangeId] = useState('week');
    const range = RANGES.find(r => r.id === rangeId) || RANGES[0];
    const rangeDays = range.days;
    const showLongTermStats = rangeId === '6mo' || rangeId === 'year';

    // ===== Helper: pick the most recent N days from a date object =====
    const lastNDays = (n, endDate = today) => {
        const dates = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(endDate + 'T00:00:00');
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${day}`);
        }
        return dates;
    };

    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const fmt = (n, digits = 1) => n === null ? '—' : Number(n.toFixed(digits));

    // ===== Current range vs prior period of same length =====
    const currentDates = lastNDays(rangeDays);
    const priorDates = (() => {
        const d = new Date(today + 'T00:00:00');
        d.setDate(d.getDate() - rangeDays);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return lastNDays(rangeDays, `${y}-${m}-${day}`);
    })();

    const collectMetric = (dates, metric) => {
        return dates.map(d => healthLog[d]?.[metric]).filter(v => v != null && !isNaN(v));
    };

    const currentSleep = collectMetric(currentDates, 'sleepHours');
    const priorSleep = collectMetric(priorDates, 'sleepHours');
    const currentHRV = collectMetric(currentDates, 'hrv');
    const priorHRV = collectMetric(priorDates, 'hrv');
    const currentRHR = collectMetric(currentDates, 'rhr');
    const priorRHR = collectMetric(priorDates, 'rhr');
    const currentMood = collectMetric(currentDates, 'mood');
    const currentEnergy = collectMetric(currentDates, 'energy');

    const sleepDelta = (avg(currentSleep) ?? 0) - (avg(priorSleep) ?? 0);
    const hrvDelta = (avg(currentHRV) ?? 0) - (avg(priorHRV) ?? 0);
    const rhrDelta = (avg(currentRHR) ?? 0) - (avg(priorRHR) ?? 0);

    const workoutsCurrent = currentDates.filter(d => workouts[d]?.exercises?.length > 0).length;
    const workoutsPrior = priorDates.filter(d => workouts[d]?.exercises?.length > 0).length;

    const morningHits = currentDates.filter(d =>
        morningRoutine.length > 0 && (routineCompletion[d]?.morning?.length || 0) >= morningRoutine.length
    ).length;

    // ===== Best/worst day in range (by readiness proxy: sleep+mood+energy) =====
    const dayScore = (d) => {
        const log = healthLog[d] || {};
        let sum = 0, n = 0;
        if (log.sleepHours) { sum += Math.min(log.sleepHours / 8, 1) * 100; n++; }
        if (log.mood) { sum += log.mood * 10; n++; }
        if (log.energy) { sum += log.energy * 10; n++; }
        if (log.hrv && log.rhr) { sum += 70; n++; }  // proxy
        return n > 0 ? sum / n : null;
    };
    const dayScores = currentDates.map(d => ({ date: d, score: dayScore(d) })).filter(x => x.score !== null);
    const bestDay = dayScores.reduce((b, x) => !b || x.score > b.score ? x : b, null);
    const worstDay = dayScores.reduce((w, x) => !w || x.score < w.score ? x : w, null);

    // ===== Days actually tracked in this range (any health log) =====
    const trackedDays = currentDates.filter(d => healthLog[d]).length;

    // ===== Best month by avg sleep (within range) =====
    const monthlyAvgs = {};
    currentDates.forEach(d => {
        const m = d.slice(0, 7);
        if (!monthlyAvgs[m]) monthlyAvgs[m] = [];
        if (healthLog[d]?.sleepHours) monthlyAvgs[m].push(healthLog[d].sleepHours);
    });
    const bestMonthEntry = Object.entries(monthlyAvgs)
        .map(([m, arr]) => ({ month: m, avg: avg(arr), count: arr.length }))
        .filter(x => x.count >= 5 && x.avg !== null)
        .sort((a, b) => b.avg - a.avg)[0];

    // ===== Longest morning routine streak within range =====
    let longestStreak = 0, currentStreak = 0;
    for (const d of [...currentDates].sort()) {
        const completed = (routineCompletion[d]?.morning?.length || 0) >= morningRoutine.length && morningRoutine.length > 0;
        if (completed) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    }
    // ===== Behavior correlations =====
    const behaviorPatterns = behaviors.map(b => {
        const yesDays = [];
        const noDays = [];
        for (const date in behaviorLog) {
            const val = behaviorLog[date]?.[b.id];
            if (val === true) yesDays.push(date);
            else if (val === false) noDays.push(date);
        }

        if (yesDays.length < 3 || noDays.length < 3) return null;

        const compareMetric = (metric, label, unit, lowerIsBetter = false) => {
            const yesValues = yesDays.map(d => healthLog[d]?.[metric]).filter(v => v != null);
            const noValues = noDays.map(d => healthLog[d]?.[metric]).filter(v => v != null);
            if (yesValues.length < 3 || noValues.length < 3) return null;
            const yesAvg = yesValues.reduce((a, c) => a + c, 0) / yesValues.length;
            const noAvg = noValues.reduce((a, c) => a + c, 0) / noValues.length;
            const diff = yesAvg - noAvg;
            const absPctChange = Math.abs(diff / noAvg) * 100;
            if (absPctChange < 5) return null;
            const isBad = lowerIsBetter ? diff > 0 : diff < 0;
            return { metric: label, yesAvg, noAvg, diff, unit, isBad, magnitude: Math.abs(diff / noAvg) };
        };

        const findings = [
            compareMetric('hrv', 'HRV', 'ms'),
            compareMetric('sleepHours', 'Sleep', 'h'),
            compareMetric('rhr', 'RHR', 'bpm', true),
            compareMetric('mood', 'Mood', '/10'),
            compareMetric('energy', 'Energy', '/10'),
        ].filter(Boolean);

        if (findings.length === 0) return null;

        return {
            behavior: b.text,
            yesCount: yesDays.length,
            noCount: noDays.length,
            findings: findings.sort((a, b) => b.magnitude - a.magnitude),
        };
    }).filter(Boolean).sort((a, b) => b.findings[0].magnitude - a.findings[0].magnitude);
    const formatDayName = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    // ===== Trends section: compare metrics chart (uses selected range) =====
    const [compareMetrics, setCompareMetrics] = useState(['sleep', 'readiness', 'hrv']);
    const compareMetricsConfig = [
        { id: 'sleep', label: 'Sleep (h)', color: '#a78bfa', axis: 'left' },
        { id: 'readiness', label: 'Readiness', color: '#2dd4bf', axis: 'left' },
        { id: 'mood', label: 'Mood', color: '#fbbf24', axis: 'left' },
        { id: 'energy', label: 'Energy', color: '#f97316', axis: 'left' },
        { id: 'hrv', label: 'HRV (ms)', color: '#22d3ee', axis: 'right' },
        { id: 'rhr', label: 'RHR (bpm)', color: '#f472b6', axis: 'right' },
    ];
    const chartData = currentDates.map(d => ({
        date: d.slice(5),
        sleep: healthLog[d]?.sleepHours || null,
        readiness: calcReadiness(healthLog[d], baselines),
        mood: healthLog[d]?.mood || null,
        energy: healthLog[d]?.energy || null,
        hrv: healthLog[d]?.hrv || null,
        rhr: healthLog[d]?.rhr || null,
    }));

    // ===== Trends section: year-in-pixels (always last 365 days) =====
    const pixelDays = lastNDays(365).map(d => ({ date: d, mood: healthLog[d]?.mood || journal[d]?.mood }));

    // ===== Trends section: behavior impact on readiness (always all data) =====
    const behaviorImpact = behaviors.map(b => {
        const yes = [], no = [];
        Object.entries(behaviorLog).forEach(([d, log]) => {
            const r = calcReadiness(healthLog[d], baselines);
            if (r === null) return;
            if (log[b.id] === true) yes.push(r);
            else if (log[b.id] === false) no.push(r);
        });
        if (yes.length < 3 || no.length < 3) return { ...b, sample: yes.length + no.length, insufficient: true };
        const aYes = yes.reduce((a, c) => a + c, 0) / yes.length;
        const aNo = no.reduce((a, c) => a + c, 0) / no.length;
        return { ...b, yesAvg: Math.round(aYes * 10) / 10, noAvg: Math.round(aNo * 10) / 10, diff: Math.round((aYes - aNo) * 10) / 10, sample: yes.length + no.length };
    });

    return (
        <div className="space-y-6 md:space-y-8">
            <div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-50">Insights</h2>
                <p className="text-sm md:text-base text-zinc-300 mt-0.5">Patterns and summaries from your data</p>
            </div>
            <div>
                <div className="flex items-baseline justify-between mb-3">
                    <h3 className="text-base md:text-lg font-medium flex items-center gap-2">🔍 Patterns</h3>
                    <span className="text-xs md:text-sm text-zinc-300">behaviors → outcomes</span>
                </div>
                {behaviorPatterns.length > 0 ? (
                    <div className="space-y-2">
                        {behaviorPatterns.map((p, i) => (
                            <div key={i} className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                                <div className="flex items-baseline justify-between mb-2">
                                    <div className="text-sm font-medium">{p.behavior}</div>
                                    <div className="text-xs md:text-sm text-zinc-300">{p.yesCount} yes · {p.noCount} no days</div>
                                </div>
                                <div className="space-y-1">
                                    {p.findings.slice(0, 3).map((f, j) => (
                                        <div key={j} className="flex items-center gap-2 text-xs">
                                            <div className="w-16 text-zinc-500">{f.metric}</div>
                                            <div className={f.isBad ? 'text-rose-400' : 'text-teal-400'}>
                                                {fmt(f.yesAvg, 1)}{f.unit} <span className="text-zinc-500">vs</span> {fmt(f.noAvg, 1)}{f.unit}
                                            </div>
                                            <div className={`text-[10px] ${f.isBad ? 'text-rose-400/70' : 'text-teal-400/70'}`}>
                                                ({f.diff > 0 ? '+' : ''}{fmt(f.diff, 1)}{f.unit})
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-zinc-900/80 backdrop-blur-md border border-dashed border-zinc-800/50 rounded-lg p-6 text-center">
                        <div className="text-base md:text-lg font-medium text-zinc-200">Patterns will appear here as you log</div>
                        <div className="text-sm md:text-base text-zinc-300 mt-2 max-w-2xl mx-auto">
                            Each day on the Today page, tap the behavior pills (alcohol, caffeine, late meal, stress) to mark yes or no.
                        </div>
                        <div className="text-xs md:text-sm text-zinc-400 mt-2 max-w-2xl mx-auto">
                            After ~2 weeks of tracking, we'll show you things like <span className="text-zinc-200">"Your HRV drops 12 points on alcohol days"</span> or <span className="text-zinc-200">"You sleep 1.2h less when you log late meals."</span>
                        </div>
                    </div>
                )}
            </div>


            {/* DYNAMIC RANGE SECTION */}
            <div>
                <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="text-base md:text-lg font-medium">{range.title}</h3>
                        <span className="text-xs md:text-sm text-zinc-300">{range.priorLabel}</span>
                    </div>
                    <div className="flex gap-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-md p-1">
                        {RANGES.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setRangeId(r.id)}
                                className={`px-3 py-1 text-xs rounded ${rangeId === r.id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat index={0} label="Sleep avg" value={avg(currentSleep)} suffix="h" precision={1} delta={sleepDelta} deltaUnit="h" />
                    <Stat index={1} label="HRV avg" value={avg(currentHRV)} suffix="ms" delta={hrvDelta} deltaUnit="ms" />
                    <Stat index={2} label="RHR avg" value={avg(currentRHR)} suffix="bpm" delta={rhrDelta} deltaUnit="bpm" deltaInverted />
                    <Stat index={3} label="Workouts" value={workoutsCurrent} delta={workoutsCurrent - workoutsPrior} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                        <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">Mood / Energy avg</div>
                        <div className="text-2xl md:text-3xl font-medium mt-1">
                            {avg(currentMood) ? <>{fmt(avg(currentMood), 1)}<span className="text-zinc-500 text-[0.6em] font-normal">/10</span></> : '—'}
                            {' · '}
                            {avg(currentEnergy) ? <>{fmt(avg(currentEnergy), 1)}<span className="text-zinc-500 text-[0.6em] font-normal">/10</span></> : '—'}
                        </div>
                    </div>
                    <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                        <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">Morning routines hit</div>
                        <div className="text-2xl md:text-3xl font-medium mt-1">{morningHits} / {rangeDays} days</div>
                    </div>
                </div>
                {(bestDay || worstDay) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        {bestDay && (
                            <div className="bg-teal-500/5 border border-teal-500/20 rounded-lg p-4">
                                <div className="text-[12px] md:text-[13px] font-medium text-teal-400 uppercase tracking-[0.08em]">Best day</div>
                                <div className="text-base font-medium mt-1">{formatDayName(bestDay.date)}</div>
                                <div className="text-xs md:text-sm text-zinc-300 mt-1">
                                    {healthLog[bestDay.date]?.sleepHours && `${healthLog[bestDay.date].sleepHours}h sleep`}
                                    {healthLog[bestDay.date]?.mood && ` · mood ${healthLog[bestDay.date].mood}/10`}
                                </div>
                            </div>
                        )}
                        {worstDay && worstDay.date !== bestDay?.date && (
                            <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4">
                                <div className="text-[12px] md:text-[13px] font-medium text-rose-400 uppercase tracking-[0.08em]">Toughest day</div>
                                <div className="text-base font-medium mt-1">{formatDayName(worstDay.date)}</div>
                                <div className="text-xs md:text-sm text-zinc-300 mt-1">
                                    {healthLog[worstDay.date]?.sleepHours && `${healthLog[worstDay.date].sleepHours}h sleep`}
                                    {healthLog[worstDay.date]?.mood && ` · mood ${healthLog[worstDay.date].mood}/10`}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {showLongTermStats && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        {bestMonthEntry && (
                            <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                                <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">Best sleep month</div>
                                <div className="text-base font-medium mt-1">
                                    {new Date(bestMonthEntry.month + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </div>
                                <div className="text-xs md:text-sm text-zinc-300 mt-1">avg {fmt(bestMonthEntry.avg)}h</div>
                            </div>
                        )}
                        <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4">
                            <div className="text-[12px] md:text-[13px] font-medium text-zinc-300 uppercase tracking-[0.08em]">Longest morning routine streak</div>
                            <div className="text-base font-medium mt-1">{longestStreak} days</div>
                        </div>
                    </div>
                )}
            </div>

            {/* TRENDS SECTION */}
            <div className="space-y-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-base md:text-lg font-medium">Trends</h3>
                    <span className="text-xs md:text-sm text-zinc-300">Visualize patterns over time</span>
                </div>

                <ChartCard title="Compare metrics">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {compareMetricsConfig.map(m => {
                            const active = compareMetrics.includes(m.id);
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setCompareMetrics(active ? compareMetrics.filter(x => x !== m.id) : [...compareMetrics, m.id])}
                                    className="px-3 py-1.5 rounded-md border text-xs transition-colors"
                                    style={{
                                        backgroundColor: active ? m.color + '20' : 'transparent',
                                        borderColor: active ? m.color + '80' : '#3f3f46',
                                        color: active ? m.color : '#a1a1aa',
                                    }}
                                >
                                    {m.label}
                                </button>
                            );
                        })}
                    </div>
                    {compareMetrics.length === 0 ? (
                        <div className="text-sm text-zinc-500 text-center py-12">Toggle one or more metrics above to chart them.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                                <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                                <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} />
                                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 6, fontSize: 12 }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                {compareMetrics.includes('sleep') && <Line yAxisId="left" type="monotone" dataKey="sleep" stroke="#a78bfa" strokeWidth={2} dot={false} name="Sleep (h)" connectNulls />}
                                {compareMetrics.includes('readiness') && <Line yAxisId="left" type="monotone" dataKey="readiness" stroke="#2dd4bf" strokeWidth={2} dot={false} name="Readiness" connectNulls />}
                                {compareMetrics.includes('mood') && <Line yAxisId="left" type="monotone" dataKey="mood" stroke="#fbbf24" strokeWidth={2} dot={false} name="Mood" connectNulls />}
                                {compareMetrics.includes('energy') && <Line yAxisId="left" type="monotone" dataKey="energy" stroke="#f97316" strokeWidth={2} dot={false} name="Energy" connectNulls />}
                                {compareMetrics.includes('hrv') && <Line yAxisId="right" type="monotone" dataKey="hrv" stroke="#22d3ee" strokeWidth={2} dot={false} name="HRV (ms)" connectNulls />}
                                {compareMetrics.includes('rhr') && <Line yAxisId="right" type="monotone" dataKey="rhr" stroke="#f472b6" strokeWidth={2} dot={false} name="RHR (bpm)" connectNulls />}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard title="Year in mood">
                    <YearInPixels days={pixelDays} />
                </ChartCard>

                <ChartCard title="Behavior impact on readiness">
                    <div className="text-xs md:text-sm text-zinc-300 mb-3">Avg readiness on yes vs no days. Need 3+ each side. Uses all available data.</div>
                    {behaviorImpact.every(c => c.insufficient) ? <div className="text-sm text-zinc-500 text-center py-6">Log behaviors and health for ~2 weeks to see correlations.</div> : (
                        <div className="space-y-2">
                            {behaviorImpact.map(c => (
                                <div key={c.id} className="flex items-center gap-3 text-sm">
                                    <div className="flex-1 text-zinc-300">{c.text}</div>
                                    {c.insufficient ? <div className="text-xs text-zinc-600">need more data ({c.sample}/6+)</div> : (
                                        <>
                                            <div className="text-xs text-zinc-500">yes: <span className="text-zinc-300">{c.yesAvg}</span> · no: <span className="text-zinc-300">{c.noAvg}</span></div>
                                            <div className={`text-sm font-medium w-16 text-right ${c.diff > 2 ? 'text-teal-400' : c.diff < -2 ? 'text-red-400' : 'text-zinc-500'}`}>{c.diff > 0 ? '+' : ''}{c.diff}</div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ChartCard>
            </div>

            {trackedDays < 14 && (
                <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4 text-center text-sm md:text-base text-zinc-300">
                    More data = better insights. Keep logging!
                </div>
            )}
        </div>
    );
}