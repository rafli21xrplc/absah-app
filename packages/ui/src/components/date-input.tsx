'use client';

import { lazy, Suspense, type ComponentPropsWithRef } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { Input } from './field';
import { useWideScreen } from './use-wide-screen';

// The calendar (react-day-picker, date-fns, Radix popover) is a separate chunk that only a wide screen downloads, like Select.
const DatePopover = lazy(() => import('./date-popover'));
const RangePopover = lazy(() => import('./date-popover').then((m) => ({ default: m.RangePopover })));

export type DateKind = 'date' | 'month' | 'time';

export interface DateInputProps extends Omit<ComponentPropsWithRef<'input'>, 'type'> {
  /** What is picked: a day (`YYYY-MM-DD`), a month (`YYYY-MM`) or a time (`HH:MM`). Same value format as the browser's input. */
  type?: DateKind;
}

/**
 * A date, month or time box. Same props as the browser's <input type="date|month|time"> (value, onChange, name, min, max,
 * required), so a page only swaps the tag. Laptop (>= 1024 px): a button that opens a calendar, month grid or hour and minute
 * lists in a popover. Phone: the browser's own picker. A real <input> stays in the page in both cases: it carries name,
 * required and the change event, so forms and onChange behave the same.
 */
export function DateInput({ type = 'date', ...props }: DateInputProps) {
  const wide = useWideScreen();
  const native = <Input type={type} {...props} />;
  if (!wide) return native;
  return (
    <Suspense fallback={native}>
      <DatePopover kind={type} {...props} />
    </Suspense>
  );
}

export interface DateRangeInputProps {
  /** `YYYY-MM-DD`, or '' while not chosen. */
  from: string;
  to: string;
  /** Called once both ends are chosen (laptop) or when either box changes (phone). `to` is never before `from`. */
  onChange: (from: string, to: string) => void;
  min?: string;
  max?: string;
  /** Form field names for the two ends, e.g. ['startsOn', 'endsOn']. */
  names?: [string, string];
  required?: boolean;
  /** Names the control when no visible label wraps it. */
  'aria-label'?: string;
  className?: string;
}

/** Two dates as one control. Laptop: one button, one popover with two months; pick the start, then the end. Phone: two boxes. */
export function DateRangeInput(props: DateRangeInputProps) {
  const wide = useWideScreen();
  const native = <NativeRange {...props} />;
  if (!wide) return native;
  return (
    <Suspense fallback={native}>
      <RangePopover {...props} />
    </Suspense>
  );
}

function NativeRange({ from, to, onChange, min, max, names, required, className, ...rest }: DateRangeInputProps) {
  const t = messages.date;
  return (
    <span role="group" aria-label={rest['aria-label'] ?? t.pickRange} className={cx('flex flex-wrap items-center gap-2', className)}>
      <Input
        type="date"
        aria-label={t.from}
        value={from}
        min={min}
        max={max}
        required={required}
        {...(names ? { name: names[0] } : {})}
        onChange={(e) => onChange(e.target.value, to && e.target.value > to ? e.target.value : to)}
        className="w-auto flex-1"
      />
      <Input
        type="date"
        aria-label={t.to}
        value={to}
        min={from || min}
        max={max}
        required={required}
        {...(names ? { name: names[1] } : {})}
        onChange={(e) => onChange(from, e.target.value)}
        className="w-auto flex-1"
      />
    </span>
  );
}
