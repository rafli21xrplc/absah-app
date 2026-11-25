import type { ReactNode } from 'react';
import { cx } from '../cx';

export interface EmptyStateProps {
  /** What is missing, e.g. "Belum ada siswa di X-2". */
  title: string;
  /** What to do about it, in plain words. */
  children?: ReactNode;
  /** One button that fixes it (the page's primary action). */
  action?: ReactNode;
  /** Heading level of the title, to fit the page outline. */
  headingLevel?: 'h1' | 'h2' | 'h3';
  /** Quiet version for inside a card that already has its border: no box in a box, just the words. */
  bare?: boolean;
  className?: string;
}

/** The "kosong" state of a list or form. */
export function EmptyState({ title, children, action, headingLevel: Heading = 'h2', bare = false, className }: EmptyStateProps) {
  return (
    <section className={cx('flex flex-col items-start gap-3 text-tinta', bare ? 'py-1' : 'rounded-lg border border-garis bg-kapur-raised p-6', className)}>
      <Heading className={cx('m-0', bare ? 'text-body font-normal text-tinta-muted' : 'text-body-strong')}>{title}</Heading>
      {children && <p className="m-0 text-body text-tinta-muted">{children}</p>}
      {action}
    </section>
  );
}
