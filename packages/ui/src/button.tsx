import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base: CSSProperties = {
  minHeight: 44, // comfortable one-handed tap target on phones
  padding: '0 18px',
  borderRadius: 'var(--absah-radius)',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

const variants: Record<ButtonVariant, CSSProperties> = {
  primary: { background: 'var(--absah-primary)', color: 'var(--absah-primary-text)', border: 'none' },
  secondary: { background: 'transparent', color: 'var(--absah-text)', border: '1px solid var(--absah-border)' },
};

export function Button({ variant = 'primary', type = 'button', style, ...props }: ButtonProps) {
  return <button type={type} data-variant={variant} style={{ ...base, ...variants[variant], ...style }} {...props} />;
}
