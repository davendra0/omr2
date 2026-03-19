import { useState, useMemo } from 'react';
import {
  getNotes, addNote, updateNote, deleteNote,
  type Note, NOTE_TYPES, SUBJECTS,
} from '@/lib/notesStore';

const NotesPage = () => {
  const [notes, setNotes] = useState<Note[]>(getNotes);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const subjects = useMemo(() => [...new Set(notes.map(n => n.subject))], [notes]);
  const chapters = useMemo(() => {
    if (!filterSubject) return [];
    return [...new Set(notes.filter(n => n.subject === filterSubject).map(n => n.chapter).filter(Boolean))];
  }, [notes, filterSubject]);

  const filtered = useMemo(() => {
    let list = notes;
    if (filterSubject) list = list.filter(n => n.subject === filterSubject);
    if (filterType) list = list.filter(n => n.type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.chapter.toLowerCase().includes(q) ||
        n.tags.some(t => t.includes(q))
      );
    }
    return list;
  }, [notes, filterSubject, filterType, searchQuery]);

  const handleAdd = (note: Note) => {
    addNote(note);
    setNotes(getNotes());
    setShowAdd(false);
  };

  const handleUpdate = (id: string, updates: Partial<Note>) => {
    setNotes(updateNote(id, updates));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    setNotes(deleteNote(id));
  };

  // Stats
  const typeStats = Object.entries(NOTE_TYPES).map(([type, meta]) => ({
    type, ...meta,
    count: notes.filter(n => n.type === type).length,
  }));

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono text-foreground">📒 Notes</h1>
          <p className="text-xs text-muted-foreground mt-1">Concepts, mistakes & formulas</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
          + New Note
        </button>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 flex-wrap">
        {typeStats.map(s => (
          <button key={s.type} onClick={() => setFilterType(filterType === s.type ? '' : s.type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterType === s.type ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
            {s.icon} {s.label} ({s.count})
          </button>
        ))}
      </div>

      {showAdd && <NoteForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input type="text" placeholder="🔍 Search notes..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 h-9 px-3 border border-border rounded-lg bg-background text-foreground text-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-primary" />
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
          className="h-9 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary">
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {chapters.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          <span className="text-xs text-muted-foreground py-1">Chapters:</span>
          {chapters.map(c => (
            <span key={c} className="text-[10px] font-mono px-2 py-1 rounded bg-muted text-muted-foreground">{c}</span>
          ))}
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No notes yet. Create your first one above!</div>
        )}
        {filtered.map(note => (
          editingId === note.id ? (
            <NoteForm key={note.id} note={note} onSave={(u) => handleUpdate(note.id, u)} onCancel={() => setEditingId(null)} />
          ) : (
            <div key={note.id} className="bg-card border border-border rounded-xl p-4 space-y-2 group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{NOTE_TYPES[note.type]?.icon}</span>
                    <span className="text-sm font-bold text-foreground">{note.title}</span>
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">{note.subject}</span>
                    {note.chapter && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{note.chapter}</span>
                    )}
                    {note.tags.map(t => (
                      <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/10 text-accent">#{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setExpandedId(expandedId === note.id ? null : note.id)}
                    className="text-xs text-muted-foreground hover:text-foreground p-1">
                    {expandedId === note.id ? '🔼' : '🔽'}
                  </button>
                  <button onClick={() => setEditingId(note.id)} className="text-xs text-muted-foreground hover:text-foreground p-1">✏️</button>
                  <button onClick={() => handleDelete(note.id)} className="text-xs text-muted-foreground hover:text-destructive p-1">🗑</button>
                </div>
              </div>

              {expandedId === note.id && (
                <div className="pt-2 border-t border-border">
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">{note.content}</pre>
                  <div className="text-[10px] text-muted-foreground mt-2 font-mono">
                    Created: {new Date(note.createdAt).toLocaleDateString()} · Updated: {new Date(note.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              )}

              {expandedId !== note.id && note.content && (
                <button onClick={() => setExpandedId(note.id)}
                  className="text-xs text-muted-foreground line-clamp-1 text-left w-full hover:text-foreground transition-colors">
                  {note.content.slice(0, 100)}...
                </button>
              )}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

function NoteForm({ note, onSave, onCancel }: {
  note?: Note;
  onSave: (n: any) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [subject, setSubject] = useState(note?.subject || '');
  const [chapter, setChapter] = useState(note?.chapter || '');
  const [type, setType] = useState<Note['type']>(note?.type || 'general');
  const [tags, setTags] = useState<string[]>(note?.tags || []);
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); }
  };

  const submit = () => {
    if (!title.trim() || !subject) return;
    if (note) {
      onSave({ title, content, subject, chapter, type, tags });
    } else {
      onSave({
        id: crypto.randomUUID(),
        title: title.trim(),
        content,
        subject,
        chapter: chapter.trim(),
        type,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  };

  return (
    <div className="bg-card border-2 border-primary/30 rounded-xl p-4 space-y-3">
      <input type="text" placeholder="Note title..." value={title} onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" />

      <div className="flex gap-2 flex-wrap">
        {(Object.entries(NOTE_TYPES) as [Note['type'], { label: string; icon: string }][]).map(([t, meta]) => (
          <button key={t} onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {meta.icon} {meta.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Subject *</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}
            className="w-full h-9 px-2 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select subject</option>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Chapter</label>
          <input type="text" placeholder="e.g. Electrochemistry" value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            className="w-full h-9 px-3 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      <textarea placeholder="Write your note here... (concepts, mistakes, formulas)" value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs min-h-[120px] font-mono focus:outline-none focus:ring-2 focus:ring-primary" />

      <div>
        <label className="text-xs text-muted-foreground">Tags</label>
        <div className="flex gap-1 flex-wrap mt-1">
          {tags.map(t => (
            <span key={t} className="text-[10px] font-mono px-2 py-1 rounded bg-primary/10 text-primary flex items-center gap-1">
              #{t} <button onClick={() => setTags(tags.filter(x => x !== t))} className="hover:text-destructive">×</button>
            </span>
          ))}
        </div>
        <input type="text" placeholder="Add tag + Enter" value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          className="w-full h-8 px-2 mt-1 border border-border rounded-lg bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <div className="flex gap-2">
        <button onClick={submit} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm">
          {note ? 'Save' : 'Create Note'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}

export default NotesPage;
