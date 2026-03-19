import type { Option, QuestionResponse } from '@/types/test';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OMRCellProps {
  response: QuestionResponse;
  onSelect: (option: Option) => void;
  onToggleReview: () => void;
  readOnly?: boolean;
  correctAnswer?: Option;
}

const options: Option[] = ['A', 'B', 'C', 'D'];

const OMRCell = ({ response, onSelect, onToggleReview, readOnly, correctAnswer }: OMRCellProps) => {
  const getBubbleState = (opt: Option) => {
    if (!correctAnswer) {
      return response.selected === opt ? 'filled' : 'empty';
    }
    if (opt === correctAnswer && opt === response.selected) return 'correct';
    if (opt === response.selected && opt !== correctAnswer) return 'wrong';
    if (opt === correctAnswer && response.selected !== correctAnswer) return 'correct';
    return 'empty';
  };

  return (
    <div
      className={cn(
        'omr-cell group',
        response.markedForReview && 'omr-cell-review',
        response.selected && !readOnly && 'omr-cell-answered'
      )}
    >
      {/* Question number + review flag */}
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[11px] font-bold text-muted-foreground leading-none">
          {response.questionNo}
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleReview(); }}
            className={cn(
              'w-4 h-4 flex items-center justify-center rounded-sm transition-all',
              response.markedForReview
                ? 'text-review'
                : 'text-transparent group-hover:text-muted-foreground/30'
            )}
            title="Mark for review"
          >
            <Flag className="w-3 h-3" fill={response.markedForReview ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      {/* Bubbles */}
      <div className="flex items-center gap-[5px]">
        {options.map((opt) => {
          const state = getBubbleState(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => !readOnly && onSelect(response.selected === opt ? null : opt)}
              className={cn(
                'omr-bubble-sm',
                state === 'filled' && 'omr-bubble-sm-filled',
                state === 'correct' && 'omr-bubble-sm-correct',
                state === 'wrong' && 'omr-bubble-sm-wrong',
              )}
              disabled={readOnly}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OMRCell;
