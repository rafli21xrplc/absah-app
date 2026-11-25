'use client';

import { ChevronsUpDown } from 'lucide-react';
import { lazy, Suspense, useState, type ComponentProps, type ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { useWideScreen } from './use-wide-screen';

// The two menus in the side column (school and account) open as popovers. Radix popover is a separate chunk (~35 kB): the
// column arrives with plain buttons and a wide screen fetches the popover after mount; a tap before it arrives opens it on arrival.
const SchoolPopover = lazy(() => import('./sidebar-menus-popover').then((m) => ({ default: m.SchoolPopover })));
const AccountPopover = lazy(() => import('./sidebar-menus-popover').then((m) => ({ default: m.AccountPopover })));

const t = messages.sidebar;

/** One row of an account menu: a link or a button. Close the menu on press by being a link, or by `data-menu-close`. */
export const menuItemStyles =
  'flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-3 text-left text-body font-semibold text-tinta no-underline hover:bg-kapur';

/** The first letter of a name in a circle: a picture only, the name is always written next to it. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span aria-hidden className={cx('inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-papan-soft text-body-strong text-papan', className)}>
      {initial}
    </span>
  );
}

/** Who is signed in: avatar, name and the role(s) under it. Used by the account button and by the phone's menu sheet. */
export function AccountSummary({ name, detail, email }: { name: string; detail?: string; email?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-strong">{name}</span>
        {(detail || email) && <span className="truncate text-small text-tinta-muted">{detail ?? email}</span>}
      </span>
    </span>
  );
}

export interface SchoolChoice {
  id: string;
  name: string;
  detail?: string;
}

interface SchoolSwitcherProps {
  schools: readonly SchoolChoice[];
  activeId: string;
  onSelect: (id: string) => void;
}

const cardStyles = 'flex w-full min-h-14 items-center justify-between gap-2 rounded-md border border-garis bg-kapur px-3 py-2 text-left';

/** The school card as plain content: name over level. */
export function SchoolCard({ school, children }: { school: SchoolChoice; children?: ReactNode }) {
  return (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-strong">{school.name}</span>
        {school.detail && <span className="truncate text-small text-tinta-muted">{school.detail}</span>}
      </span>
      {children}
    </>
  );
}

export function SchoolTrigger({ school, ...props }: ComponentProps<'button'> & { school: SchoolChoice }) {
  return (
    <button type="button" aria-haspopup="dialog" {...props} className={cx(cardStyles, 'cursor-pointer text-tinta hover:border-garis-kuat')}>
      <SchoolCard school={school}>
        <ChevronsUpDown aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
      </SchoolCard>
      <span className="sr-only">{t.switchSchool}</span>
    </button>
  );
}

/**
 * The school (workspace) at the top of the side column. With one school it is a plain card; with several it opens a short list
 * to switch between them. Laptop only: the phone's menu sheet keeps its own Select.
 */
export function SchoolSwitcher({ schools, activeId, onSelect }: SchoolSwitcherProps) {
  const wide = useWideScreen();
  const [asked, setAsked] = useState(false);
  const active = schools.find((s) => s.id === activeId) ?? schools[0];
  if (!active) return null;
  if (schools.length < 2) {
    return (
      <div className={cardStyles}>
        <SchoolCard school={active} />
      </div>
    );
  }
  const plain = <SchoolTrigger school={active} onClick={() => setAsked(true)} />;
  if (!wide) return plain;
  return (
    <Suspense fallback={plain}>
      <SchoolPopover schools={schools} activeId={active.id} onSelect={onSelect} defaultOpen={asked} />
    </Suspense>
  );
}

export function AccountTrigger({ name, detail, ...props }: ComponentProps<'button'> & { name: string; detail?: string }) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      {...props}
      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 bg-transparent p-2 text-left text-tinta hover:bg-kapur"
    >
      <AccountSummary name={name} {...(detail ? { detail } : {})} />
      <ChevronsUpDown aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
      <span className="sr-only">{t.accountMenu}</span>
    </button>
  );
}

export interface AccountMenuProps {
  name: string;
  /** Role(s) in the active school, shown under the name. */
  detail?: string;
  email?: string | null;
  /** The rows: links and buttons styled with menuItemStyles, and whatever else the account needs (the theme switch). */
  children: ReactNode;
}

/** The account at the bottom of the side column: who is signed in, and a popover with the personal things and Keluar. */
export function AccountMenu({ name, detail, email, children }: AccountMenuProps) {
  const wide = useWideScreen();
  const [asked, setAsked] = useState(false);
  const plain = <AccountTrigger name={name} {...(detail ? { detail } : {})} onClick={() => setAsked(true)} />;
  if (!wide) return plain;
  return (
    <Suspense fallback={plain}>
      <AccountPopover name={name} {...(detail ? { detail } : {})} email={email ?? null} defaultOpen={asked}>
        {children}
      </AccountPopover>
    </Suspense>
  );
}
