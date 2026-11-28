import { CalendarOff, CircleCheck, Inbox, Lock, SearchX, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../cx';

/**
 * What kind of "nothing" this is. Each has its own icon and tone, so a person sees at a glance whether something is missing
 * (empty), a search found nothing (search), all work is done (done), the page is not theirs (noAccess) or today has no school
 * (offDay).
 */
export type EmptyKind = 'empty' | 'search' | 'done' | 'noAccess' | 'offDay';

const LOOK: Record<EmptyKind, { icon: LucideIcon; tile: string }> = {
  empty: { icon: Inbox, tile: 'bg-papan-soft text-papan' },
  search: { icon: SearchX, tile: 'bg-latar-app text-tinta-muted' },
  done: { icon: CircleCheck, tile: 'bg-hadir-soft text-hadir' },
  noAccess: { icon: Lock, tile: 'bg-latar-app text-tinta-muted' },
  offDay: { icon: CalendarOff, tile: 'bg-izin-soft text-izin' },
};

export interface EmptyStateProps {
  /** What is missing, e.g. "Belum ada siswa di X-2". */
  title: string;
  /** What to do about it, in plain words. */
  children?: ReactNode;
  /** One button that fixes it (the page's primary action). */
  action?: ReactNode;
  /** A second, quieter way forward, e.g. "Lihat semua sesi". */
  secondaryAction?: ReactNode;
  /** Short hints under the actions: what makes this list fill up. */
  tips?: readonly ReactNode[];
  kind?: EmptyKind;
  /** Replaces the kind's icon. */
  icon?: LucideIcon;
  /** Heading level of the title, to fit the page outline. `p` for an empty part of a card that already has its heading. */
  headingLevel?: 'h1' | 'h2' | 'h3' | 'p';
  /** Inside a card that already has its border: no box in a box, smaller icon. */
  bare?: boolean;
  className?: string;
}

/** The "kosong" state of a page, list or card: an icon, what is missing, what to do, and the way forward. */
export function EmptyState({ title, children, action, secondaryAction, tips, kind = 'empty', icon, headingLevel: Heading = 'h2', bare = false, className }: EmptyStateProps) {
  const Icon = icon ?? LOOK[kind].icon;
  return (
    <section
      className={cx(
        'flex flex-col items-center gap-3 text-center text-tinta',
        bare ? 'px-4 py-8' : 'rounded-lg border border-dashed border-garis-kuat bg-kapur-raised px-6 py-10',
        className,
      )}
    >
      <span aria-hidden className={cx('inline-flex shrink-0 items-center justify-center rounded-lg', bare ? 'size-11' : 'size-14', LOOK[kind].tile)}>
        <Icon strokeWidth={1.75} className={bare ? 'size-5' : 'size-7'} />
      </span>
      <Heading className="m-0 max-w-xl text-body-strong">{title}</Heading>
      {children && <p className="m-0 max-w-xl text-body text-tinta-muted">{children}</p>}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {action}
          {secondaryAction}
        </div>
      )}
      {tips && tips.length > 0 && (
        <ul className="m-0 flex max-w-xl list-none flex-col gap-1 border-t border-garis p-0 pt-3 text-left text-small text-tinta-muted">
          {tips.map((tip, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden>•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
