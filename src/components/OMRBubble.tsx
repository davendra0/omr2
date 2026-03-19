import type { Option } from '@/types/test';
import { cn } from '@/lib/utils';

interface OMRBubbleProps {
  label: string;
  filled: boolean;
  onClick: () => void;
  correct?: boolean | null; // for results: true=correct, false=wrong, null=neutral
}

const OMRBubble = ({ label, filled, onClick, correct }: OMRBubbleProps) => {
  let extraClass = '';
  if (correct === true) extraClass = 'bg-success text-success-foreground border-success';
  else if (correct === false) extraClass = 'bg-destructive text-destructive-foreground border-destructive';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'omr-bubble',
        filled && !extraClass && 'omr-bubble-filled',
        extraClass
      )}
    >
      {label}
    </button>
  );
};

export default OMRBubble;
