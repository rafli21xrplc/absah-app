'use client';

import { Check } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { AccountSummary, AccountTrigger, SchoolTrigger, type SchoolChoice } from './sidebar-menus';

const t = messages.sidebar;

export function SchoolPopover({ schools, activeId, onSelect, defaultOpen }: { schools: readonly SchoolChoice[]; activeId: string; onSelect: (id: string) => void; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const active = schools.find((s) => s.id === activeId) ?? schools[0];
  if (!active) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SchoolTrigger school={active} />
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={t.chooseSchool} className="flex w-60 flex-col gap-1 p-2">
        <p className="m-0 px-3 py-1 text-small font-bold uppercase text-tinta-muted">{t.chooseSchool}</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {schools.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                aria-current={s.id === active.id ? 'true' : undefined}
                onClick={() => {
                  setOpen(false);
                  if (s.id !== active.id) onSelect(s.id);
                }}
                className={cx(
                  'flex min-h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 px-3 py-2 text-left',
                  s.id === active.id ? 'bg-papan-soft text-papan' : 'bg-transparent text-tinta hover:bg-kapur',
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className={cx('truncate', s.id === active.id ? 'text-body-strong' : 'text-body font-semibold')}>{s.name}</span>
                  {s.detail && <span className="truncate text-small text-tinta-muted">{s.detail}</span>}
                </span>
                {s.id === active.id && <Check aria-hidden strokeWidth={2} className="size-5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function AccountPopover({ name, detail, email, defaultOpen, children }: { name: string; detail?: string; email: string | null; defaultOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <AccountTrigger name={name} {...(detail ? { detail } : {})} />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        aria-label={t.accountMenu}
        className="flex w-60 flex-col gap-1 p-2"
        // A link or a button marked data-menu-close ends the visit to the menu; the theme switch inside it does not.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a, [data-menu-close]')) setOpen(false);
        }}
      >
        <div className="flex flex-col gap-1 px-2 pb-2">
          <AccountSummary name={name} {...(email ? { email } : {})} />
        </div>
        <div className="flex flex-col gap-1 border-t border-garis pt-2">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
