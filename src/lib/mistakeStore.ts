export type MistakeType = 'silly' | 'time_crunch' | 'concept_lag' | 'calculation' | 'misread' | 'guessed' | 'other';

export interface QuestionAnnotation {
  testId: string;
  testName: string;
  questionNo: number;
  mistakeType: MistakeType;
  notes: string;
  imageData?: string; // base64 data URL
  selected: string | null;
  correct: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const STORE_KEY = 'workspace_question_annotations';

export const MISTAKE_TYPES: Record<MistakeType, { label: string; icon: string; color: string }> = {
  silly: { label: 'Silly Mistake', icon: '🤦', color: 'text-accent' },
  time_crunch: { label: 'Time Crunch', icon: '⏰', color: 'text-destructive' },
  concept_lag: { label: 'Concept Gap', icon: '📚', color: 'text-primary' },
  calculation: { label: 'Calculation Error', icon: '🔢', color: 'text-[hsl(262,83%,58%)]' },
  misread: { label: 'Misread Question', icon: '👀', color: 'text-[hsl(25,95%,53%)]' },
  guessed: { label: 'Wrong Guess', icon: '🎲', color: 'text-muted-foreground' },
  other: { label: 'Other', icon: '❓', color: 'text-foreground' },
};

export function getAnnotations(): QuestionAnnotation[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
  } catch { return []; }
}

function saveAll(annotations: QuestionAnnotation[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(annotations));
}

export function getAnnotation(testId: string, questionNo: number): QuestionAnnotation | undefined {
  return getAnnotations().find(a => a.testId === testId && a.questionNo === questionNo);
}

export function getAnnotationsForTest(testId: string): QuestionAnnotation[] {
  return getAnnotations().filter(a => a.testId === testId);
}

export function saveAnnotation(annotation: QuestionAnnotation) {
  const all = getAnnotations();
  const idx = all.findIndex(a => a.testId === annotation.testId && a.questionNo === annotation.questionNo);
  if (idx >= 0) {
    all[idx] = { ...annotation, updatedAt: Date.now() };
  } else {
    all.push(annotation);
  }
  saveAll(all);
}

export function deleteAnnotation(testId: string, questionNo: number) {
  const all = getAnnotations().filter(a => !(a.testId === testId && a.questionNo === questionNo));
  saveAll(all);
}

export function deleteAnnotationsForTest(testId: string) {
  const all = getAnnotations().filter(a => a.testId !== testId);
  saveAll(all);
}

export function getAllMistakesByType(): Record<MistakeType, QuestionAnnotation[]> {
  const all = getAnnotations();
  const result = {} as Record<MistakeType, QuestionAnnotation[]>;
  for (const type of Object.keys(MISTAKE_TYPES) as MistakeType[]) {
    result[type] = all.filter(a => a.mistakeType === type);
  }
  return result;
}

export function getAllMistakes(): QuestionAnnotation[] {
  return getAnnotations().sort((a, b) => b.createdAt - a.createdAt);
}
