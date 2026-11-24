import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { useId, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

export type ButtonVariant = 'primary' | 'stabilo' | 'secondary' | 'ghost' | 'danger';
/** Minimum height in px: 44 web, 48 quiet actions on a phone, 52 the main action on a phone, 64 the kiosk. */
export type ButtonSize = '44' | '48' | '52' | '64';

const button = cva(
  'inline-flex select-none items-center justify-center gap-2 rounded-md px-5 text-body-strong font-bold transition-colors duration-150',
  {
    variants: {
      variant: { primary: '', stabilo: '', secondary: '', ghost: '', danger: '' },
      size: { '44': 'min-h-11', '48': 'min-h-12', '52': 'min-h-13', '64': 'min-h-16 px-6' },
      blocked: { true: 'cursor-not-allowed border border-transparent bg-garis text-tinta-muted', false: 'cursor-pointer' },
    },
    // Colours live here, not in `variant`, so a blocked button replaces them instead of fighting them.
    compoundVariants: [
      {
        variant: 'primary',
        blocked: false,
        // In the dark theme papan-deep is too dark under the dark label (3.46:1, see tokens.test.ts), so the pressed
        // state keeps papan and dims it instead. Pending a design decision (PR #63).
        class:
          'border border-transparent bg-papan text-on-papan hover:bg-papan-deep active:bg-papan-deep dark:hover:bg-papan dark:active:bg-papan dark:hover:brightness-90 dark:active:brightness-90',
      },
      { variant: 'stabilo', blocked: false, class: 'border border-transparent bg-stabilo text-on-stabilo hover:brightness-95 active:brightness-90' },
      {
        variant: 'secondary',
        blocked: false,
        class: 'border border-garis-kuat bg-kapur-raised font-semibold text-tinta hover:bg-papan-soft active:bg-papan-soft',
      },
      { variant: 'ghost', blocked: false, class: 'border border-transparent bg-transparent text-papan hover:bg-papan-soft active:bg-papan-soft' },
      { variant: 'danger', blocked: false, class: 'border border-alpa bg-kapur-raised text-alpa hover:bg-alpa-soft active:bg-alpa-soft' },
    ],
    defaultVariants: { variant: 'primary', size: '44', blocked: false },
  },
);

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
      className={cx(button({ variant, size, blocked }), className)}
      disabled={blocked && !soft}
      aria-disabled={soft || undefined}
      aria-busy={loading || undefined}
      aria-describedby={soft ? [describedBy, reasonId].filter(Boolean).join(' ') : describedBy}
      onClick={guard}
      {...props}
    >
      {loading && <Loader2 aria-hidden strokeWidth={1.75} className="size-5 animate-spin" />}
      {children}
      {loading && <span className="sr-only">{messages.button.loading}</span>}
    </button>
  );

  if (!soft) return control;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {control}
      <span id={reasonId} className="text-small text-tinta-muted">
        {disabledReason}
      </span>
    </span>
  );
}
