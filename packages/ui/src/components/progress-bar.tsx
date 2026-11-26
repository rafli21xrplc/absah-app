import type { ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

export interface ProgressBarProps {
  value: number;
  max: number;
  /** What is counted, e.g. "siswa". Builds the spoken text "12 dari 25 siswa". */
  unit?: string;
  /** The whole sentence, when "k dari n unit" is not the wording ("Semua 25 siswa sudah diisi"). Shown and spoken as is. */
  text?: string;
  /** Accessible name, e.g. "Presensi X-2". */
  label: string;
  /** Where the words sit. Above, they are the headline of the screen's progress and may share the line with `aside`. */
  textPosition?: 'below' | 'above';
  /** A small note on the right of the words, e.g. today's date. */
  aside?: ReactNode;
  /** A target on the same scale (e.g. 95 of 100): a thin mark on the bar, named in the spoken text. */
  target?: number;
  /** Only the bar (the number is written elsewhere on the card). The spoken text stays. */
  bare?: boolean;
  className?: string;
}

/** A bar plus words: the number is always written out, never only a coloured length. */
export function ProgressBar({ value, max, unit, text: sentence, label, textPosition = 'below', aside, target, bare = false, className }: ProgressBarProps) {
  const safeMax = Math.max(max, 1);
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const text = sentence ?? `${clamped} ${messages.progress.of} ${max}${unit ? ` ${unit}` : ''}`;
  const above = textPosition === 'above';
  const words = (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cx('tabular-nums', above ? 'text-body-strong text-tinta' : 'text-small text-tinta-muted')}>{text}</span>
      {aside && <span className="shrink-0 text-small text-tinta-muted">{aside}</span>}
    </div>
  );
  const targetAt = target === undefined ? null : Math.min(Math.max(target, 0), safeMax) / safeMax;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {above && !bare && words}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={targetAt === null ? text : `${text}, ${messages.progress.target} ${target}`}
        className="relative h-2 rounded-full bg-track"
      >
        <div className="h-full rounded-full bg-papan transition-[width] duration-(--motion-biasa) ease-(--ease-masuk)" style={{ width: `${(clamped / safeMax) * 100}%` }} />
        {targetAt !== null && <span aria-hidden className="absolute -top-1 h-4 w-[2px] rounded-full bg-tinta" style={{ left: `calc(${targetAt * 100}% - 1px)` }} />}
      </div>
      {!above && !bare && words}
    </div>
  );
}
