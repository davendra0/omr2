import type { Option, QuestionResponse } from '@/types/test';
import OMRBubble from './OMRBubble';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OMRRowProps {
  response: QuestionResponse;
  onSelect: (option: Option) => void;
  onToggleReview: () => void;
  readOnly?: boolean;
  correctAnswer?: Option;
}

const options: Option[] = ['A', 'B', 'C', 'D'];

const OMRRow = ({ response, onSelect, onToggleReview, readOnly, correctAnswer }: OMRRowProps) => {
  const getBubbleCorrectness = (opt: Option): boolean | null => {
    if (!correctAnswer) return null;
    if (opt === correctAnswer && opt === response.selected) return true;
    if (opt === response.selected && opt !== correctAnswer) return false;
    if (opt === correctAnswer && response.selected !== correctAnswer) return true;
    return null;
  };

  return (
    <div className={cn(
      'omr-row',
      response.markedForReview && 'bg-review/5'
    )}>
      <span className="font-mono font-bold text-sm w-10 text-right text-muted-foreground">
        {response.questionNo}.
      </span>
      <div className="flex items-center gap-2">
        {options.map((opt) => (
          <OMRBubble
            key={opt}
            label={opt!}
            filled={response.selected === opt}
            onClick={() => !readOnly && onSelect(opt)}
            correct={readOnly ? getBubbleCorrectness(opt) : null}
          />
        ))}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={onToggleReview}
          className={cn(
            'ml-auto p-1.5 rounded-md transition-colors',
            response.markedForReview
              ? 'review-badge'
              : 'text-muted-foreground/40 hover:text-muted-foreground'
          )}
          title="Mark for review"
        >
          <Flag className="w-4 h-4" fill={response.markedForReview ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  );
};

export default OMRRow;
