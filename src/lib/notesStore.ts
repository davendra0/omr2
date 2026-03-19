export interface Note {
  id: string;
  title: string;
  content: string;
  subject: string;
  chapter: string;
  type: 'concept' | 'mistake' | 'formula' | 'general';
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const STORE_KEY = 'workspace_notes';

export const NOTE_TYPES: Record<Note['type'], { label: string; icon: string }> = {
  concept: { label: 'Concept', icon: '💡' },
  mistake: { label: 'Mistake', icon: '❌' },
  formula: { label: 'Formula', icon: '📐' },
  general: { label: 'General', icon: '📝' },
};

export const SUBJECTS = [
  'Physics', 'Chemistry', 'Biology', 'Mathematics',
  'English', 'History', 'Geography', 'Computer Science',
  'General', 'Other',
];

export function getNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch { return []; }
}

export function saveNotes(notes: Note[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(notes));
}

export function addNote(note: Note) {
  const all = getNotes();
  all.unshift(note);
  saveNotes(all);
}

export function updateNote(id: string, updates: Partial<Note>) {
  const all = getNotes().map(n => n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n);
  saveNotes(all);
  return all;
}

export function deleteNote(id: string) {
  const all = getNotes().filter(n => n.id !== id);
  saveNotes(all);
  return all;
}

export function getNotesBySubject(subject: string): Note[] {
  return getNotes().filter(n => n.subject === subject);
}

export function getNotesByChapter(subject: string, chapter: string): Note[] {
  return getNotes().filter(n => n.subject === subject && n.chapter === chapter);
}
