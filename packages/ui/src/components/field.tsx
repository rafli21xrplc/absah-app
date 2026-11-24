'use client';

import { ChevronDown, CircleAlert } from 'lucide-react';
import { createContext, useContext, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

interface FieldContextValue {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** The ids and aria attributes a control takes from its Field. Outside a Field the control works on its own. */
function useControl(own: { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' }) {
  const field = useContext(FieldContext);
  return {
    id: own.id ?? field?.id,
    'aria-describedby': [own['aria-describedby'], field?.describedBy].filter(Boolean).join(' ') || undefined,
    'aria-invalid': field?.invalid ? true : own['aria-invalid'],
    invalid: field?.invalid ?? own['aria-invalid'] === true,
  };
}

export interface FieldProps {
  /** Always above the control, never inside it. */
  label: string;
  /** Adds "(boleh dikosongkan)" after the label. */
  optional?: boolean;
  /** A short help line under the control. */
  hint?: string;
  /** What is wrong and what to do, in words (never a code). Shown under the control in red, with an icon. */
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Label above, control, then hint and error below. The control (Input, Textarea or Select) is wired automatically. */
export function Field({ label, optional, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cx('flex flex-col gap-1', className)}>
        <label htmlFor={id} className="text-small font-semibold text-tinta">
          {label}
          {optional && <span className="font-medium text-tinta-muted"> {messages.field.optional}</span>}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="m-0 text-small text-tinta-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} aria-live="polite" className="m-0 flex items-start gap-1 text-small font-semibold text-alpa">
            <CircleAlert aria-hidden strokeWidth={1.75} className="mt-px size-4 shrink-0" />
            <span>
              <span className="sr-only">{messages.field.errorLabel}: </span>
              {error}
            </span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

const control =
  'box-border w-full rounded-md bg-kapur-raised px-3 text-body text-tinta placeholder:text-tinta-muted disabled:cursor-not-allowed disabled:bg-garis disabled:text-tinta-muted';
const border = (invalid: boolean) => (invalid ? 'border-2 border-alpa' : 'border border-garis-kuat');

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const c = useControl(props);
  return <input {...props} id={c.id} aria-describedby={c['aria-describedby']} aria-invalid={c['aria-invalid']} className={cx(control, 'min-h-12', border(c.invalid), className)} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const c = useControl(props);
  return (
    <textarea {...props} rows={rows} id={c.id} aria-describedby={c['aria-describedby']} aria-invalid={c['aria-invalid']} className={cx(control, 'py-3', border(c.invalid), className)} />
  );
}

/** The browser's own select: it opens the phone's native picker, which is the easiest control on a cheap Android. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const c = useControl(props);
  return (
    <span className="relative block">
      <select
        {...props}
        id={c.id}
        aria-describedby={c['aria-describedby']}
        aria-invalid={c['aria-invalid']}
        className={cx(control, 'min-h-12 cursor-pointer appearance-none pr-10', border(c.invalid), className)}
      >
        {children}
      </select>
      <ChevronDown aria-hidden strokeWidth={1.75} className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-tinta-muted" />
    </span>
  );
}
