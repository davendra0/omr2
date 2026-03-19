export type Option = string | null;

export type QuestionType = 'mcq' | 'numerical';

export type MarkType = 'review' | 'later' | 'doubt' | 'check';

export const MARK_ICONS: Record<MarkType, { icon: string; label: string; color: string }> = {
  review: { icon: '⚑', label: 'Review', color: 'text-[hsl(var(--review))]' },
  later: { icon: '⏳', label: 'Attempt Later', color: 'text-[hsl(var(--accent))]' },
  doubt: { icon: '❓', label: 'Doubt', color: 'text-destructive' },
  check: { icon: '👁', label: 'Check if time', color: 'text-primary' },
};

export interface TestSection {
  id: string;
  name: string;
  startQ: number;
  endQ: number;
  type: QuestionType;
}

export interface QuestionData {
  id: number;
  imageUrl: string;
  correctAnswer: string;
  type: QuestionType;
}

export interface DisplayPrefs {
  showCountdown: boolean;
  showWallClock: boolean;
  showQuestionsLeft: boolean;
  showAnswered: boolean;
  showMarked: boolean;
  showQuestionRange: boolean;
}

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  showCountdown: true,
  showWallClock: false,
  showQuestionsLeft: true,
  showAnswered: true,
  showMarked: true,
  showQuestionRange: true,
};

export interface QuestionResponse {
  questionNo: number;
  selected: Option;
  markedForReview: boolean; // kept for backward compat
  marks: MarkType[];
  answeredAt: number | null; // timestamp
}

export interface TestConfig {
  totalQuestions: number;
  startFrom: number;
  timeInMinutes: number;
  sections: TestSection[];
  displayPrefs: DisplayPrefs;
  wallClockStartTime?: string; // HH:MM format e.g. "14:00"
  isServerTest?: boolean;
  testId?: string;
  title?: string;
  description?: string;
  questionImages?: Record<number, string>; // questionNo -> base64/url
  correctAnswers?: Record<number, Option>; // questionNo -> Option
  questionTypes?: Record<number, QuestionType>; // questionNo -> QuestionType
}

export interface TestResult {
  config: TestConfig;
  responses: QuestionResponse[];
  startTime: number;
  endTime: number;
}

export interface AnswerKey {
  [questionNo: number]: Option;
}

export interface AnalysisItem {
  questionNo: number;
  selected: Option;
  correct: Option;
  isCorrect: boolean;
  timeTaken: number | null; // seconds from previous answer
}
