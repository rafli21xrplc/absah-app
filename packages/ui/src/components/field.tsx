'use client';

import { CircleAlert } from 'lucide-react';
import { createContext, useContext, useId, type ComponentPropsWithRef, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

interface FieldContextValue {
  id: string;
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** The ids and aria attributes a control takes from its Field. Outside a Field the control works on its own. */
export function useControl(own: { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' }) {
  const field = useContext(FieldContext);
  return {
    id: own.id ?? field?.id,
    labelId: field?.labelId,
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
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <FieldContext.Provider value={{ id, labelId, describedBy, invalid: Boolean(error) }}>
      <div className={cx('flex flex-col gap-1', className)}>
        <label id={labelId} htmlFor={id} className="text-small font-semibold text-tinta">
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

export const controlClass =
  'box-border w-full rounded-md bg-kapur-raised px-3 text-body text-tinta lg:text-isi placeholder:text-tinta-muted disabled:cursor-not-allowed disabled:bg-garis disabled:text-tinta-muted';
export const borderClass = (invalid: boolean) => (invalid ? 'border-2 border-alpa' : 'border border-garis-kuat');

/** `ref` works as a plain prop (React 19), so a page can focus the first box with a mistake. */
export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  const c = useControl(props);
  return <input {...props} id={c.id} aria-describedby={c['aria-describedby']} aria-invalid={c['aria-invalid']} className={cx(controlClass, 'min-h-12 lg:min-h-9', borderClass(c.invalid), className)} />;
}

export function Textarea({ className, rows = 4, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const c = useControl(props);
  return (
    <textarea {...props} rows={rows} id={c.id} aria-describedby={c['aria-describedby']} aria-invalid={c['aria-invalid']} className={cx(controlClass, 'py-3 lg:py-2', borderClass(c.invalid), className)} />
  );
}
