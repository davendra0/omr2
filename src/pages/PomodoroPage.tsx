import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import {
  getSettings, saveSettings, addSession, deleteSession, updateSession, getTodaySessions, getSessions,
  type PomodoroSettings, type PomodoroSession, DEFAULT_SETTINGS, SUBJECTS,
} from '@/lib/pomodoroStore';
import { usePomodoroTimer } from '@/store/pomodoroTimerStore';
import { getTodos, type Todo } from '@/lib/todoStore';

type Phase = 'focus' | 'short_break' | 'long_break';

const PHASE_META: Record<Phase, { label: string; icon: string; gradient: string; ring: string; text: string; stroke: string }> = {
  focus: {
    label: 'Focus', icon: '🎯',
    gradient: 'from-primary/10 to-primary/5',
    ring: 'ring-primary/20', text: 'text-primary',
    stroke: 'stroke-primary',
  },
  short_break: {
    label: 'Break', icon: '☕',
    gradient: 'from-[hsl(142,71%,40%)]/10 to-[hsl(142,71%,40%)]/5',
    ring: 'ring-[hsl(142,71%,40%)]/20', text: 'text-[hsl(142,71%,40%)]',
    stroke: 'stroke-[hsl(142,71%,40%)]',
  },
  long_break: {
    label: 'Long Break', icon: '🌿',
    gradient: 'from-accent/10 to-accent/5',
    ring: 'ring-accent/20', text: 'text-accent',
    stroke: 'stroke-accent',
  },
};

const PRIORITY_ICONS_MINI: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };

const PomodoroPage = () => {
  const [settings, setSettings] = useState<PomodoroSettings>(getSettings);
  const [showSettings, setShowSettings] = useState(false);
  const timer = usePomodoroTimer();
  const phase = timer.phase as Phase;
  const secondsLeft = timer.secondsLeft;
  const running = timer.running;
  const sessionCount = timer.sessionCount;
  const [todaySessions, setTodaySessions] = useState<PomodoroSession[]>(getTodaySessions);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [minimal, setMinimal] = useState(false);
  const [hideTime, setHideTime] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [editMinutes, setEditMinutes] = useState('');
  const sessionLabel = timer.label;
  const sessionSubject = timer.subject;
  const sessionChapter = timer.chapter;
  const setSessionLabel = timer.setLabel;
  const setSessionSubject = timer.setSubject;
  const setSessionChapter = timer.setChapter;
  const [dailyGoal, setDailyGoal] = useState(() => {
    try { return parseInt(localStorage.getItem('pomo_daily_goal') || '120'); } catch { return 120; }
  });
  const [linkedTasks, setLinkedTasks] = useState<Todo[]>([]);
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  useEffect(() => {
    setLinkedTasks(getTodos().filter(t => !t.completed).slice(0, 10));
  }, []);

  const totalSeconds = phase === 'focus'
    ? (timer.totalDuration || settings.focusMinutes * 60)
    : phase === 'short_break'
      ? settings.shortBreakMinutes * 60
      : settings.longBreakMinutes * 60;

  const meta = PHASE_META[phase];

  const completePhase = useCallback(() => {
    timer.setRunning(false);
    const dur = phase === 'focus' ? Math.round((totalSeconds - secondsLeft) / 60) || settings.focusMinutes
      : phase === 'short_break' ? settings.shortBreakMinutes : settings.longBreakMinutes;
    const session: PomodoroSession = {
      id: crypto.randomUUID(), type: phase, durationMinutes: dur,
      completedAt: Date.now(), date: new Date().toISOString().slice(0, 10),
      label: sessionLabel || undefined, subject: sessionSubject || undefined, chapter: sessionChapter || undefined,
    };
    addSession(session);
    setTodaySessions(getTodaySessions());

    if (phase === 'focus') {
      const newCount = sessionCount + 1;
      timer.setSessionCount(newCount);
      if (newCount % settings.sessionsBeforeLong === 0) {
        timer.setPhase('long_break', settings.longBreakMinutes * 60);
        if (settings.autoStartBreaks) timer.setRunning(true);
      } else {
        timer.setPhase('short_break', settings.shortBreakMinutes * 60);
        if (settings.autoStartBreaks) timer.setRunning(true);
      }
    } else {
      timer.setPhase('focus', settings.focusMinutes * 60);
      if (settings.autoStartFocus) timer.setRunning(true);
    }

    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = phase === 'focus' ? 600 : 800;
      gain.gain.value = 0.3; osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }, [phase, sessionCount, settings, sessionLabel, sessionSubject, sessionChapter, timer, totalSeconds, secondsLeft]);

  useEffect(() => {
    if (!running) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      timer.setSecondsLeft(usePomodoroTimer.getState().secondsLeft - 1);
      if (usePomodoroTimer.getState().secondsLeft <= 1) completePhase();
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, completePhase, timer]);

  const resetTimer = () => { timer.setRunning(false); timer.setPhase('focus', settings.focusMinutes * 60); timer.setSessionCount(0); };
  const skipPhase = () => completePhase();

  const handleSaveSettings = (newSettings: PomodoroSettings) => {
    saveSettings(newSettings); setSettings(newSettings); setShowSettings(false);
    if (!running) {
      if (phase === 'focus') timer.setSecondsLeft(newSettings.focusMinutes * 60);
      else if (phase === 'short_break') timer.setSecondsLeft(newSettings.shortBreakMinutes * 60);
      else timer.setSecondsLeft(newSettings.longBreakMinutes * 60);
    }
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;

  const todayFocus = todaySessions.filter(s => s.type === 'focus');
  const todayMinutes = todayFocus.reduce((a, s) => a + s.durationMinutes, 0);
  const goalPct = Math.min(100, Math.round((todayMinutes / dailyGoal) * 100));

  const size = minimal ? 280 : 240;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  /* ─── Drag to extend ─── */
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const handleCirclePointerDown = (e: React.PointerEvent) => {
    if (running) return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCirclePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const fraction = angle / (2 * Math.PI);
    const newSecondsLeft = Math.round((1 - fraction) * totalSeconds);
    const clamped = Math.max(0, Math.min(totalSeconds * 2, newSecondsLeft));
    if (fraction < 0.1 && secondsLeft < totalSeconds * 0.1) {
      const newTotal = totalSeconds + 5 * 60;
      timer.setPhase(phase, newTotal);
      timer.setSecondsLeft(newTotal - Math.round(fraction * newTotal));
    } else {
      timer.setSecondsLeft(Math.max(0, clamped));
    }
  };

  const handleCirclePointerUp = () => { dragging.current = false; };

  /* ─── Double-click to edit time ─── */
  const handleDoubleClickTime = () => {
    if (running) return;
    setEditMinutes(String(Math.ceil(secondsLeft / 60)));
    setEditingTime(true);
  };

  const handleSaveEditTime = () => {
    const m = parseInt(editMinutes);
    if (m > 0) {
      timer.setPhase(phase, m * 60);
    }
    setEditingTime(false);
  };

  const handlePickTask = (task: Todo) => {
    setSessionLabel(task.title);
    if (task.category) setSessionSubject(task.category);
    setShowTaskPicker(false);
  };

  // Session dots for visual progress
  const sessionDots = Array.from({ length: settings.sessionsBeforeLong }, (_, i) => i < (sessionCount % settings.sessionsBeforeLong));

  // Zen mode
  if (minimal) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6">
        <button onClick={() => setMinimal(false)}
          className="absolute top-4 right-4 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          ✕ Exit
        </button>
        <div className={`text-xs font-mono uppercase tracking-widest ${meta.text}`}>{meta.icon} {meta.label}</div>
        {sessionLabel && <div className="text-xs text-muted-foreground font-mono">📎 {sessionLabel}</div>}
        <div className="relative">
          <svg ref={svgRef} width={size} height={size} className="-rotate-90"
            onPointerMove={handleCirclePointerMove} onPointerUp={handleCirclePointerUp}>
            <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} opacity={0.15} />
            <circle cx={size/2} cy={size/2} r={radius} fill="none" className={meta.stroke}
              strokeWidth={strokeWidth} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
              style={{ transition: dragging.current ? 'none' : 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)', cursor: !running ? 'grab' : 'default' }}
              onPointerDown={handleCirclePointerDown}
            />
          </svg>
          {!hideTime && (
            <div className="absolute inset-0 flex items-center justify-center" onDoubleClick={handleDoubleClickTime}>
              {editingTime ? (
                <TimeEditInput value={editMinutes} onChange={setEditMinutes} onSave={handleSaveEditTime} onCancel={() => setEditingTime(false)} />
              ) : (
                <div className={`text-6xl font-mono font-black ${meta.text} cursor-pointer select-none tabular-nums`}>{pad(mins)}:{pad(secs)}</div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={() => timer.setRunning(!running)} className="px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity shadow-lg">
            {running ? '⏸ Pause' : '▶ Start'}
          </button>
          <button onClick={skipPhase} className="px-4 py-3 border border-border rounded-2xl text-sm text-foreground hover:bg-muted">⏭</button>
        </div>
        <button onClick={() => setHideTime(!hideTime)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          {hideTime ? '👁 Show Time' : '🙈 Hide Time'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold font-mono text-foreground">🍅 Pomodoro</h1>
        <div className="flex gap-1">
          <button onClick={() => setMinimal(true)} className="p-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Zen mode">🧘</button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Settings">⚙️</button>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)}
          dailyGoal={dailyGoal} onDailyGoalChange={(g) => { setDailyGoal(g); localStorage.setItem('pomo_daily_goal', String(g)); }} />
      )}

      {/* Timer Card */}
      <div className={`bg-gradient-to-b ${meta.gradient} border border-border rounded-2xl p-6 flex flex-col items-center gap-4 ring-1 ${meta.ring}`}>
        {/* Phase pills */}
        <div className="flex gap-0.5 bg-muted/50 rounded-xl p-0.5">
          {(['focus', 'short_break', 'long_break'] as Phase[]).map((p) => (
            <button key={p}
              onClick={() => { if (!running) timer.setPhase(p, p === 'focus' ? settings.focusMinutes * 60 : p === 'short_break' ? settings.shortBreakMinutes * 60 : settings.longBreakMinutes * 60); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${phase === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {PHASE_META[p].icon} {PHASE_META[p].label}
            </button>
          ))}
        </div>

        {/* Circle timer */}
        <div className="relative">
          <svg ref={svgRef} width={size} height={size} className="-rotate-90"
            onPointerMove={handleCirclePointerMove} onPointerUp={handleCirclePointerUp}>
            <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} opacity={0.12} />
            <circle cx={size/2} cy={size/2} r={radius} fill="none" className={meta.stroke}
              strokeWidth={strokeWidth} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
              style={{ transition: dragging.current ? 'none' : 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)', cursor: !running ? 'grab' : 'default' }}
              onPointerDown={handleCirclePointerDown}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" onDoubleClick={handleDoubleClickTime}>
            {editingTime ? (
              <TimeEditInput value={editMinutes} onChange={setEditMinutes} onSave={handleSaveEditTime} onCancel={() => setEditingTime(false)} />
            ) : !hideTime ? (
              <div className={`text-5xl font-mono font-black tracking-tight ${meta.text} cursor-pointer select-none tabular-nums`} title="Double-click to edit">{pad(mins)}:{pad(secs)}</div>
            ) : (
              <div className={`text-lg font-mono ${meta.text}`}>⏳</div>
            )}
            {/* Session dots */}
            <div className="flex gap-1.5 mt-2">
              {sessionDots.map((done, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors ${done ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
          </div>
        </div>

        {!running && <p className="text-[10px] text-muted-foreground -mt-2">Drag circle to adjust · Double-click to edit</p>}

        {/* Controls */}
        <div className="flex gap-2">
          <button onClick={() => timer.setRunning(!running)}
            className={`px-8 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all hover:shadow-lg ${running ? 'bg-muted text-foreground hover:bg-muted/80' : 'bg-primary text-primary-foreground hover:opacity-90'}`}>
            {running ? '⏸ Pause' : '▶ Start'}
          </button>
          <button onClick={skipPhase} className="p-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Skip">⏭</button>
          <button onClick={resetTimer} className="p-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Reset">↺</button>
          <button onClick={() => setHideTime(!hideTime)} className="p-2.5 border border-border rounded-xl text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            {hideTime ? '👁' : '🙈'}
          </button>
        </div>
      </div>

      {/* Session label */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <div className="flex gap-2 items-center">
          <input type="text" placeholder="What are you working on?" value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)}
            className="flex-1 h-9 px-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50" />
          <button onClick={() => setShowTaskPicker(!showTaskPicker)}
            className="h-9 px-3 border border-border rounded-xl text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0">
            📋
          </button>
        </div>
        <div className="flex gap-2">
          <select value={sessionSubject} onChange={(e) => setSessionSubject(e.target.value)}
            className="h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">Subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="text" placeholder="Chapter" value={sessionChapter} onChange={(e) => setSessionChapter(e.target.value)}
            className="h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs flex-1 focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        {showTaskPicker && linkedTasks.length > 0 && (
          <div className="border border-border rounded-lg p-2 bg-muted/30 space-y-0.5 max-h-36 overflow-y-auto">
            {linkedTasks.map(t => (
              <button key={t.id} onClick={() => handlePickTask(t)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-colors ${sessionLabel === t.title ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'}`}>
                {PRIORITY_ICONS_MINI[t.priority]} {t.title}
                {t.estimatedMinutes && <span className="text-muted-foreground ml-1">· {t.estimatedMinutes}m</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Today's progress */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold font-mono text-foreground">Today's Focus</span>
          <span className={`text-xs font-mono font-bold ${goalPct >= 100 ? 'text-[hsl(142,71%,40%)]' : 'text-muted-foreground'}`}>{todayMinutes}/{dailyGoal}m {goalPct >= 100 ? '🎉' : ''}</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-700 ease-out" style={{ width: `${goalPct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 text-center">
          <Stat value={String(todayFocus.length)} label="Sessions" color="text-primary" />
          <Stat value={String(todayMinutes)} label="Minutes" color="text-foreground" />
          <Stat value={(todayMinutes / 60).toFixed(1)} label="Hours" color="text-accent-foreground" />
        </div>
        {todayFocus.length > 0 && (
          <div className="pt-2 mt-2 border-t border-border space-y-0.5">
            {Object.entries(
              todayFocus.reduce<Record<string, number>>((acc, s) => {
                const key = s.subject || 'Unlabeled';
                acc[key] = (acc[key] || 0) + s.durationMinutes;
                return acc;
              }, {})
            ).map(([subj, m]) => (
              <div key={subj} className="flex justify-between text-xs">
                <span className="text-foreground">{subj}</span>
                <span className="font-mono text-muted-foreground">{m}m</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecentSessions />
    </div>
  );
};

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div>
      <div className={`text-xl font-mono font-black ${color}`}>{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function TimeEditInput({ value, onChange, onSave, onCancel }: { value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        onBlur={onSave}
        className="w-16 h-10 text-center text-2xl font-mono font-black bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
      <span className="text-sm text-muted-foreground">min</span>
    </div>
  );
}

function SettingsPanel({ settings, onSave, onClose, dailyGoal, onDailyGoalChange }: {
  settings: PomodoroSettings; onSave: (s: PomodoroSettings) => void; onClose: () => void;
  dailyGoal: number; onDailyGoalChange: (g: number) => void;
}) {
  const [s, setS] = useState(settings);
  const [goal, setGoal] = useState(dailyGoal);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-bold font-mono text-foreground">Timer Settings</h3>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Focus (min)', key: 'focusMinutes', min: 1, max: 120 },
          { label: 'Short Break', key: 'shortBreakMinutes', min: 1, max: 30 },
          { label: 'Long Break', key: 'longBreakMinutes', min: 1, max: 60 },
          { label: 'Sessions before long', key: 'sessionsBeforeLong', min: 2, max: 10 },
        ].map(({ label, key, min, max }) => (
          <div key={key}>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
            <input type="number" min={min} max={max} value={(s as any)[key]}
              onChange={(e) => setS({ ...s, [key]: +e.target.value })}
              className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        ))}
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily Goal (min)</label>
        <input type="number" min={10} max={600} value={goal} onChange={(e) => setGoal(+e.target.value)}
          className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
          <input type="checkbox" checked={s.autoStartBreaks} onChange={(e) => setS({ ...s, autoStartBreaks: e.target.checked })} className="rounded border-border" />
          Auto-start breaks
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
          <input type="checkbox" checked={s.autoStartFocus} onChange={(e) => setS({ ...s, autoStartFocus: e.target.checked })} className="rounded border-border" />
          Auto-start focus after break
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={() => { onSave(s); onDailyGoalChange(goal); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-xs flex-1">Save</button>
        <button onClick={() => { onSave(DEFAULT_SETTINGS); onDailyGoalChange(120); }} className="px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted">Reset</button>
        <button onClick={onClose} className="px-3 py-2 border border-border rounded-lg text-xs text-foreground hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}

function RecentSessions() {
  const [sessions, setSessions] = useState(() => getSessions().slice(-20).reverse());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
  const [editForm, setEditForm] = useState<Partial<PomodoroSession>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<Partial<PomodoroSession>>({
    type: 'focus', durationMinutes: 25, label: '', subject: '', chapter: '',
  });

  const refreshSessions = () => setSessions(getSessions().slice(-20).reverse());

  const handleDelete = (id: string) => {
    setConfirmConfig({ open: true, id });
  };

  const confirmDelete = () => {
    if (confirmConfig.id) {
      deleteSession(confirmConfig.id);
      refreshSessions();
    }
  };

  const handleEdit = (s: PomodoroSession) => { setEditingId(s.id); setEditForm({ ...s }); };
  const handleSaveEdit = () => { if (editingId && editForm) { updateSession(editingId, editForm); setEditingId(null); refreshSessions(); } };
  const handleAddSession = () => {
    addSession({
      id: crypto.randomUUID(), type: addForm.type as any,
      durationMinutes: addForm.durationMinutes || 25, completedAt: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      label: addForm.label || undefined, subject: addForm.subject || undefined, chapter: addForm.chapter || undefined,
    });
    setShowAddForm(false);
    setAddForm({ type: 'focus', durationMinutes: 25, label: '', subject: '', chapter: '' });
    refreshSessions();
  };

  const typeIcon: Record<string, string> = { focus: '🎯', short_break: '☕', long_break: '🌿' };

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <ConfirmationDialog
        open={confirmConfig.open}
        onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}
        title="Delete Session?"
        description="Are you sure you want to delete this session? This action cannot be undone."
        onConfirm={confirmDelete}
      />
      <div className="flex items-center justify-between">
        <h2 className="font-bold font-mono text-foreground text-sm">Recent Sessions</h2>
        <button onClick={() => setShowAddForm(!showAddForm)} className="px-2.5 py-1 text-[11px] bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-bold">+ Log</button>
      </div>

      {showAddForm && (
        <div className="p-3 bg-muted/50 rounded-lg space-y-2 border border-border">
          <div className="grid grid-cols-2 gap-2">
            <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value as any })}
              className="h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs">
              <option value="focus">🎯 Focus</option>
              <option value="short_break">☕ Short Break</option>
              <option value="long_break">🌿 Long Break</option>
            </select>
            <input type="number" placeholder="Minutes" value={addForm.durationMinutes} onChange={(e) => setAddForm({ ...addForm, durationMinutes: +e.target.value })}
              className="h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs" />
          </div>
          <input type="text" placeholder="Label" value={addForm.label} onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs" />
          <div className="flex gap-2">
            <select value={addForm.subject} onChange={(e) => setAddForm({ ...addForm, subject: e.target.value })}
              className="h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs flex-1">
              <option value="">Subject</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="text" placeholder="Chapter" value={addForm.chapter} onChange={(e) => setAddForm({ ...addForm, chapter: e.target.value })}
              className="h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs flex-1" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddSession} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold">Save</button>
            <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No sessions yet. Start your first focus! 🎯</p>
      ) : (
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {sessions.map((s) => (
            <div key={s.id}>
              {editingId === s.id ? (
                <div className="p-2 bg-muted/50 rounded-lg space-y-2 border border-border">
                  <div className="grid grid-cols-2 gap-2">
                    <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                      className="h-7 px-2 border border-border rounded bg-background text-foreground text-xs">
                      <option value="focus">🎯 Focus</option>
                      <option value="short_break">☕ Short</option>
                      <option value="long_break">🌿 Long</option>
                    </select>
                    <input type="number" value={editForm.durationMinutes} onChange={(e) => setEditForm({ ...editForm, durationMinutes: +e.target.value })}
                      className="h-7 px-2 border border-border rounded bg-background text-foreground text-xs" />
                  </div>
                  <input type="text" placeholder="Label" value={editForm.label || ''} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                    className="w-full h-7 px-2 border border-border rounded bg-background text-foreground text-xs" />
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs">Save</button>
                    <button onClick={() => setEditingId(null)} className="px-2 py-1 border border-border rounded text-xs text-muted-foreground">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between py-1.5 px-2 rounded-lg text-xs hover:bg-muted/30 gap-2 group transition-colors">
                  <span className="shrink-0">{typeIcon[s.type]}</span>
                  <span className="text-foreground font-medium truncate flex-1">{s.label || s.subject || '—'}</span>
                  <span className="text-muted-foreground font-mono shrink-0">{s.durationMinutes}m</span>
                  <span className="text-muted-foreground font-mono shrink-0 text-[10px]">
                    {new Date(s.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => handleEdit(s)} className="px-1 py-0.5 text-[10px] border border-border rounded hover:bg-muted">✏️</button>
                    <button onClick={() => handleDelete(s.id)} className="px-1 py-0.5 text-[10px] border border-destructive/50 text-destructive rounded hover:bg-destructive/10">🗑</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PomodoroPage;
