import type { TestResult, AnswerKey } from '@/types/test';

export interface SavedTest {
  id: string;
  name: string;
  savedAt: number;
  result: TestResult;
  answerKey: AnswerKey | null;
}

const STORAGE_KEY = 'omr_test_history';

export function getSavedTests(): SavedTest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTest(name: string, result: TestResult, answerKey: AnswerKey | null): SavedTest {
  const tests = getSavedTests();
  const saved: SavedTest = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    savedAt: Date.now(),
    result,
    answerKey,
  };
  tests.unshift(saved);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
  return saved;
}

export function deleteTest(id: string): void {
  const tests = getSavedTests().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
}

export function renameTest(id: string, newName: string): void {
  const tests = getSavedTests().map(t => t.id === id ? { ...t, name: newName } : t);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
}

export function getTestById(id: string): SavedTest | undefined {
  return getSavedTests().find(t => t.id === id);
}
