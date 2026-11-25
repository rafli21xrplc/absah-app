'use client';

import { useRef, useState, type ClipboardEvent, type FocusEvent } from 'react';
import { cx } from '../../cx';

export interface CodeInputProps {
  /** Accessible name, e.g. "Kode dari WhatsApp". */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called once when the last digit is typed or pasted. */
  onComplete?: (value: string) => void;
  length?: number;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  'aria-describedby'?: string;
  /** Class that shakes the boxes (useShake). */
  boxesClassName?: string;
  className?: string;
}

/**
 * ONE input drawn as separate boxes (not six inputs), so SMS and WhatsApp autofill, paste and screen readers all work.
 * The real input covers the boxes and is see-through; digits only. It sends itself on the last digit (no button to press).
 */
export function CodeInput({ label, value, onChange, onComplete, length = 6, invalid, disabled, autoFocus, 'aria-describedby': describedBy, boxesClassName, className }: CodeInputProps) {
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const active = Math.min(value.length, length - 1);

  const change = (raw: string) => {
    const next = raw.replace(/\D/g, '').slice(0, length);
    onChange(next);
    if (next.length === length && value.length !== length) onComplete?.(next);
  };
  // maxLength cuts a pasted "481 723" to six characters INCLUDING the space, so the paste is read here instead.
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    change(e.clipboardData.getData('text'));
  };
  const focus = (e: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    // Keep the caret at the end: the boxes show one position, not a selection.
    const end = e.currentTarget.value.length;
    e.currentTarget.setSelectionRange(end, end);
  };

  return (
    <div className={cx('relative', className)}>
      <div className={cx('flex gap-2', boxesClassName)} aria-hidden>
        {Array.from({ length }, (_, i) => {
          const digit = value[i];
          const here = focused && !disabled && i === active && value.length < length;
          return (
            <span
              key={i}
              className={cx(
                'flex h-14 min-w-0 flex-1 items-center justify-center rounded-md bg-kapur-raised text-h1 font-bold tabular-nums text-tinta',
                invalid ? 'border-2 border-alpa' : here ? 'border-2 border-papan' : 'border border-garis-kuat',
                disabled && 'bg-garis',
              )}
            >
              {digit ?? (here ? <span className="motion-caret h-7 w-0.5 bg-papan" /> : null)}
            </span>
          );
        })}
      </div>
      <input
        ref={input}
        value={value}
        onChange={(e) => change(e.target.value)}
        onPaste={paste}
        onFocus={focus}
        onBlur={() => setFocused(false)}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        pattern="[0-9]*"
        disabled={disabled}
        autoFocus={autoFocus}
        className="absolute inset-0 size-full cursor-text border-0 bg-transparent p-0 text-transparent opacity-0 caret-transparent outline-none"
      />
    </div>
  );
}
