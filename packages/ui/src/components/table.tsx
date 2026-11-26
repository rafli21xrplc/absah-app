import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cx } from '../cx';

export interface TableProps {
  /** Names the table for screen readers (a real <caption>, not shown). Required. */
  caption: string;
  children: ReactNode;
  /** On the <table>, e.g. a minimum width so a wide table scrolls instead of squeezing. */
  className?: string;
  /** Inside a card that already has the border and shadow (DataCard): no second card around the table. */
  bare?: boolean;
  /** Rows 8 px shorter (py-2 instead of py-3): for the dense lists of the CMS pages (PG3). */
  dense?: boolean;
}

/**
 * A real <table> in a rounded card. The wrapper scrolls sideways when the table is wider than the screen, so it is a named
 * region that can take focus (keyboard users can scroll it).
 */
export function Table({ caption, children, className, bare = false, dense = false }: TableProps) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className={cx('relative overflow-x-auto', bare ? 'rounded-md' : 'card-surface rounded-lg border border-garis bg-kapur-raised', dense && '[&_td]:py-2 [&_th]:py-2 [&_thead_th]:whitespace-nowrap')}>
      <table className={cx('w-full border-collapse text-left text-body text-tinta', className)}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-kapur">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="[&>tr:last-child>*]:border-b-0">{children}</tbody>;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cx('hover:bg-papan-tipis', className)} {...props} />;
}

/** scope="col" (default) for a column heading, scope="row" for the first cell of a row (e.g. the student's name). */
export function Th({ scope = 'col', className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={cx('border-b border-garis px-3 py-3 text-left', scope === 'row' ? 'text-body-strong' : 'text-small font-semibold text-tinta-muted', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('border-b border-garis px-3 py-3 align-middle', className)} {...props} />;
}
