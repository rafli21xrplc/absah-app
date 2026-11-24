import type { ReactNode } from 'react';
import { cx } from '../cx';
import { initials } from './initials';

export interface ListRowProps {
  name: string;
  /** Small line under the name, e.g. "No. absen 3". */
  detail?: string;
  /** A control or a status (StatusPill). The row itself is not a button: the right side is the action. */
  right?: ReactNode;
  as?: 'div' | 'li';
  className?: string;
}

/** A student (or any person) in a list: initials avatar, name, detail and a slot on the right. At least 64 px high. */
export function ListRow({ name, detail, right, as: Tag = 'div', className }: ListRowProps) {
  return (
    <Tag className={cx('flex min-h-16 items-center gap-3 rounded-md border border-garis bg-kapur-raised px-3 py-2', className)}>
      <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-garis text-small font-bold text-tinta">
        {initials(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-strong">{name}</span>
        {detail && <span className="truncate text-small text-tinta-muted">{detail}</span>}
      </span>
      {right}
    </Tag>
  );
}
