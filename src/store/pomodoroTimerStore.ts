import { create } from 'zustand';

interface PomodoroTimerState {
  phase: 'focus' | 'short_break' | 'long_break';
  secondsLeft: number;
  running: boolean;
  sessionCount: number;
  startedAt: number | null; // timestamp when timer was last started/resumed
  pausedAt: number | null;  // timestamp when paused
  totalDuration: number;    // total seconds for current phase
  label: string;
  subject: string;
  chapter: string;
}

interface PomodoroTimerStore extends PomodoroTimerState {
  setPhase: (phase: PomodoroTimerState['phase'], seconds: number) => void;
  setRunning: (running: boolean) => void;
  setSecondsLeft: (s: number) => void;
  setSessionCount: (c: number) => void;
  setLabel: (l: string) => void;
  setSubject: (s: string) => void;
  setChapter: (c: string) => void;
  syncFromBackground: () => void;
}

const PERSIST_KEY = 'pomo_timer_state';

function loadState(): Partial<PomodoroTimerState> {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function persistState(state: PomodoroTimerState) {
  localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
}

const saved = loadState();

export const usePomodoroTimer = create<PomodoroTimerStore>((set, get) => ({
  phase: saved.phase || 'focus',
  secondsLeft: saved.secondsLeft ?? 25 * 60,
  running: saved.running || false,
  sessionCount: saved.sessionCount || 0,
  startedAt: saved.startedAt || null,
  pausedAt: saved.pausedAt || null,
  totalDuration: saved.totalDuration || 25 * 60,
  label: saved.label || '',
  subject: saved.subject || '',
  chapter: saved.chapter || '',

  setPhase: (phase, seconds) => {
    const s = { ...get(), phase, secondsLeft: seconds, totalDuration: seconds, running: false, startedAt: null, pausedAt: null };
    persistState(s);
    set(s);
  },
  setRunning: (running) => {
    const now = Date.now();
    const update: Partial<PomodoroTimerStore> = { running };
    if (running) {
      update.startedAt = now;
      update.pausedAt = null;
    } else {
      update.pausedAt = now;
    }
    const s = { ...get(), ...update } as PomodoroTimerState;
    persistState(s);
    set(update);
  },
  setSecondsLeft: (secondsLeft) => {
    set({ secondsLeft });
    // Persist periodically (every 5 seconds)
    if (secondsLeft % 5 === 0) {
      persistState({ ...get(), secondsLeft });
    }
  },
  setSessionCount: (sessionCount) => {
    const s = { ...get(), sessionCount };
    persistState(s);
    set({ sessionCount });
  },
  setLabel: (label) => set({ label }),
  setSubject: (subject) => set({ subject }),
  setChapter: (chapter) => set({ chapter }),
  
  // Recalculate seconds left based on elapsed time since startedAt
  syncFromBackground: () => {
    const state = get();
    if (state.running && state.startedAt) {
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      const remaining = Math.max(0, state.secondsLeft - elapsed);
      // We don't subtract here because the interval handles it
      // This is just for when the component remounts
      const savedState = loadState();
      if (savedState.secondsLeft !== undefined && savedState.running && savedState.startedAt) {
        const realElapsed = Math.floor((Date.now() - savedState.startedAt) / 1000);
        const realRemaining = Math.max(0, savedState.secondsLeft - realElapsed);
        set({ secondsLeft: realRemaining });
      }
    }
  },
}));
