export interface Countdown {
  id: string;
  title: string;
  targetDate: string; // ISO date string YYYY-MM-DD
  style: 'minimal' | 'bold' | 'gradient' | 'outline';
  createdAt: number;
}

const STORAGE_KEY = 'workspace_countdowns';

export function getCountdowns(): Countdown[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCountdown(cd: Countdown) {
  const all = getCountdowns();
  all.push(cd);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteCountdown(id: string) {
  const all = getCountdowns().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function updateCountdown(id: string, updates: Partial<Countdown>) {
  const all = getCountdowns().map(c => c.id === id ? { ...c, ...updates } : c);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
