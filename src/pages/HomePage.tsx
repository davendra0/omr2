import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getSavedTests } from '@/lib/testHistory';
import { getCountdowns, type Countdown } from '@/lib/countdownStore';
import { getTodaySessions } from '@/lib/pomodoroStore';
import { getTodos } from '@/lib/todoStore';
import { getAllMistakes } from '@/lib/mistakeStore';
import { useTestStore } from '@/store/testStore';

const HomePage = () => {
  const navigate = useNavigate();
  const [testCount, setTestCount] = useState(0);
  const [nextCountdown, setNextCountdown] = useState<Countdown | null>(null);
  const [todayFocus, setTodayFocus] = useState(0);
  const [tasksDone, setTasksDone] = useState({ done: 0, total: 0 });
  const [mistakeCount, setMistakeCount] = useState(0);
  const [hasAutosave, setHasAutosave] = useState(false);

  useEffect(() => {
    setTestCount(getSavedTests().length);
    const cds = getCountdowns().filter(c => new Date(c.targetDate) >= new Date());
    if (cds.length > 0) {
      cds.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
      setNextCountdown(cds[0]);
    }
    const sessions = getTodaySessions().filter(s => s.type === 'focus');
    setTodayFocus(sessions.reduce((a, s) => a + s.durationMinutes, 0));
    const todos = getTodos();
    setTasksDone({ done: todos.filter(t => t.completed).length, total: todos.length });
    setMistakeCount(getAllMistakes().length);
    try { if (localStorage.getItem('omr_autosave')) setHasAutosave(true); } catch {}
  }, []);

  const daysUntil = (date: string) => {
    const diff = new Date(date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const tools = [
    {
      icon: '📝', title: 'OMR Test',
      description: 'Practice with timed OMR-style tests',
      detail: testCount > 0 ? `${testCount} saved test${testCount > 1 ? 's' : ''}` : 'Start a new test',
      path: '/omr', accent: 'from-primary/20 to-primary/5',
    },
    {
      icon: '⏳', title: 'Countdowns',
      description: 'Track days until important events',
      detail: nextCountdown ? `${daysUntil(nextCountdown.targetDate)} days to ${nextCountdown.title}` : 'Add your first countdown',
      path: '/countdown', accent: 'from-accent/20 to-accent/5',
    },
    {
      icon: '🍅', title: 'Pomodoro',
      description: 'Focus timer with break management',
      detail: todayFocus > 0 ? `${todayFocus}m focused today` : 'Start a focus session',
      path: '/pomodoro', accent: 'from-destructive/20 to-destructive/5',
    },
    {
      icon: '✅', title: 'Tasks',
      description: 'Manage your to-do list with tags & priorities',
      detail: tasksDone.total > 0 ? `${tasksDone.done}/${tasksDone.total} completed` : 'Add your first task',
      path: '/todos', accent: 'from-[hsl(142,71%,40%)]/20 to-[hsl(142,71%,40%)]/5',
    },
    {
      icon: '📒', title: 'Notes',
      description: 'Concepts, mistakes & formula notes',
      detail: 'Build your knowledge base',
      path: '/notes', accent: 'from-[hsl(262,83%,58%)]/20 to-[hsl(262,83%,58%)]/5',
    },
    {
      icon: '🔍', title: 'Mistake Tracker',
      description: 'Review wrong questions across all tests',
      detail: mistakeCount > 0 ? `${mistakeCount} mistakes tracked` : 'Annotate mistakes in analysis',
      path: '/mistakes', accent: 'from-destructive/15 to-destructive/5',
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Autosave recovery */}
      {hasAutosave && (
        <div className="bg-[hsl(var(--review))]/10 border border-[hsl(var(--review))]/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-foreground">⚠️ Unsaved test found</div>
            <div className="text-xs text-muted-foreground">You have an auto-saved test in progress. Resume or discard it.</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              try {
                const raw = JSON.parse(localStorage.getItem('omr_autosave') || '');
                const store = useTestStore.getState();
                store.setConfig(raw.config);
                useTestStore.setState({ responses: raw.responses, startTime: raw.startTime || Date.now() });
                navigate('/test');
              } catch {}
            }} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold">Resume</button>
            <button onClick={() => { localStorage.removeItem('omr_autosave'); setHasAutosave(false); }}
              className="px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted">Discard</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-mono text-foreground tracking-tight">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋
        </h1>
        <p className="text-muted-foreground text-sm">Your personal productivity workspace</p>
      </div>

      {/* Quick stats banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {nextCountdown && (
          <div className="bg-gradient-to-r from-accent/15 to-transparent border border-accent/20 rounded-xl p-3 col-span-2 sm:col-span-1">
            <div className="text-2xl font-mono font-black text-accent">{daysUntil(nextCountdown.targetDate)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">days to {nextCountdown.title}</div>
          </div>
        )}
        {todayFocus > 0 && (
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-2xl font-mono font-black text-primary">{todayFocus}m</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">focused today</div>
          </div>
        )}
        {tasksDone.total > 0 && (
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-2xl font-mono font-black text-[hsl(var(--success))]">{tasksDone.done}/{tasksDone.total}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">tasks done</div>
          </div>
        )}
        {mistakeCount > 0 && (
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="text-2xl font-mono font-black text-destructive">{mistakeCount}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">mistakes tracked</div>
          </div>
        )}
      </div>

      {/* Tool cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <button key={tool.path} onClick={() => navigate(tool.path)}
            className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-md transition-all group">
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${tool.accent} flex items-center justify-center text-2xl mb-4`}>
              {tool.icon}
            </div>
            <h2 className="font-bold text-foreground group-hover:text-primary transition-colors">{tool.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
            <div className="text-xs font-mono text-primary/70 mt-3">{tool.detail}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
