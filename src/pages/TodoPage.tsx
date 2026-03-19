import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getTodos, addTodo, updateTodo, deleteTodo,
  getSavedTags, saveTags, getSavedCategories, saveCategories,
  type Todo, type Subtask, COLOR_CLASSES,
} from '@/lib/todoStore';
import { usePomodoroTimer } from '@/store/pomodoroTimerStore';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

const PRIORITIES = ['low', 'medium', 'high'] as const;
const PRIORITY_ICONS: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };
const COLOR_OPTIONS = ['none', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
const COLOR_DOTS: Record<string, string> = {
  none: 'bg-muted', red: 'bg-destructive', orange: 'bg-[hsl(25,95%,53%)]',
  yellow: 'bg-accent', green: 'bg-[hsl(142,71%,40%)]', blue: 'bg-primary',
  purple: 'bg-[hsl(262,83%,58%)]', pink: 'bg-[hsl(330,81%,60%)]',
};

type Filter = 'all' | 'active' | 'completed' | 'today' | 'overdue' | 'upcoming';
type ViewMode = 'list' | 'calendar';

const TodoPage = () => {
  const [todos, setTodos] = useState<Todo[]>(getTodos);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calMonth, setCalMonth] = useState(() => new Date());
  const navigate = useNavigate();
  const timer = usePomodoroTimer();

  const today = new Date().toISOString().slice(0, 10);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    todos.forEach(t => t.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags);
  }, [todos]);

  const allCategories = useMemo(() => {
    const cats = new Set(getSavedCategories());
    todos.forEach(t => { if (t.category) cats.add(t.category); });
    return Array.from(cats);
  }, [todos]);

  const filtered = useMemo(() => {
    let list = todos;
    if (filter === 'active') list = list.filter(t => !t.completed);
    if (filter === 'completed') list = list.filter(t => t.completed);
    if (filter === 'today') list = list.filter(t => t.dueDate === today);
    if (filter === 'overdue') list = list.filter(t => !t.completed && t.dueDate && t.dueDate < today);
    if (filter === 'upcoming') list = list.filter(t => !t.completed && t.dueDate && t.dueDate > today);
    if (tagFilter) list = list.filter(t => t.tags.includes(tagFilter));
    if (categoryFilter) list = list.filter(t => t.category === categoryFilter);
    return list;
  }, [todos, filter, tagFilter, categoryFilter, today]);

  const handleAdd = (todo: Todo) => {
    addTodo(todo);
    setTodos(getTodos());
    setShowAdd(false);
    const existing = getSavedTags();
    saveTags([...existing, ...todo.tags]);
    if (todo.category) {
      const cats = getSavedCategories();
      if (!cats.includes(todo.category)) saveCategories([...cats, todo.category]);
    }
  };

  const handleToggle = (id: string) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    setTodos(updateTodo(id, { completed: !todo.completed, completedAt: !todo.completed ? Date.now() : undefined }));
  };

  const handleDelete = (id: string) => { setTodos(deleteTodo(id)); };
  const handleUpdate = (id: string, updates: Partial<Todo>) => {
    setTodos(updateTodo(id, updates));
    setEditingId(null);
  };

  const handleStartPomo = useCallback((todo: Todo) => {
    timer.setLabel(todo.title);
    if (todo.category) timer.setSubject(todo.category);
    if (todo.estimatedMinutes) {
      timer.setPhase('focus', todo.estimatedMinutes * 60);
    }
    timer.setRunning(true);
    navigate('/pomodoro');
  }, [timer, navigate]);

  const handleToggleSubtask = (todoId: string, subtaskId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;
    const subtasks = (todo.subtasks || []).map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
    setTodos(updateTodo(todoId, { subtasks }));
  };

  const stats = {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    overdue: todos.filter(t => !t.completed && t.dueDate && t.dueDate < today).length,
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold font-mono text-foreground">✅ Tasks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats.completed}/{stats.total} done
            {stats.overdue > 0 && <span className="text-destructive"> · {stats.overdue} overdue</span>}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
            className="px-2.5 py-1.5 border border-border rounded-lg text-xs text-foreground hover:bg-muted transition-colors">
            {viewMode === 'list' ? '📅' : '📋'}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
            + Task
          </button>
        </div>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">New Task</DialogTitle>
            <DialogDescription>Add a new task with details, subtasks and tags.</DialogDescription>
          </DialogHeader>
          <AddTodoForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} savedTags={allTags} categories={allCategories} />
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">Edit Task</DialogTitle>
            <DialogDescription>Update task details.</DialogDescription>
          </DialogHeader>
          {editingId && (() => {
            const todo = todos.find(t => t.id === editingId);
            if (!todo) return null;
            return <EditTodoForm todo={todo} onSave={(u) => handleUpdate(todo.id, u)} onCancel={() => setEditingId(null)} savedTags={allTags} categories={allCategories} />;
          })()}
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex gap-1 flex-wrap items-center">
        {(['all', 'active', 'completed', 'today', 'upcoming', 'overdue'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {f === 'all' ? 'All' : f === 'active' ? 'Active' : f === 'completed' ? 'Done' : f === 'today' ? 'Today' : f === 'upcoming' ? 'Upcoming' : 'Overdue'}
          </button>
        ))}
        {allCategories.length > 0 && (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-6 px-1.5 border border-border rounded-lg bg-background text-foreground text-[11px]">
            <option value="">All Categories</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {allTags.length > 0 && (
          <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
            className="h-6 px-1.5 border border-border rounded-lg bg-background text-foreground text-[11px]">
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
      </div>

      {viewMode === 'calendar' ? (
        <CalendarView todos={todos} month={calMonth} onMonthChange={setCalMonth}
          onToggle={handleToggle} onEdit={setEditingId} onStartPomo={handleStartPomo} today={today} />
      ) : (
        <div className="space-y-1.5">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {filter === 'all' ? 'No tasks yet. Add one!' : 'No tasks match this filter.'}
            </div>
          )}
          {filtered.map(todo => (
            <TodoItem key={todo.id} todo={todo} today={today}
              onToggle={() => handleToggle(todo.id)}
              onDelete={() => handleDelete(todo.id)}
              onEdit={() => setEditingId(todo.id)}
              onStartPomo={() => handleStartPomo(todo)}
              onToggleSubtask={(sid) => handleToggleSubtask(todo.id, sid)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ──── Calendar View ──── */
function CalendarView({ todos, month, onMonthChange, onToggle, onEdit, onStartPomo, today }: {
  todos: Todo[]; month: Date; onMonthChange: (d: Date) => void;
  onToggle: (id: string) => void; onEdit: (id: string) => void;
  onStartPomo: (t: Todo) => void; today: string;
}) {
  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDay = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const days: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);

  const getDateStr = (d: number) => `${year}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todosByDate = useMemo(() => {
    const map: Record<string, Todo[]> = {};
    todos.forEach(t => { if (t.dueDate) { (map[t.dueDate] = map[t.dueDate] || []).push(t); } });
    return map;
  }, [todos]);

  const prev = () => onMonthChange(new Date(year, mo - 1, 1));
  const next = () => onMonthChange(new Date(year, mo + 1, 1));

  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1.5 hover:bg-muted rounded text-foreground">◀</button>
        <span className="font-mono font-bold text-sm text-foreground">
          {month.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={next} className="p-1.5 hover:bg-muted rounded text-foreground">▶</button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center text-[10px] font-mono text-muted-foreground mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {days.map((d, i) => {
          if (d === null) return <div key={i} className="min-h-[60px]" />;
          const dateStr = getDateStr(d);
          const dayTodos = todosByDate[dateStr] || [];
          const isToday = dateStr === today;
          return (
            <div key={i} className={`min-h-[60px] p-0.5 border border-border/30 rounded ${isToday ? 'bg-primary/5 ring-1 ring-primary/30' : ''}`}>
              <div className={`text-[10px] font-mono font-bold mb-0.5 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{d}</div>
              {dayTodos.slice(0, 3).map(t => (
                <button key={t.id} onClick={() => onEdit(t.id)}
                  className={`w-full text-left text-[8px] px-0.5 rounded truncate mb-px ${t.completed ? 'text-muted-foreground line-through' : 'text-foreground'} hover:bg-muted`}>
                  {PRIORITY_ICONS[t.priority]} {t.title}
                </button>
              ))}
              {dayTodos.length > 3 && <div className="text-[8px] text-muted-foreground">+{dayTodos.length - 3}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──── Todo Item ──── */
function TodoItem({ todo, today, onToggle, onDelete, onEdit, onStartPomo, onToggleSubtask }: {
  todo: Todo; today: string;
  onToggle: () => void; onDelete: () => void; onEdit: () => void;
  onStartPomo: () => void; onToggleSubtask: (sid: string) => void;
}) {
  const isOverdue = !todo.completed && todo.dueDate && todo.dueDate < today;
  const subtasks = todo.subtasks || [];
  const subtaskDone = subtasks.filter(s => s.completed).length;

  return (
    <div className={`bg-card border border-border rounded-xl p-3 border-l-4 ${COLOR_CLASSES[todo.color] || ''} group`}>
      <div className="flex gap-3 items-start">
        <button onClick={onToggle}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            todo.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary'
          }`}>
          {todo.completed && <span className="text-xs">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {PRIORITY_ICONS[todo.priority]} {todo.title}
          </div>
          {todo.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{todo.description}</div>}
          <div className="flex gap-1.5 mt-1 flex-wrap items-center">
            {todo.dueDate && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                📅 {todo.dueDate}{todo.dueTime ? ` ${todo.dueTime}` : ''}
              </span>
            )}
            {todo.category && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent-foreground">{todo.category}</span>
            )}
            {todo.estimatedMinutes && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">⏱ {todo.estimatedMinutes}m</span>
            )}
            {todo.tags.map(tag => (
              <span key={tag} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">#{tag}</span>
            ))}
            {subtasks.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">☑ {subtaskDone}/{subtasks.length}</span>
            )}
          </div>
        </div>

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!todo.completed && (
            <button onClick={onStartPomo} className="text-xs text-muted-foreground hover:text-primary p-1" title="Start Pomodoro">🍅</button>
          )}
          <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-foreground p-1">✏️</button>
          <button onClick={onDelete} className="text-xs text-muted-foreground hover:text-destructive p-1">🗑</button>
        </div>
      </div>

      {/* Subtasks */}
      {subtasks.length > 0 && (
        <div className="ml-8 mt-1.5 space-y-0.5">
          {subtasks.map(s => (
            <button key={s.id} onClick={() => onToggleSubtask(s.id)}
              className="flex items-center gap-1.5 text-xs w-full text-left hover:bg-muted/30 rounded px-1 py-0.5">
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${s.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                {s.completed && <span className="text-[8px]">✓</span>}
              </span>
              <span className={s.completed ? 'line-through text-muted-foreground' : 'text-foreground'}>{s.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──── Add Form (inside dialog) ──── */
function AddTodoForm({ onAdd, onCancel, savedTags, categories }: {
  onAdd: (t: Todo) => void; onCancel: () => void; savedTags: string[]; categories: string[];
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [color, setColor] = useState('none');
  const [priority, setPriority] = useState<Todo['priority']>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [category, setCategory] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const addTag = () => { const t = tagInput.trim().toLowerCase(); if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); } };
  const addSubtask = () => {
    const t = subtaskInput.trim();
    if (t) { setSubtasks([...subtasks, { id: crypto.randomUUID(), title: t, completed: false }]); setSubtaskInput(''); }
  };

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      id: crypto.randomUUID(), title: title.trim(), description: description.trim(),
      completed: false, dueDate: dueDate || undefined, dueTime: dueTime || undefined,
      tags, color, priority, createdAt: Date.now(),
      estimatedMinutes: estimatedMinutes ? +estimatedMinutes : undefined,
      category: category || undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <input type="text" placeholder="Task title..." value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
        className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" />
      <textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs min-h-[50px] focus:outline-none focus:ring-2 focus:ring-primary" />

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Due Time</label>
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Est. Minutes</label>
          <input type="number" min={1} placeholder="25" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs">
            <option value="">None</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Priority</label>
          <div className="flex gap-1 mt-0.5">
            {PRIORITIES.map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${priority === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {PRIORITY_ICONS[p]} {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground">Color</label>
        <div className="flex gap-1.5 mt-0.5">
          {COLOR_OPTIONS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full ${COLOR_DOTS[c]} border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`} />
          ))}
        </div>
      </div>

      {/* Subtasks */}
      <div>
        <label className="text-[10px] text-muted-foreground">Subtasks</label>
        {subtasks.map(s => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs mt-0.5">
            <span className="text-foreground flex-1">• {s.title}</span>
            <button onClick={() => setSubtasks(subtasks.filter(x => x.id !== s.id))} className="text-muted-foreground hover:text-destructive text-[10px]">×</button>
          </div>
        ))}
        <div className="flex gap-1 mt-1">
          <input type="text" placeholder="Add subtask..." value={subtaskInput}
            onChange={(e) => setSubtaskInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
            className="flex-1 h-7 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={addSubtask} className="px-2 py-1 bg-muted rounded text-xs text-foreground hover:bg-muted/80">+</button>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-[10px] text-muted-foreground">Tags</label>
        <div className="flex gap-1 flex-wrap mt-0.5">
          {tags.map(t => (
            <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
              #{t} <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          <input type="text" placeholder="Add tag..." value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            className="flex-1 h-7 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
          {savedTags.filter(t => !tags.includes(t)).slice(0, 4).map(t => (
            <button key={t} onClick={() => setTags([...tags, t])}
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground">#{t}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={submit} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm flex-1">Add Task</button>
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}

/* ──── Edit Form (inside dialog) ──── */
function EditTodoForm({ todo, onSave, onCancel, savedTags, categories }: {
  todo: Todo; onSave: (u: Partial<Todo>) => void; onCancel: () => void; savedTags: string[]; categories: string[];
}) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description);
  const [dueDate, setDueDate] = useState(todo.dueDate || '');
  const [dueTime, setDueTime] = useState(todo.dueTime || '');
  const [tags, setTags] = useState(todo.tags);
  const [tagInput, setTagInput] = useState('');
  const [color, setColor] = useState(todo.color);
  const [priority, setPriority] = useState(todo.priority);
  const [estimatedMinutes, setEstimatedMinutes] = useState(String(todo.estimatedMinutes || ''));
  const [category, setCategory] = useState(todo.category || '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(todo.subtasks || []);
  const [subtaskInput, setSubtaskInput] = useState('');

  const addTag = () => { const t = tagInput.trim().toLowerCase(); if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); } };
  const addSubtask = () => {
    const t = subtaskInput.trim();
    if (t) { setSubtasks([...subtasks, { id: crypto.randomUUID(), title: t, completed: false }]); setSubtaskInput(''); }
  };

  return (
    <div className="space-y-3">
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
        className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs min-h-[50px] focus:outline-none focus:ring-2 focus:ring-primary" />
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Due Date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Due Time</label>
          <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Est. Min</label>
          <input type="number" min={1} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full h-8 px-2 border border-border rounded-lg bg-background text-foreground text-xs">
            <option value="">None</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground">Priority</label>
          <div className="flex gap-1 mt-0.5">
            {PRIORITIES.map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${priority === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {PRIORITY_ICONS[p]} {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">Color</label>
        <div className="flex gap-1.5 mt-0.5">
          {COLOR_OPTIONS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full ${COLOR_DOTS[c]} border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`} />
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">Subtasks</label>
        {subtasks.map(s => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs mt-0.5">
            <span className={`flex-1 ${s.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>• {s.title}</span>
            <button onClick={() => setSubtasks(subtasks.filter(x => x.id !== s.id))} className="text-muted-foreground hover:text-destructive text-[10px]">×</button>
          </div>
        ))}
        <div className="flex gap-1 mt-1">
          <input type="text" placeholder="Add subtask..." value={subtaskInput}
            onChange={(e) => setSubtaskInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
            className="flex-1 h-7 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground">Tags</label>
        <div className="flex gap-1 flex-wrap mt-0.5">
          {tags.map(t => (
            <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1">
              #{t} <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          <input type="text" placeholder="Add tag..." value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            className="flex-1 h-7 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave({
          title, description, dueDate: dueDate || undefined, dueTime: dueTime || undefined,
          tags, color, priority, estimatedMinutes: estimatedMinutes ? +estimatedMinutes : undefined,
          category: category || undefined, subtasks: subtasks.length > 0 ? subtasks : undefined,
        })} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm flex-1">Save</button>
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}

export default TodoPage;
