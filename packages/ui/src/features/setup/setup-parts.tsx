'use client';

import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cx } from '../../cx';

export interface StepperItem {
  id: string;
  label: string;
  /** What the server knows. The step on screen is `current`, whatever its status. */
  status: 'todo' | 'done' | 'skipped';
}

/**
 * The wizard's steps in order. The number and the word say where you are; colour and the tick only repeat it.
 * On a phone only the current label is written (the others are numbers), on a laptop all of them.
 */
export function Stepper({ items, current, label, skippedText }: { items: readonly StepperItem[]; current: number; label: string; skippedText: string }) {
  return (
    <ol aria-label={label} className="m-0 flex list-none items-center gap-2 p-0">
      {items.map((s, i) => {
        const isCurrent = i === current;
        const finished = s.status === 'done' && !isCurrent;
        return (
          <li key={s.id} aria-current={isCurrent ? 'step' : undefined} className={cx('flex items-center gap-2 text-small', isCurrent ? 'font-bold text-tinta' : 'text-tinta-muted')}>
            <span
              aria-hidden
              className={cx(
                'inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-small font-bold tabular-nums',
                isCurrent ? 'border-papan bg-papan text-on-papan' : finished ? 'border-hadir bg-hadir-soft text-hadir' : 'border-garis-kuat bg-kapur-raised text-tinta-muted',
              )}
            >
              {finished ? <Check strokeWidth={2.5} className="size-4" /> : i + 1}
            </span>
            <span className={cx(isCurrent ? 'inline' : 'hidden md:inline')}>
              {s.label}
              {s.status === 'skipped' && !isCurrent && <span className="sr-only"> ({skippedText})</span>}
            </span>
            {i < items.length - 1 && <span aria-hidden className="hidden h-0.5 w-4 bg-garis-kuat md:block" />}
          </li>
        );
      })}
    </ol>
  );
}

export interface Choice {
  value: string;
  label: string;
  /** One line under the label. It describes the choice; the label alone is its name. */
  hint?: string;
}

/**
 * One question with a few answers as large cards (radio buttons underneath, so the keyboard works as expected).
 * Works controlled (`value`) or not (`defaultValue`, read from the form).
 */
export function ChoiceGroup({
  legend,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  required,
  columns = 1,
  className,
}: {
  legend: string;
  name: string;
  options: readonly Choice[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  /** Cards side by side on a wide screen (2: from 640 px; 4: two from 640 px, four from 1024 px). One column on a phone. */
  columns?: 1 | 2 | 4;
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset className={cx('m-0 grid min-w-0 gap-2 border-0 p-0', columns === 2 && 'sm:grid-cols-2', columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4', className)}>
      <legend className="mb-2 p-0 text-small font-semibold text-tinta">{legend}</legend>
      {options.map((o, i) => (
        <div
          key={o.value}
          className="relative grid min-h-12 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 rounded-kontrol border border-garis-kuat bg-kapur-raised px-3 py-2 text-body text-tinta has-[:checked]:border-2 has-[:checked]:border-papan has-[:checked]:bg-papan-tipis lg:min-h-11 lg:text-isi"
        >
          <input
            id={`${id}-in-${i}`}
            type="radio"
            name={name}
            value={o.value}
            required={required}
            aria-describedby={o.hint ? `${id}-${i}` : undefined}
            {...(value !== undefined ? { checked: value === o.value, onChange: () => onValueChange?.(o.value) } : { defaultChecked: defaultValue === o.value, onChange: () => onValueChange?.(o.value) })}
            className="relative z-10 size-5 accent-papan"
          />
          {/* The label is only the name; its ::after covers the card so a press anywhere on it chooses. */}
          <label htmlFor={`${id}-in-${i}`} className="cursor-pointer font-bold after:absolute after:inset-0 after:content-['']">
            {o.label}
          </label>
          {o.hint && (
            <span id={`${id}-${i}`} className="col-start-2 text-small text-tinta-muted">
              {o.hint}
            </span>
          )}
        </div>
      ))}
    </fieldset>
  );
}

/** A short list of what an answer turns on, shown before saving. Polite live region: it changes as the choice changes. */
export function PresetSummary({ title, items, testId }: { title: string; items: readonly string[]; testId?: string }) {
  return (
    <div aria-live="polite" data-testid={testId} className="flex flex-col gap-2 rounded-ubin bg-ubin p-4">
      <strong className="text-isi-strong">{title}</strong>
      <ul className="m-0 grid list-disc gap-x-6 gap-y-1 pl-5 text-isi text-tinta sm:grid-cols-2 xl:grid-cols-3">
        {items.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** Back on the left, the step's own actions on the right. */
export function WizardNav({ onBack, backLabel, children }: { onBack?: () => void; backLabel: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
      {onBack ? (
        <button type="button" onClick={onBack} className="min-h-11 cursor-pointer rounded-kontrol border border-batas-lembut bg-kapur-raised px-4 text-isi-strong font-semibold text-tinta hover:bg-ubin lg:min-h-10">
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <span className="flex flex-wrap justify-end gap-2">{children}</span>
    </div>
  );
}
