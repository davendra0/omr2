import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestStore } from '@/store/testStore';
import DarkModeToggle from '@/components/DarkModeToggle';
import type { AnswerKey, Option } from '@/types/test';

const validOptions = ['A', 'B', 'C', 'D'];
const numberToOption: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };

const AnswerKeyPage = () => {
  const { result, setAnswerKey } = useTestStore();
  const navigate = useNavigate();

  const questions = result?.responses ?? [];
  const [answers, setAnswers] = useState<AnswerKey>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, [currentIdx]);

  if (!result) {
    navigate('/');
    return null;
  }

  const currentQ = questions[currentIdx];
  const totalFilled = Object.keys(answers).length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const mapped = numberToOption[e.key];
    const key = mapped ?? e.key.toUpperCase();
    if (validOptions.includes(key)) {
      setAnswers((prev) => ({ ...prev, [currentQ.questionNo]: key as Option }));
      if (currentIdx < questions.length - 1) {
        setTimeout(() => setCurrentIdx((i) => i + 1), 100);
      }
    } else if (e.key === 'Enter') {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx((i) => i + 1);
      }
    } else if (e.key === 'Backspace') {
      if (answers[currentQ.questionNo]) {
        setAnswers((prev) => {
          const copy = { ...prev };
          delete copy[currentQ.questionNo];
          return copy;
        });
      } else if (currentIdx > 0) {
        setCurrentIdx((i) => i - 1);
      }
    } else if (e.key === 'ArrowUp' && currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
    } else if (e.key === 'ArrowDown' && currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleSubmit = () => {
    setAnswerKey(answers);
    navigate('/results');
  };

  return (
    <div
      className="min-h-screen bg-background p-4 outline-none"
      tabIndex={0}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-2 py-2 border border-border rounded text-sm text-foreground hover:bg-muted"
              title="Home"
            >
              🏠
            </button>
            <button
              onClick={() => navigate('/results')}
              className="px-3 py-2 border border-border rounded text-sm text-foreground hover:bg-muted"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold font-mono text-foreground">Answer Key</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{totalFilled}/{questions.length}</span>
            <DarkModeToggle />
          </div>
        </div>

        <div className="bg-muted p-3 rounded text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-card border border-border rounded font-mono">A/1</kbd>{' '}
          <kbd className="px-1.5 py-0.5 bg-card border border-border rounded font-mono">B/2</kbd>{' '}
          <kbd className="px-1.5 py-0.5 bg-card border border-border rounded font-mono">C/3</kbd>{' '}
          <kbd className="px-1.5 py-0.5 bg-card border border-border rounded font-mono">D/4</kbd>{' '}
          to set answer • <kbd className="px-1.5 py-0.5 bg-card border border-border rounded font-mono">↑↓</kbd> navigate •{' '}
          <kbd className="px-1.5 py-0.5 bg-card border border-border rounded font-mono">⌫</kbd> clear
        </div>

        {/* Answer key list */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            {questions.map((q, idx) => (
              <div
                key={q.questionNo}
                onClick={() => setCurrentIdx(idx)}
                className={`flex items-center gap-4 px-4 py-3 border-b border-border/30 cursor-pointer transition-colors
                  ${idx === currentIdx ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}
                  ${idx % 2 !== 0 ? 'bg-muted/20' : ''}
                `}
              >
                <span className="font-mono text-sm font-bold w-14 text-right text-muted-foreground">
                  Q.{q.questionNo}
                </span>
                <div className="flex gap-2">
                  {validOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnswers((prev) => ({ ...prev, [q.questionNo]: opt as Option }));
                        if (idx === currentIdx && currentIdx < questions.length - 1) {
                          setTimeout(() => setCurrentIdx((i) => i + 1), 100);
                        }
                      }}
                      className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold font-mono transition-all
                        ${answers[q.questionNo] === opt
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
                        }
                      `}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {answers[q.questionNo] && (
                  <span className="ml-auto font-mono text-xs text-success font-bold">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full h-12 bg-primary text-primary-foreground font-bold text-base rounded hover:opacity-90 transition-opacity"
        >
          ✓ Apply Answer Key & Check
        </button>
      </div>
    </div>
  );
};

export default AnswerKeyPage;
