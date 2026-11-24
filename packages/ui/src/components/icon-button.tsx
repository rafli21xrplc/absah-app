import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';

const iconButton = cva('inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors duration-150 disabled:cursor-not-allowed disabled:text-tinta-muted', {
  variants: {
    variant: {
      ghost: 'border border-transparent bg-transparent text-tinta hover:bg-papan-soft active:bg-papan-soft',
      secondary: 'border border-garis-kuat bg-kapur-raised text-tinta hover:bg-papan-soft active:bg-papan-soft',
    },
    size: { '44': 'size-11', '52': 'size-13', '64': 'size-16' },
  },
  defaultVariants: { variant: 'ghost', size: '44' },
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>, VariantProps<typeof iconButton> {
  /** What the button does, in words. Required: an icon alone is not a name. */
  label: string;
  /** The icon, already sized (for example <X className="size-5" strokeWidth={1.75} />). */
  icon: ReactNode;
}

export function IconButton({ label, icon, variant, size, type = 'button', className, ...props }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} className={cx(iconButton({ variant, size }), className)} {...props}>
      <span aria-hidden className="inline-flex">
        {icon}
      </span>
    </button>
  );
}
