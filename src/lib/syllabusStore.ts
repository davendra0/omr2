export interface SubtopicNote {
  id: string;
  content: string;
  type: 'mistake' | 'weak_point' | 'concept';
  createdAt: number;
  updatedAt: number;
}

export interface Subtopic {
  id: string;
  name: string;
  completed: boolean;
  notes: SubtopicNote[];
}

export interface Chapter {
  id: string;
  name: string;
  subject: 'physics' | 'chemistry' | 'biology';
  class: '11th' | '12th';
  category?: string;
  priority: number; // 1-5, 5 being highest priority
  completed: boolean;
  subtopics: Subtopic[];
}

const STORE_KEY = 'workspace_syllabus';

// Pre-populated chapters based on user input
const INITIAL_CHAPTERS: Omit<Chapter, 'id' | 'subtopics' | 'completed' | 'priority'>[] = [
  // Physics - Class 11th
  { name: 'U&D + Vector', subject: 'physics', class: '11th' },
  { name: '1D', subject: 'physics', class: '11th' },
  { name: '2D', subject: 'physics', class: '11th' },
  { name: 'NLM', subject: 'physics', class: '11th' },
  { name: 'WEP', subject: 'physics', class: '11th' },
  { name: 'Circular', subject: 'physics', class: '11th' },
  { name: 'COM Collision', subject: 'physics', class: '11th' },
  { name: 'Rotation', subject: 'physics', class: '11th' },
  { name: 'Solids', subject: 'physics', class: '11th' },
  { name: 'FM', subject: 'physics', class: '11th' },
  { name: 'Thermal prop', subject: 'physics', class: '11th' },
  { name: 'Thermo', subject: 'physics', class: '11th' },
  { name: 'KTG', subject: 'physics', class: '11th' },
  { name: 'SHM', subject: 'physics', class: '11th' },
  { name: 'Waves', subject: 'physics', class: '11th' },
  // Physics - Class 12th
  { name: 'Electro', subject: 'physics', class: '12th' },
  { name: 'Cap', subject: 'physics', class: '12th' },
  { name: 'CE', subject: 'physics', class: '12th' },
  { name: 'MEC', subject: 'physics', class: '12th' },
  { name: 'Mag', subject: 'physics', class: '12th' },
  { name: 'EMI', subject: 'physics', class: '12th' },
  { name: 'AC', subject: 'physics', class: '12th' },
  { name: 'EMW', subject: 'physics', class: '12th' },
  { name: 'RO', subject: 'physics', class: '12th' },
  { name: 'WO', subject: 'physics', class: '12th' },
  { name: 'Dual', subject: 'physics', class: '12th' },
  { name: 'Atoms', subject: 'physics', class: '12th' },
  { name: 'Nuclei', subject: 'physics', class: '12th' },
  { name: 'Semiconductor', subject: 'physics', class: '12th' },
  
  // Chemistry - Physical
  { name: 'Mole', subject: 'chemistry', class: '11th', category: 'Physical Chemistry' },
  { name: 'Quantitative ana', subject: 'chemistry', class: '11th', category: 'Physical Chemistry' },
  { name: 'AS', subject: 'chemistry', class: '11th', category: 'Physical Chemistry' },
  { name: 'Redox', subject: 'chemistry', class: '11th', category: 'Physical Chemistry' },
  { name: 'Thermo', subject: 'chemistry', class: '12th', category: 'Physical Chemistry' },
  { name: 'Chemical Eq', subject: 'chemistry', class: '12th', category: 'Physical Chemistry' },
  { name: 'Ionic Eq', subject: 'chemistry', class: '12th', category: 'Physical Chemistry' },
  { name: 'Solutions', subject: 'chemistry', class: '12th', category: 'Physical Chemistry' },
  { name: 'CK', subject: 'chemistry', class: '12th', category: 'Physical Chemistry' },
  { name: 'Electrochem', subject: 'chemistry', class: '12th', category: 'Physical Chemistry' },
  
  // Chemistry - Inorganic
  { name: 'PT', subject: 'chemistry', class: '11th', category: 'Inorganic Chemistry' },
  { name: 'CB', subject: 'chemistry', class: '11th', category: 'Inorganic Chemistry' },
  { name: 'p-block', subject: 'chemistry', class: '12th', category: 'Inorganic Chemistry' },
  { name: 'd-f block', subject: 'chemistry', class: '12th', category: 'Inorganic Chemistry' },
  { name: 'Coordination comp', subject: 'chemistry', class: '12th', category: 'Inorganic Chemistry' },
  { name: 'Salt analysis', subject: 'chemistry', class: '12th', category: 'Inorganic Chemistry' },
  
  // Chemistry - Organic
  { name: 'IUPAC', subject: 'chemistry', class: '11th', category: 'Organic Chemistry' },
  { name: 'Isomerism', subject: 'chemistry', class: '11th', category: 'Organic Chemistry' },
  { name: 'GOC', subject: 'chemistry', class: '11th', category: 'Organic Chemistry' },
  { name: 'Reaction mech', subject: 'chemistry', class: '11th', category: 'Organic Chemistry' },
  { name: 'HC', subject: 'chemistry', class: '12th', category: 'Organic Chemistry' },
  { name: 'Halo', subject: 'chemistry', class: '12th', category: 'Organic Chemistry' },
  { name: 'Alc', subject: 'chemistry', class: '12th', category: 'Organic Chemistry' },
  { name: 'Ald', subject: 'chemistry', class: '12th', category: 'Organic Chemistry' },
  { name: 'Amines', subject: 'chemistry', class: '12th', category: 'Organic Chemistry' },
  { name: 'Biomolecules', subject: 'chemistry', class: '12th', category: 'Organic Chemistry' },
  
  // Biology - 11th
  { name: 'LW', subject: 'biology', class: '11th' },
  { name: 'BC', subject: 'biology', class: '11th' },
  { name: 'PK', subject: 'biology', class: '11th' },
  { name: 'AK', subject: 'biology', class: '11th' },
  { name: 'Morpho', subject: 'biology', class: '11th' },
  { name: 'Anat', subject: 'biology', class: '11th' },
  { name: 'Tissue', subject: 'biology', class: '11th' },
  { name: 'Frog and cockroach', subject: 'biology', class: '11th' },
  { name: 'Cell', subject: 'biology', class: '11th' },
  { name: 'CC', subject: 'biology', class: '11th' },
  { name: 'BM', subject: 'biology', class: '11th' },
  { name: 'PS', subject: 'biology', class: '11th' },
  { name: 'Resp', subject: 'biology', class: '11th' },
  { name: 'PGD', subject: 'biology', class: '11th' },
  { name: 'Breathing', subject: 'biology', class: '11th' },
  { name: 'Circulation', subject: 'biology', class: '11th' },
  { name: 'Excretion', subject: 'biology', class: '11th' },
  { name: 'Locomotion', subject: 'biology', class: '11th' },
  { name: 'Neural', subject: 'biology', class: '11th' },
  { name: 'Chemical coord', subject: 'biology', class: '11th' },
  
  // Biology - 12th
  { name: 'Repro in org', subject: 'biology', class: '12th' },
  { name: 'PR', subject: 'biology', class: '12th' },
  { name: 'HR', subject: 'biology', class: '12th' },
  { name: 'RH', subject: 'biology', class: '12th' },
  { name: 'Genetics', subject: 'biology', class: '12th' },
  { name: 'MBI', subject: 'biology', class: '12th' },
  { name: 'Evo', subject: 'biology', class: '12th' },
  { name: 'HHD', subject: 'biology', class: '12th' },
  { name: 'Microbes', subject: 'biology', class: '12th' },
  { name: 'Strategies', subject: 'biology', class: '12th' },
  { name: 'Biotech-1', subject: 'biology', class: '12th' },
  { name: 'Biotech-2', subject: 'biology', class: '12th' },
  { name: 'Organisms', subject: 'biology', class: '12th' },
  { name: 'Ecosystem', subject: 'biology', class: '12th' },
  { name: 'Biodiversity', subject: 'biology', class: '12th' },
  { name: 'Env issues', subject: 'biology', class: '12th' },
];

function initializeChapters(): Chapter[] {
  return INITIAL_CHAPTERS.map((ch, idx) => ({
    ...ch,
    id: `chapter_${idx}`,
    subtopics: [],
    completed: false,
    priority: 3, // default medium priority
  }));
}

export function getChapters(): Chapter[] {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (!stored) {
      const initialized = initializeChapters();
      saveChapters(initialized);
      return initialized;
    }
    return JSON.parse(stored);
  } catch {
    return initializeChapters();
  }
}

export function saveChapters(chapters: Chapter[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(chapters));
}

export function getChaptersBySubject(subject: Chapter['subject']): Chapter[] {
  return getChapters().filter(ch => ch.subject === subject);
}

export function getPriorityChapters(subject?: Chapter['subject']): Chapter[] {
  let chapters = getChapters();
  if (subject) chapters = chapters.filter(ch => ch.subject === subject);
  return chapters
    .filter(ch => !ch.completed)
    .sort((a, b) => b.priority - a.priority);
}

export function updateChapter(id: string, updates: Partial<Chapter>) {
  const all = getChapters().map(ch => ch.id === id ? { ...ch, ...updates } : ch);
  saveChapters(all);
  return all;
}

export function addSubtopic(chapterId: string, name: string) {
  const all = getChapters().map(ch => {
    if (ch.id === chapterId) {
      const newSubtopic: Subtopic = {
        id: `${chapterId}_st_${Date.now()}`,
        name,
        completed: false,
        notes: [],
      };
      return { ...ch, subtopics: [...ch.subtopics, newSubtopic] };
    }
    return ch;
  });
  saveChapters(all);
  return all;
}

export function updateSubtopic(chapterId: string, subtopicId: string, updates: Partial<Subtopic>) {
  const all = getChapters().map(ch => {
    if (ch.id === chapterId) {
      return {
        ...ch,
        subtopics: ch.subtopics.map(st => 
          st.id === subtopicId ? { ...st, ...updates } : st
        ),
      };
    }
    return ch;
  });
  saveChapters(all);
  return all;
}

export function deleteSubtopic(chapterId: string, subtopicId: string) {
  const all = getChapters().map(ch => {
    if (ch.id === chapterId) {
      return {
        ...ch,
        subtopics: ch.subtopics.filter(st => st.id !== subtopicId),
      };
    }
    return ch;
  });
  saveChapters(all);
  return all;
}

export function addNoteToSubtopic(
  chapterId: string,
  subtopicId: string,
  type: SubtopicNote['type'],
  content: string
) {
  const all = getChapters().map(ch => {
    if (ch.id === chapterId) {
      return {
        ...ch,
        subtopics: ch.subtopics.map(st => {
          if (st.id === subtopicId) {
            const newNote: SubtopicNote = {
              id: `${subtopicId}_note_${Date.now()}`,
              type,
              content,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            return { ...st, notes: [...st.notes, newNote] };
          }
          return st;
        }),
      };
    }
    return ch;
  });
  saveChapters(all);
  return all;
}

export function updateNote(
  chapterId: string,
  subtopicId: string,
  noteId: string,
  content: string
) {
  const all = getChapters().map(ch => {
    if (ch.id === chapterId) {
      return {
        ...ch,
        subtopics: ch.subtopics.map(st => {
          if (st.id === subtopicId) {
            return {
              ...st,
              notes: st.notes.map(n =>
                n.id === noteId ? { ...n, content, updatedAt: Date.now() } : n
              ),
            };
          }
          return st;
        }),
      };
    }
    return ch;
  });
  saveChapters(all);
  return all;
}

export function deleteNote(chapterId: string, subtopicId: string, noteId: string) {
  const all = getChapters().map(ch => {
    if (ch.id === chapterId) {
      return {
        ...ch,
        subtopics: ch.subtopics.map(st => {
          if (st.id === subtopicId) {
            return { ...st, notes: st.notes.filter(n => n.id !== noteId) };
          }
          return st;
        }),
      };
    }
    return ch;
  });
  saveChapters(all);
  return all;
}
