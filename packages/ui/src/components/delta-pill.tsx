import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cx } from '../cx';

export type DeltaDirection = 'up' | 'down' | 'flat';
export type DeltaMeaning = 'good' | 'bad' | 'neutral';

const LOOK: Record<DeltaMeaning, string> = {
  good: 'bg-delta-baik-soft text-delta-baik',
  bad: 'bg-delta-buruk-soft text-delta-buruk',
  neutral: 'bg-delta-netral-soft text-delta-netral',
};
const ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;

/**
 * Direction and meaning from two numbers. Meaning depends on the metric: fewer late students is good, so `higherIsBetter`
 * false turns a drop green. Equal numbers are flat and neutral.
 */
export function deltaOf(current: number, previous: number, higherIsBetter = true): { direction: DeltaDirection; meaning: DeltaMeaning; amount: number } {
  const diff = current - previous;
  if (diff === 0) return { direction: 'flat', meaning: 'neutral', amount: 0 };
  const direction: DeltaDirection = diff > 0 ? 'up' : 'down';
  const better = higherIsBetter ? diff > 0 : diff < 0;
  return { direction, meaning: better ? 'good' : 'bad', amount: Math.abs(diff) };
}

export interface DeltaPillProps {
  direction: DeltaDirection;
  meaning: DeltaMeaning;
  /** The number shown, already formatted ("0,8", "6"). */
  text: string;
  /** Whole sentence for screen readers, e.g. "naik 0,8 poin dibanding kemarin". */
  label: string;
  className?: string;
}

/** Arrow plus number, never colour alone. Direction (arrow) and meaning (colour) are separate. */
export function DeltaPill({ direction, meaning, text, label, className }: DeltaPillProps) {
  const Icon = ICON[direction];
  return (
    <span className={cx('inline-flex h-6 items-center gap-px whitespace-nowrap rounded-full px-2 text-mini font-bold tabular-nums', LOOK[meaning], className)}>
      <Icon aria-hidden strokeWidth={2.5} className="size-3" />
      <span aria-hidden>{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
