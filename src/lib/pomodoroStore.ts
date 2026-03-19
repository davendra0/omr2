export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLong: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
}

export interface PomodoroSession {
  id: string;
  type: 'focus' | 'short_break' | 'long_break';
  durationMinutes: number;
  completedAt: number;
  date: string; // YYYY-MM-DD
  label?: string; // e.g. "Physics - Electrochem"
  subject?: string;
  chapter?: string;
}

const SETTINGS_KEY = 'workspace_pomodoro_settings';
const SESSIONS_KEY = 'workspace_pomodoro_sessions';

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLong: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
};

export const SUBJECTS = [
  'Physics', 'Chemistry', 'Biology', 'Mathematics',
  'English', 'History', 'Geography', 'Computer Science',
  'General', 'Other',
];

export function getSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: PomodoroSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function getSessions(): PomodoroSession[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function addSession(session: PomodoroSession) {
  const all = getSessions();
  all.push(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
}

export function deleteSession(id: string) {
  const all = getSessions().filter(s => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
}

export function updateSession(id: string, updates: Partial<Omit<PomodoroSession, 'id'>>) {
  const all = getSessions().map(s => s.id === id ? { ...s, ...updates } : s);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
}

export function getTodaySessions(): PomodoroSession[] {
  const today = new Date().toISOString().slice(0, 10);
  return getSessions().filter(s => s.date === today);
}
