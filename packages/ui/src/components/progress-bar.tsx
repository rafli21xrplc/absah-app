import { messages } from '../../messages/id';
import { cx } from '../cx';

export interface ProgressBarProps {
  value: number;
  max: number;
  /** What is counted, e.g. "siswa". Builds the spoken text "12 dari 25 siswa". */
  unit?: string;
  /** Accessible name, e.g. "Presensi X-2". */
  label: string;
  className?: string;
}

/** A bar plus words: the number is always written out, never only a coloured length. */
export function ProgressBar({ value, max, unit, label, className }: ProgressBarProps) {
  const safeMax = Math.max(max, 1);
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const text = `${clamped} ${messages.progress.of} ${max}${unit ? ` ${unit}` : ''}`;
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={text}
        className="h-2 overflow-hidden rounded-full bg-garis"
      >
        <div className="h-full rounded-full bg-papan transition-[width] duration-300 ease-out" style={{ width: `${(clamped / safeMax) * 100}%` }} />
      </div>
      <span className="text-small tabular-nums text-tinta-muted">{text}</span>
    </div>
  );
}
