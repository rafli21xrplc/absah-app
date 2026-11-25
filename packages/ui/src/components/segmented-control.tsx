import { cx } from '../cx';

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
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

/** A few exclusive choices in one grey pill (the status filter of a data page). Buttons with aria-pressed, 44 px high. */
export function SegmentedControl<V extends string>({ label, options, value, onChange, compact = false }: SegmentedControlProps<V>) {
  return (
    <div role="group" aria-label={label} className={cx('gap-1 rounded-md bg-garis p-1', compact ? 'flex w-full' : 'inline-flex')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            compact ? 'flex min-h-10 flex-1 justify-center px-2' : 'inline-flex min-h-11 px-4',
            'cursor-pointer items-center whitespace-nowrap rounded-sm border text-small font-bold',
            // The chosen one is lighter AND outlined. Text stays `tinta`: `tinta-muted` on the `garis` track is 4.44:1 (light theme).
            o.value === value ? 'border-garis-kuat bg-kapur-raised text-tinta' : 'border-transparent bg-transparent text-tinta',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
