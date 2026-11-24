import type { ReactNode } from 'react';

/** A labelled cell of a state matrix. Only used by stories. Content keeps its own width unless `fill` is set (form fields). */
export function Cell({ title, children, fill = false }: { title: string; children: ReactNode; fill?: boolean }) {
  return (
    <div className={`flex flex-col gap-2 ${fill ? 'items-stretch' : 'items-start'}`}>
      <p className="m-0 text-small text-tinta-muted">{title}</p>
      {children}
    </div>
  );
}

/** pseudo-states needs the element to be addressable, so each state cell gets an id. */
export function Matrix({ children, cols = 3 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' }[cols];
  return <div className={`grid gap-6 ${grid}`}>{children}</div>;
}
