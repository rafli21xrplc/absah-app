'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ElementType, type ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

export interface SideNavItem {
  key: string;
  label: string;
  href: string;
  /** Decorative icon (aria-hidden); the label is always shown. */
  icon: ReactNode;
  current?: boolean;
}

export interface SideNavGroup {
  key: string;
  /** Small heading above the group (e.g. "DATA SEKOLAH"). A group without one is a plain list. */
  title?: string;
  items: readonly SideNavItem[];
}

export interface SideNavProps {
  groups: readonly SideNavGroup[];
  /** The link element. Pass next/link in the app; plain <a> by default so the package does not depend on Next. */
  linkAs?: ElementType;
  label?: string;
  /** Called when a link is pressed, e.g. to close the sheet the menu sits in on a phone. */
  onNavigate?: () => void;
  className?: string;
  /**
   * Titled groups fold shut under their heading. The group holding the current page is always open; the others start shut and
   * remember what the person opened (in this browser, under `storageKey`). Off by default: a plain list needs no memory.
   */
  collapsible?: boolean;
  storageKey?: string;
}

const DEFAULT_KEY = 'absah-menu';

function readOpen(key: string): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** What the person opened or shut by hand. Starts empty (server and first paint agree), then reads the browser's memory. */
function useGroupMemory(key: string, enabled: boolean): [Record<string, boolean>, (group: string, open: boolean) => void] {
  const [memory, setMemory] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (enabled) setMemory(readOpen(key));
  }, [key, enabled]);
  const set = (group: string, open: boolean) => {
    const next = { ...memory, [group]: open };
    setMemory(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The choice still holds for this visit.
    }
  };
  return [memory, set];
}

/** The staff side menu: groups of links, the current one marked with aria-current="page". The caller drops items that must not show. */
export function SideNav({ groups, linkAs, label = messages.sideNav.label, onNavigate, className, collapsible = false, storageKey = DEFAULT_KEY }: SideNavProps) {
  const Link = linkAs ?? 'a';
  const [memory, remember] = useGroupMemory(storageKey, collapsible);
  return (
    <nav aria-label={label} className={cx('flex flex-col gap-3', className)}>
      {groups.map((group) => {
        const folds = collapsible && Boolean(group.title);
        const holdsCurrent = group.items.some((i) => i.current);
        const open = !folds || holdsCurrent || (memory[group.key] ?? false);
        const listId = `menu-${group.key}`;
        return (
          <div key={group.key} className="flex flex-col gap-1">
            {/* A visible heading is enough to read the group; naming the list too would make its title match any label query. */}
            {group.title && !folds && <p className="m-0 px-3 text-small font-bold uppercase text-tinta-muted">{group.title}</p>}
            {group.title && folds && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                // The group with the current page cannot be shut: the person would lose sight of where they are.
                aria-disabled={holdsCurrent || undefined}
                onClick={() => !holdsCurrent && remember(group.key, !open)}
                className={cx(
                  'flex min-h-9 w-full items-center justify-between gap-2 rounded-md border-0 bg-transparent px-3 text-left text-small font-bold uppercase text-tinta-muted hover:bg-kapur',
                  holdsCurrent ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <span>{group.title}</span>
                {open ? <ChevronDown aria-hidden strokeWidth={1.75} className="size-4" /> : <ChevronRight aria-hidden strokeWidth={1.75} className="size-4" />}
              </button>
            )}
            {/* A shut group is not rendered at all: nothing to tab through, nothing for a screen reader to read. */}
            {open && (
            <ul id={listId} className="m-0 flex list-none flex-col gap-1 p-0">
              {group.items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    onClick={onNavigate}
                    className={cx(
                      // The current item is bold, filled and has a bar on the left, so it does not depend on colour alone.
                      'flex min-h-11 items-center gap-3 rounded-md border-l-4 px-3 text-body no-underline lg:min-h-10',
                      item.current ? 'border-papan bg-papan-soft font-bold text-papan' : 'border-transparent font-semibold text-tinta hover:bg-kapur',
                    )}
                  >
                    <span aria-hidden className="inline-flex shrink-0">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
