import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cx } from '../cx';

const card = cva('rounded-lg border bg-kapur-raised text-tinta', {
  variants: {
    // active = "what is happening now" (the lesson in progress), muted = quiet background group.
    tone: { default: 'border-garis', active: 'border-2 border-papan', muted: 'border-garis bg-kapur' },
    padding: { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' },
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
