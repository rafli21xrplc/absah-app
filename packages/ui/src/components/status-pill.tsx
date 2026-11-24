import { ChevronDown, ChevronRight } from 'lucide-react';
import { statusTokens, type StatusCode } from '../status';
import { cx } from '../cx';

// Complete class names, so Tailwind can see them. Colours come only from the status tokens.
export const STATUS_LOOK: Record<StatusCode, { pill: string; chip: string }> = {
  H: { pill: 'border-hadir-soft bg-hadir-soft text-hadir', chip: 'bg-hadir text-on-papan' },
  T: { pill: 'border-telat-soft bg-telat-soft text-telat', chip: 'bg-telat text-on-papan' },
  I: { pill: 'border-izin-soft bg-izin-soft text-izin', chip: 'bg-izin text-on-papan' },
  S: { pill: 'border-sakit-soft bg-sakit-soft text-sakit', chip: 'bg-sakit text-on-papan' },
  A: { pill: 'border-alpa-soft bg-alpa-soft text-alpa', chip: 'bg-alpa text-on-papan' },
  // Dashed border: the one cue that tells "not filled" from the rest without colour.
  '?': { pill: 'border-[1.5px] border-dashed border-garis-kuat bg-kapur-raised text-tinta-muted', chip: 'bg-garis text-tinta' },
};

export interface StatusPillProps {
  code: StatusCode;
  /** Makes the pill a button (with a chevron) that opens the choice. Give it a full name with ariaLabel. */
  onPress?: () => void;
  /** Full accessible name when the pill is a button, e.g. "Gilang Ramadhan: Hadir. Ketuk untuk mengubah." */
  ariaLabel?: string;
  /** A chevron on the plain (non-button) pill, for a pill that sits inside a row that opens a choice. */
  chevron?: boolean;
  className?: string;
}

/** Status is letter + word + colour, in a fixed order (Hadir, Telat, Izin, Sakit, Alpa). Never colour alone. */
export function StatusPill({ code, onPress, ariaLabel, chevron = false, className }: StatusPillProps) {
  const { huruf, kata } = statusTokens(code);
  const look = STATUS_LOOK[code];
  const base = cx('inline-flex min-h-11 items-center gap-2 rounded-md border py-0 pl-2 pr-3 text-body-strong font-bold', look.pill, className);
  const inner = (
    <>
      <span aria-hidden className={cx('inline-flex size-6 items-center justify-center rounded-sm text-small font-bold', look.chip)}>
        {huruf}
      </span>
      {kata}
      {onPress && <ChevronRight aria-hidden strokeWidth={1.75} className="size-4" />}
      {/* Down: it opens a list of choices below, as on the board. */}
      {!onPress && chevron && <ChevronDown aria-hidden strokeWidth={1.75} className="size-4" />}
    </>
  );
  if (!onPress) return <span className={base}>{inner}</span>;
  return (
    <button type="button" aria-label={ariaLabel} onClick={onPress} className={cx(base, 'cursor-pointer')}>
      {inner}
    </button>
  );
}
