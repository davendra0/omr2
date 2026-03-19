export interface PlannedTest {
  id: string;
  name: string;
  totalQuestions: number;
  startFrom: number;
  timeInMinutes: number;
  scheduledDate: string; // ISO date string (YYYY-MM-DD)
  createdAt: number;
  completed: boolean;
}

const STORAGE_KEY = 'workspace_planned_tests';

export function getPlannedTests(): PlannedTest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(tests: PlannedTest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tests));
}

export function addPlannedTest(test: Omit<PlannedTest, 'id' | 'createdAt' | 'completed'>): PlannedTest {
  const tests = getPlannedTests();
  const planned: PlannedTest = {
    ...test,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: Date.now(),
    completed: false,
  };
  tests.unshift(planned);
  save(tests);
  return planned;
}

export function updatePlannedTest(id: string, updates: Partial<Omit<PlannedTest, 'id' | 'createdAt'>>): void {
  const tests = getPlannedTests().map(t => t.id === id ? { ...t, ...updates } : t);
  save(tests);
}

export function deletePlannedTest(id: string): void {
  save(getPlannedTests().filter(t => t.id !== id));
}

export function markPlannedTestCompleted(id: string): void {
  updatePlannedTest(id, { completed: true });
}

export function duplicatePlannedTest(id: string, newDate: string): PlannedTest | null {
  const original = getPlannedTests().find(t => t.id === id);
  if (!original) return null;
  return addPlannedTest({
    name: original.name,
    totalQuestions: original.totalQuestions,
    startFrom: original.startFrom,
    timeInMinutes: original.timeInMinutes,
    scheduledDate: newDate,
  });
}
