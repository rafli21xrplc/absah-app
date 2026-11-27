'use client';

import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { DayPicker, type ChevronProps, type DayButtonProps, type Matcher } from 'react-day-picker';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import type { DateInputProps, DateKind, DateRangeInputProps } from './date-input';
import { borderClass, controlClass, useControl } from './field';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const t = messages.date;
const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` as a local date (never through UTC, which would move it a day in Asia/Jakarta). */
function parseDay(value: string | undefined): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoMonth = (y: number, m: number) => `${y}-${pad(m + 1)}`;

function label(kind: DateKind, value: string): string {
  if (!value) return '';
  if (kind === 'time') return value.slice(0, 5).replace(':', '.');
  if (kind === 'month') {
    const [y, m] = value.split('-').map(Number);
    return y && m ? format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: localeId }) : value;
  }
  const d = parseDay(value);
  return d ? format(d, 'EEE, d MMM yyyy', { locale: localeId }) : value;
}

const PLACEHOLDER: Record<DateKind, string> = { date: t.pickDate, month: t.pickMonth, time: t.pickTime };

export const triggerClass = (invalid: boolean, className?: string) =>
  cx(controlClass, 'flex min-h-12 cursor-pointer items-center gap-2 pr-3 text-left lg:min-h-9 lg:max-w-120', borderClass(invalid), className);

/** Sets the hidden input the way typing would and fires a real `input` event, so React's onChange runs with a genuine target. */
function write(el: HTMLInputElement | null, next: string) {
  if (!el || el.value === next) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const NAV = 'inline-flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-tinta hover:bg-papan-tipis disabled:cursor-not-allowed disabled:opacity-40';
const FOOT = 'cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-small font-bold text-papan hover:bg-papan-tipis disabled:cursor-not-allowed disabled:text-tinta-muted';

/** Absah colours on react-day-picker's parts. No stylesheet from the library. */
const CALENDAR = {
  root: 'text-isi text-tinta',
  months: 'relative flex gap-6',
  month: 'flex flex-col gap-2',
  month_caption: 'flex h-8 items-center justify-center',
  caption_label: 'text-isi font-bold capitalize',
  nav: 'absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-between',
  button_previous: NAV,
  button_next: NAV,
  month_grid: 'border-collapse',
  weekdays: 'flex',
  weekday: 'w-9 text-center text-mini font-semibold text-tinta-muted',
  week: 'mt-1 flex',
  day: 'size-9 p-0 text-center',
  hidden: 'invisible',
};

function Chevron({ orientation }: ChevronProps) {
  const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
  return <Icon aria-hidden strokeWidth={2} className="size-4" />;
}

function DayButton({ day: _day, modifiers, className: _className, ...props }: DayButtonProps) {
  const end = modifiers.range_start || modifiers.range_end;
  const single = modifiers.selected && !end && !modifiers.range_middle;
  return (
    <button
      {...props}
      className={cx(
        'flex size-9 cursor-pointer items-center justify-center rounded-md border-0 p-0 text-isi tabular-nums',
        'disabled:cursor-not-allowed disabled:text-tinta-muted disabled:line-through',
        modifiers.range_middle ? 'rounded-none bg-papan-soft text-tinta' : single || end ? 'bg-papan font-bold text-on-papan hover:bg-papan-deep'   : 'bg-transparent text-tinta hover:bg-papan-tipis',
        modifiers.today && !single && !end && 'font-bold text-papan',
      )}
    />
  );
}

const bounds = (min?: string, max?: string): Matcher[] => {
  const out: Matcher[] = [];
  const a = parseDay(min);
  const b = parseDay(max);
  if (a) out.push({ before: a });
  if (b) out.push({ after: b });
  return out;
};

function Foot({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2">{children}</div>;
}

/** The laptop form of DateInput. Default export: the lazy chunk. */
export default function DatePopover({ kind, className, ...props }: Omit<DateInputProps, 'type'> & { kind: DateKind }) {
  const c = useControl(props);
  const native = useRef<HTMLInputElement>(null);
  const valueId = useId();
  const nameId = useId();
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(String(props.defaultValue ?? ''));
  const value = props.value !== undefined ? String(props.value ?? '') : own;
  // The real <input> is only the form control behind the button: it takes no id and no accessible name of its own.
  const {
    value: _value,
    defaultValue: _default,
    onChange,
    id: _id,
    ref,
    placeholder,
    'aria-label': ariaLabel,
    'aria-labelledby': _labelledby,
    'aria-describedby': _described,
    'aria-invalid': _invalid,
    ...rest
  } = props;
  const min = props.min === undefined ? undefined : String(props.min);
  const max = props.max === undefined ? undefined : String(props.max);

  function pick(next: string, close = true) {
    if (close) setOpen(false);
    setOwn(next);
    write(native.current, next);
  }

  const Icon = kind === 'time' ? Clock : CalendarDays;
  const shown = label(kind, value);
  return (
    <span className="relative block">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            id={c.id}
            // The name is the label AND the shown date, so what a voice-control user reads on screen is part of it (WCAG 2.5.3).
            // A <label> wrapped around the control (no id to point at) still names it the usual way.
            {...(ariaLabel || c.labelId ? { 'aria-labelledby': `${ariaLabel ? nameId : c.labelId} ${valueId}` } : {})}
            aria-describedby={c['aria-describedby']}
            aria-invalid={c['aria-invalid']}
            disabled={props.disabled}
            className={triggerClass(c.invalid, className)}
          >
            {ariaLabel && (
              <span id={nameId} className="sr-only">
                {ariaLabel}
              </span>
            )}
            <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
            <span id={valueId} className={cx('min-w-0 flex-1 truncate', !shown && 'text-tinta-muted')}>
              {shown || placeholder || PLACEHOLDER[kind]}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-label={ariaLabel ?? PLACEHOLDER[kind]} className="w-auto p-3">
          {kind === 'date' && <DayPanel value={value} min={min} max={max} required={props.required} onPick={pick} />}
          {kind === 'month' && <MonthPanel value={value} min={min} max={max} required={props.required} onPick={pick} />}
          {kind === 'time' && <TimePanel value={value} step={Number(props.step) || 60} required={props.required} onPick={pick} onDone={() => setOpen(false)} />}
        </PopoverContent>
      </Popover>
      {/* After the button: a <label> wrapped around the whole control names its first labelable child, which must be the button. */}
      <input
        {...rest}
        ref={(el) => {
          native.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        type={kind}
        {...(props.value !== undefined ? { value: props.value } : { defaultValue: props.defaultValue })}
        onChange={onChange}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      />
    </span>
  );
}

interface PanelProps {
  value: string;
  min?: string;
  max?: string;
  required?: boolean;
  onPick: (next: string, close?: boolean) => void;
}

function DayPanel({ value, min, max, required, onPick }: PanelProps) {
  const selected = parseDay(value);
  const today = isoDay(new Date());
  const todayAllowed = (!min || today >= min) && (!max || today <= max);
  return (
    <>
      <DayPicker
        mode="single"
        required
        autoFocus
        locale={localeId}
        weekStartsOn={1}
        selected={selected}
        defaultMonth={selected ?? parseDay(max && today > max ? max : today)}
        onSelect={(d) => d && onPick(isoDay(d))}
        disabled={bounds(min, max)}
        classNames={CALENDAR}
        components={{ Chevron, DayButton }}
      />
      <Foot>
        <button type="button" className={FOOT} disabled={!todayAllowed} onClick={() => onPick(today)}>
          {t.today}
        </button>
        {!required && value && (
          <button type="button" className={FOOT} onClick={() => onPick('')}>
            {t.clear}
          </button>
        )}
      </Foot>
    </>
  );
}

function MonthPanel({ value, min, max, required, onPick }: PanelProps) {
  const now = new Date();
  const [y0, m0] = value.split('-').map(Number);
  const [year, setYear] = useState(y0 || now.getFullYear());
  const thisMonth = isoMonth(now.getFullYear(), now.getMonth());
  const allowed = (v: string) => (!min || v >= min.slice(0, 7)) && (!max || v <= max.slice(0, 7));
  return (
    <div className="w-64">
      <div className="flex h-8 items-center justify-between">
        <button type="button" className={NAV} aria-label={t.prevYear} disabled={Boolean(min) && year <= Number(min?.slice(0, 4))} onClick={() => setYear(year - 1)}>
          <ChevronLeft aria-hidden strokeWidth={2} className="size-4" />
        </button>
        <span className="text-isi font-bold tabular-nums" aria-live="polite">
          {year}
        </span>
        <button type="button" className={NAV} aria-label={t.nextYear} disabled={Boolean(max) && year >= Number(max?.slice(0, 4))} onClick={() => setYear(year + 1)}>
          <ChevronRight aria-hidden strokeWidth={2} className="size-4" />
        </button>
      </div>
      <div role="group" aria-label={String(year)} className="mt-2 grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, m) => {
          const v = isoMonth(year, m);
          const on = y0 === year && m0 === m + 1;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              disabled={!allowed(v)}
              onClick={() => onPick(v)}
              className={cx(
                'h-9 cursor-pointer rounded-md border-0 text-isi capitalize disabled:cursor-not-allowed disabled:text-tinta-muted disabled:line-through',
                on ? 'bg-papan font-bold text-on-papan' : v === thisMonth ? 'bg-transparent font-bold text-papan hover:bg-papan-tipis' : 'bg-transparent text-tinta hover:bg-papan-tipis',
              )}
            >
              {format(new Date(year, m, 1), 'MMM', { locale: localeId })}
            </button>
          );
        })}
      </div>
      <Foot>
        <button type="button" className={FOOT} disabled={!allowed(thisMonth)} onClick={() => onPick(thisMonth)}>
          {t.thisMonth}
        </button>
        {!required && value && (
          <button type="button" className={FOOT} onClick={() => onPick('')}>
            {t.clear}
          </button>
        )}
      </Foot>
    </div>
  );
}

function TimePanel({ value, step, required, onPick, onDone }: { value: string; step: number; required?: boolean; onPick: PanelProps['onPick']; onDone: () => void }) {
  const [h, m] = value ? value.slice(0, 5).split(':').map(Number) : [undefined, undefined];
  const every = Math.max(1, Math.round(step / 60)) === 1 ? 5 : Math.max(1, Math.round(step / 60));
  const steps = Array.from({ length: Math.ceil(60 / every) }, (_, i) => i * every);
  // A saved minute off the grid (07.10 on a 15-minute grid) still shows as chosen.
  const minutes = m !== undefined && !steps.includes(m) ? [...steps, m].sort((a, b) => a - b) : steps;
  const set = (hh: number, mm: number) => onPick(`${pad(hh)}:${pad(mm)}`, false);
  const now = new Date();
  return (
    <div className="w-56">
      <div className="flex gap-2">
        <Column label={t.hour} items={Array.from({ length: 24 }, (_, i) => i)} current={h} onPick={(hh) => set(hh, m ?? 0)} />
        <Column label={t.minute} items={minutes} current={m} onPick={(mm) => set(h ?? 7, mm)} />
      </div>
      <Foot>
        <button type="button" className={FOOT} onClick={() => onPick(`${pad(now.getHours())}:${pad(now.getMinutes())}`)}>
          {t.now}
        </button>
        <span className="flex gap-1">
          {!required && value && (
            <button type="button" className={FOOT} onClick={() => onPick('')}>
              {t.clear}
            </button>
          )}
          <button type="button" className={FOOT} onClick={onDone}>
            {t.done}
          </button>
        </span>
      </Foot>
    </div>
  );
}

function Column({ label: name, items, current, onPick }: { label: string; items: number[]; current: number | undefined; onPick: (n: number) => void }) {
  const chosen = useRef<HTMLButtonElement>(null);
  useEffect(() => chosen.current?.scrollIntoView?.({ block: 'center' }), []);
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-center text-mini font-semibold text-tinta-muted">{name}</span>
      <div role="group" aria-label={name} className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
        {items.map((n) => (
          <button
            key={n}
            ref={n === current ? chosen : undefined}
            type="button"
            aria-pressed={n === current}
            onClick={() => onPick(n)}
            className={cx('h-8 shrink-0 cursor-pointer rounded-md border-0 text-isi tabular-nums', n === current ? 'bg-papan font-bold text-on-papan' : 'bg-transparent text-tinta hover:bg-papan-tipis')}
          >
            {pad(n)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The laptop form of DateRangeInput: one button, two months; the first click is the start, the second the end. */
export function RangePopover({ from, to, onChange, min, max, names, required, className, ...rest }: DateRangeInputProps) {
  const c = useControl({});
  const valueId = useId();
  const nameId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const a = parseDay(from);
  const b = parseDay(to);
  const shown = a && b ? (from === to ? label('date', from) : `${format(a, 'd MMM', { locale: localeId })} – ${format(b, 'd MMM yyyy', { locale: localeId })}`) : '';
  const range = draft ?? (a ? { from: a, to: b } : undefined);
  return (
    <span className="relative block">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          setDraft(undefined);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            id={c.id}
            {...(rest['aria-label'] || c.labelId ? { 'aria-labelledby': `${rest['aria-label'] ? nameId : c.labelId} ${valueId}` } : {})}
            aria-describedby={c['aria-describedby']}
            className={triggerClass(c.invalid, className)}
          >
            {rest['aria-label'] && (
              <span id={nameId} className="sr-only">
                {rest['aria-label']}
              </span>
            )}
            <CalendarDays aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
            <span id={valueId} className={cx('min-w-0 flex-1 truncate', !shown && 'text-tinta-muted')}>
              {shown || t.pickRange}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" aria-label={rest['aria-label'] ?? t.pickRange} className="w-auto p-3">
          <p className="m-0 mb-2 text-small text-tinta-muted">{t.rangeHint}</p>
          <DayPicker
            mode="range"
            autoFocus
            numberOfMonths={2}
            locale={localeId}
            weekStartsOn={1}
            selected={range && range.from ? { from: range.from, to: range.to } : undefined}
            defaultMonth={a ?? new Date()}
            // Controlled: without onSelect react-day-picker keeps its own range and mixes the old end into the new start.
            onSelect={() => undefined}
            onDayClick={(day, modifiers) => {
              if (modifiers.disabled) return;
              // First click: the start. Second click: the end (or a new start when it is before the first).
              if (!draft?.from || draft.to || day < draft.from) {
                setDraft({ from: day });
                return;
              }
              setDraft(undefined);
              setOpen(false);
              onChange(isoDay(draft.from), isoDay(day));
            }}
            disabled={bounds(min, max)}
            classNames={CALENDAR}
            components={{ Chevron, DayButton }}
          />
          <Foot>
            <span className="text-small text-tinta-muted" aria-live="polite">
              {draft?.from ? `${t.from} ${label('date', isoDay(draft.from))}` : shown}
            </span>
            <button
              type="button"
              className={FOOT}
              onClick={() => {
                const today = isoDay(new Date());
                setOpen(false);
                onChange(today, today);
              }}
            >
              {t.today}
            </button>
          </Foot>
        </PopoverContent>
      </Popover>
      {names && (
        <>
          <input type="hidden" name={names[0]} value={from} />
          <input type="hidden" name={names[1]} value={to} />
        </>
      )}
      {required && !(from && to) && <input aria-hidden tabIndex={-1} required value="" onChange={() => undefined} className="sr-only" />}
    </span>
  );
}
