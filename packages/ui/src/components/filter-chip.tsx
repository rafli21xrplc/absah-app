import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../cx';

export interface FilterChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** A word, not an icon: "Semua", "Belum", "Tidak hadir". */
  label: string;
  /** How many items the filter would show. Always shown: a filter is a word with a number. */
  count: number;
  selected?: boolean;
}

/** A toggle button (aria-pressed). Several chips side by side work as the filter row of a list. */
export function FilterChip({ label, count, selected = false, type = 'button', className, ...props }: FilterChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1 rounded-md px-3 text-small font-bold transition-colors duration-(--motion-cepat)',
        selected ? 'border border-papan bg-papan text-on-papan' : 'border border-garis bg-kapur-raised text-tinta hover:bg-papan-soft',
        'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-garis disabled:text-tinta-muted disabled:hover:bg-garis',
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      {/* The space is for screen readers: two inline spans would be read as "Semua25". The gap is drawn by CSS. */}{' '}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
