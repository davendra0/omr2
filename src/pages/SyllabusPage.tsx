import { useMemo, useState, useCallback } from 'react';
import {
  addNoteToSubtopic,
  addSubtopic,
  deleteNote,
  deleteSubtopic,
  getChapters,
  saveChapters,
  type Chapter,
  type SubtopicNote,
  updateChapter,
} from '@/lib/syllabusStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SUBJECT_LABELS: Record<Chapter['subject'], string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
};

const SUBJECT_COLORS: Record<Chapter['subject'], string> = {
  physics: 'border-l-[hsl(var(--primary))]',
  chemistry: 'border-l-[hsl(var(--success))]',
  biology: 'border-l-[hsl(var(--accent))]',
};

const SUBJECT_BG: Record<Chapter['subject'], string> = {
  physics: 'bg-primary/5',
  chemistry: 'bg-[hsl(var(--success))]/5',
  biology: 'bg-accent/5',
};

const SUBJECT_BADGE: Record<Chapter['subject'], string> = {
  physics: 'bg-primary/10 text-primary',
  chemistry: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
  biology: 'bg-accent/10 text-accent',
};

const NOTE_TYPE_LABELS: Record<SubtopicNote['type'], string> = {
  mistake: '🔴 Mistake',
  weak_point: '🟡 Weak Point',
  concept: '🔵 Concept Gap',
};

const NOTE_TYPE_BADGE: Record<SubtopicNote['type'], string> = {
  mistake: 'bg-destructive/10 text-destructive border-destructive/20',
  weak_point: 'bg-accent/10 text-accent-foreground border-accent/20',
  concept: 'bg-primary/10 text-primary border-primary/20',
};

// --- Sortable Chapter Tile ---
function ChapterTile({
  chapter,
  onClick,
}: {
  chapter: Chapter;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
  };

  const noteCount = chapter.subtopics.reduce((sum, st) => sum + st.notes.length, 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`group relative rounded-xl border-l-4 border border-border ${SUBJECT_COLORS[chapter.subject]} ${SUBJECT_BG[chapter.subject]} cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]`}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="absolute top-2 right-2 p-1 rounded text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        title="Drag to reorder"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </div>

      <div className="p-3.5 pr-8">
        <h3 className="font-semibold text-foreground text-sm leading-tight">{chapter.name}</h3>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${SUBJECT_BADGE[chapter.subject]}`}>
            {SUBJECT_LABELS[chapter.subject]}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {chapter.class}
          </span>
          {chapter.category && (
            <span className="text-[10px] text-muted-foreground">• {chapter.category}</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          {chapter.subtopics.length > 0 && (
            <span>{chapter.subtopics.length} subtopic{chapter.subtopics.length !== 1 ? 's' : ''}</span>
          )}
          {noteCount > 0 && (
            <span>{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Chapter Detail Dialog ---
function ChapterDetail({
  chapter,
  open,
  onClose,
  onUpdate,
}: {
  chapter: Chapter | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (chapters: Chapter[]) => void;
}) {
  const [newSubtopic, setNewSubtopic] = useState('');
  const [noteDialog, setNoteDialog] = useState<{ subtopicId: string } | null>(null);
  const [noteType, setNoteType] = useState<SubtopicNote['type']>('mistake');
  const [noteText, setNoteText] = useState('');

  if (!chapter) return null;

  const handleAddSubtopic = () => {
    if (!newSubtopic.trim()) return;
    onUpdate(addSubtopic(chapter.id, newSubtopic.trim()));
    setNewSubtopic('');
  };

  const handleSaveNote = () => {
    if (!noteDialog || !noteText.trim()) return;
    onUpdate(addNoteToSubtopic(chapter.id, noteDialog.subtopicId, noteType, noteText.trim()));
    setNoteText('');
    setNoteType('mistake');
    setNoteDialog(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${SUBJECT_BADGE[chapter.subject]}`}>
              {SUBJECT_LABELS[chapter.subject]}
            </span>
            <span className="text-xs text-muted-foreground">Class {chapter.class}</span>
            {chapter.category && <span className="text-xs text-muted-foreground">• {chapter.category}</span>}
          </div>
          <DialogTitle className="text-xl">{chapter.name}</DialogTitle>
          <DialogDescription>
            Manage subtopics and notes for this chapter.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Add subtopic */}
          <div className="flex gap-2">
            <Input
              value={newSubtopic}
              onChange={(e) => setNewSubtopic(e.target.value)}
              placeholder="Add a subtopic..."
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtopic()}
              className="text-sm"
            />
            <Button onClick={handleAddSubtopic} size="sm" disabled={!newSubtopic.trim()}>
              Add
            </Button>
          </div>

          {/* Subtopics list */}
          {chapter.subtopics.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No subtopics yet. Add one above to start organizing.
            </div>
          ) : (
            <div className="space-y-3">
              {chapter.subtopics.map((st) => (
                <div key={st.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground text-sm">{st.name}</h4>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setNoteDialog({ subtopicId: st.id }); setNoteType('mistake'); setNoteText(''); }}
                      >
                        + Note
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => onUpdate(deleteSubtopic(chapter.id, st.id))}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>

                  {st.notes.length > 0 && (
                    <div className="space-y-1.5 pl-2 border-l-2 border-border ml-1">
                      {st.notes.map((note) => (
                        <div key={note.id} className="group/note flex items-start justify-between gap-2 py-1">
                          <div className="flex-1 min-w-0">
                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${NOTE_TYPE_BADGE[note.type]}`}>
                              {NOTE_TYPE_LABELS[note.type]}
                            </span>
                            <p className="text-xs text-foreground mt-0.5 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          </div>
                          <button
                            onClick={() => onUpdate(deleteNote(chapter.id, st.id, note.id))}
                            className="opacity-0 group-hover/note:opacity-100 text-muted-foreground hover:text-destructive text-xs transition-opacity shrink-0 mt-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inline note editor */}
        {noteDialog && (
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">New note:</span>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as SubtopicNote['type'])}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground"
              >
                <option value="mistake">🔴 Mistake</option>
                <option value="weak_point">🟡 Weak Point</option>
                <option value="concept">🔵 Concept Gap</option>
              </select>
            </div>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Describe the mistake, weak point, or concept gap..."
              className="text-sm min-h-[60px]"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveNote} disabled={!noteText.trim()}>Save Note</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page ---
const SyllabusPage = () => {
  const [chapters, setChapters] = useState<Chapter[]>(() => getChapters());
  const [subjectFilter, setSubjectFilter] = useState<'all' | Chapter['subject']>('all');
  const [classFilter, setClassFilter] = useState<'all' | Chapter['class']>('all');
  const [search, setSearch] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => {
    return chapters.filter((ch) => {
      const subjectOk = subjectFilter === 'all' || ch.subject === subjectFilter;
      const classOk = classFilter === 'all' || ch.class === classFilter;
      const searchOk =
        search.trim() === '' ||
        ch.name.toLowerCase().includes(search.toLowerCase()) ||
        ch.subtopics.some((s) => s.name.toLowerCase().includes(search.toLowerCase()));
      return subjectOk && classOk && searchOk;
    });
  }, [chapters, subjectFilter, classFilter, search]);

  const updateAndSet = useCallback((next: Chapter[]) => {
    setChapters(next);
    // Refresh selected chapter if open
    setSelectedChapter((prev) => prev ? next.find((c) => c.id === prev.id) || null : null);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((c) => c.id === active.id);
    const newIndex = filtered.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder in the filtered view, then apply back to full list
    const reordered = arrayMove(filtered, oldIndex, newIndex);
    // Assign priorities: highest priority to first item
    const maxPriority = reordered.length;
    const updatedIds = new Map(reordered.map((ch, i) => [ch.id, maxPriority - i]));

    const allUpdated = chapters.map((ch) => ({
      ...ch,
      priority: updatedIds.has(ch.id) ? updatedIds.get(ch.id)! : ch.priority,
    }));

    saveChapters(allUpdated);
    setChapters(allUpdated);
  };

  const stats = useMemo(() => {
    const total = filtered.length;
    const withNotes = filtered.filter((ch) => ch.subtopics.some((st) => st.notes.length > 0)).length;
    const totalNotes = filtered.reduce((s, ch) => s + ch.subtopics.reduce((s2, st) => s2 + st.notes.length, 0), 0);
    const totalSubtopics = filtered.reduce((s, ch) => s + ch.subtopics.length, 0);
    return { total, withNotes, totalNotes, totalSubtopics };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background p-4 pb-16">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h1 className="text-2xl font-bold text-foreground font-mono">📚 Syllabus Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag tiles to prioritize. Click any chapter to manage subtopics &amp; notes.
          </p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground">Chapters</p>
              <p className="text-xl font-bold font-mono text-foreground">{stats.total}</p>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground">Subtopics</p>
              <p className="text-xl font-bold font-mono text-primary">{stats.totalSubtopics}</p>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground">Notes</p>
              <p className="text-xl font-bold font-mono text-accent-foreground">{stats.totalNotes}</p>
            </div>
            <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground">With Notes</p>
              <p className="text-xl font-bold font-mono text-foreground">{stats.withNotes}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search chapters..."
            className="w-full sm:w-64"
          />
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value as typeof subjectFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">All Subjects</option>
            <option value="physics">Physics</option>
            <option value="chemistry">Chemistry</option>
            <option value="biology">Biology</option>
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value as typeof classFilter)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="all">All Classes</option>
            <option value="11th">Class 11th</option>
            <option value="12th">Class 12th</option>
          </select>
        </div>

        {/* Chapter tiles grid with drag & drop */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filtered.map((c) => c.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((chapter) => (
                <ChapterTile
                  key={chapter.id}
                  chapter={chapter}
                  onClick={() => setSelectedChapter(chapter)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No chapters match your filters.
          </div>
        )}
      </div>

      {/* Chapter detail dialog */}
      <ChapterDetail
        chapter={selectedChapter}
        open={!!selectedChapter}
        onClose={() => setSelectedChapter(null)}
        onUpdate={updateAndSet}
      />
    </div>
  );
};

export default SyllabusPage;
