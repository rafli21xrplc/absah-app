'use client';

import { type VariantProps } from 'class-variance-authority';
import { useId, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { buttonStyles } from './button-styles';
import { Spinner } from './motion/spinner';

export type ButtonVariant = 'primary' | 'stabilo' | 'secondary' | 'ghost' | 'danger';
/** Minimum height in px: 44 web, 48 quiet actions on a phone, 52 the main action on a phone, 64 the kiosk. */
export type ButtonSize = '44' | '48' | '52' | '64';

const button = buttonStyles;

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>, Pick<VariantProps<typeof button>, 'variant'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  /**
   * Why the button cannot be used, in words, shown under it. A grey button alone does not say what to do next
   * (Sistem-UI). With a reason the button stays focusable (aria-disabled) so a screen reader reaches the reason too.
   */
  disabledReason?: string;
  /** Shows a spinner and ignores presses until the work is done. */
  loading?: boolean;
}

/** One main (primary) button per screen is the page's job, not the component's. */
export function Button({ variant = 'primary', size = '44', type = 'button', disabled = false, disabledReason, loading = false, className, children, onClick, 'aria-describedby': describedBy, ...props }: ButtonProps) {
  const reasonId = useId();
  const blocked = disabled || loading;
  // Disabled looks unavailable (grey). Loading keeps its colour and shows the ring.
  const looksBlocked = disabled;
  // With a reason the button stays focusable (aria-disabled) so the reason can be reached; without one it is a native disabled button.
  const soft = blocked && Boolean(disabledReason);

  const guard = (e: MouseEvent<HTMLButtonElement>) => {
    if (blocked) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const control = (
    <button
      type={type}
      data-variant={variant}
      className={cx(button({ variant, size, blocked: looksBlocked, busy: loading && !disabled }), className)}
      disabled={blocked && !soft}
      aria-disabled={soft || undefined}
      aria-busy={loading || undefined}
      aria-describedby={soft ? [describedBy, reasonId].filter(Boolean).join(' ') : describedBy}
      onClick={guard}
      {...props}
    >
      {loading && <Spinner tone={variant === 'primary' && !disabled ? 'on-papan' : 'papan'} />}
      {children}
      {loading && <span className="sr-only">{messages.button.loading}</span>}
    </button>
  );

  if (!soft) return control;
  return (
    // A button that fills its row must fill the wrapper too, or the reason would shrink it to the width of its words.
    <span className={cx('inline-flex flex-col items-start gap-1', className?.includes('w-full') && 'w-full')}>
      {control}
      <span id={reasonId} className="text-small text-tinta-muted">
        {disabledReason}
      </span>
    </span>
  );
}
