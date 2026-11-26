import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cx } from '../cx';

// v3: white card, radius 20, two-layer shadow, no visible border. The transparent border keeps an outline in forced colours.
const card = cva('card-surface box-border rounded-kartu border bg-kapur-raised text-tinta', {
  variants: {
    // active = "what is happening now" (the lesson in progress), muted = quiet background group.
    tone: { default: 'border-transparent', active: 'border-2 border-papan', muted: 'border-transparent bg-ubin shadow-none' },
    padding: { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5', xl: 'p-6' },
  },
  defaultVariants: { tone: 'default', padding: 'md' },
});

export interface CardProps extends HTMLAttributes<HTMLElement>, VariantProps<typeof card> {
  /** The element: a section or article gives the card a place in the page outline, li goes inside a list. */
  as?: 'div' | 'section' | 'article' | 'li';
}

export function Card({ as: Tag = 'div', tone, padding, className, ...props }: CardProps) {
  return <Tag className={cx(card({ tone, padding }), className)} {...props} />;
}
