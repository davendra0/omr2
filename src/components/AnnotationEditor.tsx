import { useState, useCallback } from 'react';
import { 
  saveAnnotation, 
  type QuestionAnnotation, 
  type MistakeType, 
  MISTAKE_TYPES 
} from '@/lib/mistakeStore';

interface AnnotationEditorProps {
  testId: string;
  testName: string;
  questionNo: number;
  selected: string | null;
  correct: string | null;
  existing?: QuestionAnnotation;
  type?: string;
  onSave: () => void;
  onCancel: () => void;
}

export function AnnotationEditor({
  testId, testName, questionNo, selected, correct, existing, onSave, onCancel, type,
}: AnnotationEditorProps) {
  const [mistakeType, setMistakeType] = useState<MistakeType>(existing?.mistakeType || 'silly');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [imageData, setImageData] = useState<string | undefined>(existing?.imageData);
  const [tags, setTags] = useState<string[]>(existing?.tags || []);
  const [tagInput, setTagInput] = useState('');

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageFile(file);
        return;
      }
    }
  }, [handleImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleSave = () => {
    saveAnnotation({
      testId, testName, questionNo, mistakeType, notes, imageData, selected, correct, tags,
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
    });
    onSave();
  };

  return (
    <div className="bg-muted/50 border-b border-border px-4 py-3 space-y-3" onPaste={handlePaste} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="text-xs font-mono text-muted-foreground">
        Annotate Q.{questionNo} {type === 'numerical' && <span className="text-[10px] bg-primary/10 text-primary px-1 rounded ml-1">Numerical</span>} — You: <strong className="text-destructive">{selected || '—'}</strong> → Correct: <strong className="text-[hsl(var(--success))]">{correct || '—'}</strong>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground font-bold">MISTAKE TYPE</label>
        <div className="flex gap-1.5 flex-wrap mt-1">
          {(Object.entries(MISTAKE_TYPES) as [MistakeType, typeof MISTAKE_TYPES[MistakeType]][]).map(([type, meta]) => (
            <button key={type} onClick={() => setMistakeType(type)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                mistakeType === type ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground font-bold">NOTES</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why was this wrong?"
          className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs min-h-[80px] font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground font-bold">TAGS</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-mono font-bold">
              #{tag}
              <button onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-destructive">×</button>
            </span>
          ))}
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTag(tagInput); }
              if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1));
            }}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            placeholder="Add tags..."
            className="flex-1 min-w-[120px] h-7 px-2 bg-transparent text-foreground text-[11px] font-mono focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground font-bold">QUESTION IMAGE</label>
        <div className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
          {imageData ? (
            <div className="space-y-2">
              <img src={imageData} alt="Question" className="max-w-full max-h-48 mx-auto rounded-lg border border-border" />
              <div className="flex gap-2 justify-center">
                <button onClick={() => setImageData(undefined)} className="text-destructive text-[10px] hover:underline">Remove</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-2xl mb-1">📋</div>
              <div>Paste (Ctrl+V), drag & drop, or browse</div>
              <label className="inline-block px-3 py-1.5 bg-primary text-primary-foreground rounded text-[11px] font-bold cursor-pointer hover:opacity-90">
                📁 Browse File
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-xs">
          {existing ? 'Update' : 'Save'} Annotation
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg text-xs text-foreground hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}
