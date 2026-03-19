import { useState, useEffect } from 'react';
import { getCountdowns, saveCountdown, deleteCountdown, updateCountdown, type Countdown } from '@/lib/countdownStore';

const STYLES: { value: Countdown['style']; label: string }[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'bold', label: 'Bold' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'outline', label: 'Outline' },
];

const CountdownPage = () => {
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [style, setStyle] = useState<Countdown['style']>('bold');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setCountdowns(getCountdowns());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const handleAdd = () => {
    if (!title.trim() || !date) return;
    const cd: Countdown = {
      id: crypto.randomUUID(),
      title: title.trim(),
      targetDate: date,
      style,
      createdAt: Date.now(),
    };
    saveCountdown(cd);
    setCountdowns(getCountdowns());
    setTitle('');
    setDate('');
    setShowAdd(false);
  };

  const handleEdit = (cd: Countdown) => {
    setEditingId(cd.id);
    setTitle(cd.title);
    setDate(cd.targetDate);
    setStyle(cd.style);
  };

  const handleSaveEdit = () => {
    if (!editingId || !title.trim() || !date) return;
    updateCountdown(editingId, { title: title.trim(), targetDate: date, style });
    setCountdowns(getCountdowns());
    setEditingId(null);
    setTitle('');
    setDate('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setDate('');
  };

  const handleDelete = (id: string) => {
    deleteCountdown(id);
    setCountdowns(getCountdowns());
  };

  const handleStyleChange = (id: string, newStyle: Countdown['style']) => {
    updateCountdown(id, { style: newStyle });
    setCountdowns(getCountdowns());
  };

  const getDaysHours = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, passed: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, passed: false };
  };

  const styleClasses: Record<Countdown['style'], string> = {
    minimal: 'bg-card border border-border',
    bold: 'bg-primary/10 border-2 border-primary/30',
    gradient: 'bg-gradient-to-br from-primary/20 via-accent/10 to-destructive/10 border border-border',
    outline: 'bg-transparent border-2 border-dashed border-primary/40',
  };

  const numberClasses: Record<Countdown['style'], string> = {
    minimal: 'text-foreground',
    bold: 'text-primary',
    gradient: 'text-primary',
    outline: 'text-primary',
  };

  const sorted = [...countdowns].sort((a, b) => {
    const aT = new Date(a.targetDate).getTime();
    const bT = new Date(b.targetDate).getTime();
    const aPassed = aT < now;
    const bPassed = bT < now;
    if (aPassed !== bPassed) return aPassed ? 1 : -1;
    return aT - bT;
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono text-foreground">⏳ Countdowns</h1>
          <p className="text-xs text-muted-foreground mt-1">Track days until important events</p>
        </div>
        <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
          + Add
        </button>
      </div>

      {/* Add / Edit form */}
      {(showAdd || editingId) && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold font-mono text-foreground">{editingId ? '✏️ Edit Countdown' : '➕ New Countdown'}</h3>
          <input type="text" placeholder="Event name (e.g. JEE Mains)" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex gap-2 flex-wrap">
            {STYLES.map((s) => (
              <button key={s.value} onClick={() => setStyle(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${style === s.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={editingId ? handleSaveEdit : handleAdd} disabled={!title.trim() || !date}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-40">
              {editingId ? 'Save Changes' : 'Save'}
            </button>
            <button onClick={editingId ? handleCancelEdit : () => setShowAdd(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !showAdd && (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-sm">No countdowns yet. Add one to track important dates!</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {sorted.map((cd) => {
          const { days, hours, minutes, passed } = getDaysHours(cd.targetDate);
          return (
            <div key={cd.id} className={`rounded-xl p-5 transition-all ${styleClasses[cd.style]} ${passed ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="font-bold text-foreground text-sm">{cd.title}</div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(cd)} className="text-muted-foreground hover:text-primary text-xs p-1" title="Edit">✏️</button>
                  <button onClick={() => {
                    const idx = STYLES.findIndex(s => s.value === cd.style);
                    handleStyleChange(cd.id, STYLES[(idx + 1) % STYLES.length].value);
                  }} className="text-muted-foreground hover:text-primary text-xs p-1" title="Change style">🎨</button>
                  <button onClick={() => handleDelete(cd.id)} className="text-muted-foreground hover:text-destructive text-xs p-1" title="Delete">🗑</button>
                </div>
              </div>

              {passed ? (
                <div className="mt-3 text-lg font-mono font-bold text-muted-foreground">Event passed ✓</div>
              ) : (
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`text-4xl font-mono font-black ${numberClasses[cd.style]}`}>{days}</span>
                  <span className="text-sm text-muted-foreground font-mono">d</span>
                  <span className={`text-xl font-mono font-bold ${numberClasses[cd.style]} ml-1`}>{hours}</span>
                  <span className="text-sm text-muted-foreground font-mono">h</span>
                  <span className={`text-xl font-mono font-bold ${numberClasses[cd.style]} ml-1`}>{minutes}</span>
                  <span className="text-sm text-muted-foreground font-mono">m</span>
                </div>
              )}

              <div className="text-xs text-muted-foreground mt-2 font-mono">
                {new Date(cd.targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CountdownPage;
