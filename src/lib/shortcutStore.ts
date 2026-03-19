export interface ShortcutMap {
  [action: string]: string; // e.g. "home" -> "ctrl+1"
}

const STORAGE_KEY = 'workspace_shortcuts';

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  home: 'ctrl+1',
  omr: 'ctrl+2',
  countdown: 'ctrl+3',
  pomodoro: 'ctrl+4',
  todos: 'ctrl+5',
  notes: 'ctrl+6',
  mistakes: 'ctrl+7',
  syllabus: 'ctrl+8',
  settings: 'ctrl+9',
};

export const SHORTCUT_LABELS: Record<string, string> = {
  home: '🏠 Home',
  omr: '📝 OMR Test',
  countdown: '⏳ Countdowns',
  pomodoro: '🍅 Pomodoro',
  todos: '✅ Tasks',
  notes: '📒 Notes',
  mistakes: '🔍 Mistakes',
  syllabus: '📚 Syllabus',
  settings: '⚙️ Settings',
};

export const ACTION_ROUTES: Record<string, string> = {
  home: '/',
  omr: '/omr',
  countdown: '/countdown',
  pomodoro: '/pomodoro',
  todos: '/todos',
  notes: '/notes',
  mistakes: '/mistakes',
  syllabus: '/syllabus',
  settings: '/settings',
};

export function getShortcuts(): ShortcutMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) } : { ...DEFAULT_SHORTCUTS };
  } catch {
    return { ...DEFAULT_SHORTCUTS };
  }
}

export function saveShortcuts(s: ShortcutMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function parseShortcut(shortcut: string): { ctrl: boolean; alt: boolean; shift: boolean; key: string } {
  const parts = shortcut.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    key: parts.filter(p => !['ctrl', 'alt', 'shift'].includes(p))[0] || '',
  };
}

export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  return (
    e.ctrlKey === parsed.ctrl &&
    e.altKey === parsed.alt &&
    e.shiftKey === parsed.shift &&
    e.key.toLowerCase() === parsed.key
  );
}
