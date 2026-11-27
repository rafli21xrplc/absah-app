import { cx } from '../cx';

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  /** A count after the word ("Menunggu 3"); part of the button's name. */
  count?: number;
}

export interface SegmentedControlProps<V extends string> {
  /** Names the group, e.g. "Status". */
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Fills the width it is given, the choices sharing it, and is 40 px high: for a narrow menu on a laptop. */
  compact?: boolean;
}

/** A few exclusive choices on one soft track (the status filter of a data page). Buttons with aria-pressed, 44 px high. The
 * chosen one is a white pill with a shadow, its word in `papan` and its count on solid `papan`, so it never depends on one cue
 * alone. Wider than its place (five choices with counts on a phone), the track scrolls sideways instead of pushing the page wider. */
export function SegmentedControl<V extends string>({ label, options, value, onChange, compact = false }: SegmentedControlProps<V>) {
  return (
    <div role="group" aria-label={label} className={cx('gap-1 rounded-kontrol bg-track p-1 lg:gap-0', compact ? 'flex w-full' : 'inline-flex w-fit max-w-full overflow-x-auto')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            compact ? 'flex min-h-10 flex-1 justify-center px-2 lg:min-h-8' : 'inline-flex min-h-11 px-4 lg:min-h-8 lg:px-3',
            'cursor-pointer items-center whitespace-nowrap rounded-md border text-small font-semibold transition-colors',
            // `tinta-muted` on the `track` is 5.5:1 (light) and 5.1:1 (dark).
            o.value === value
              ? 'border-batas-lembut bg-kapur-raised text-papan shadow-aksi'
              : 'border-transparent bg-transparent text-tinta-muted hover:bg-kapur-raised/60 hover:text-tinta',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cx('ml-2 min-w-5 rounded-full px-2 text-center text-mini tabular-nums', o.value === value ? 'bg-papan text-on-papan' : 'bg-kapur-raised text-tinta-muted')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
