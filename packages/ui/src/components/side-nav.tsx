'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ElementType, type ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { useRailScreen } from './use-wide-screen';

export interface SideNavItem {
  key: string;
  label: string;
  href: string;
  /** Decorative icon (aria-hidden); the label is always shown. */
  icon: ReactNode;
  current?: boolean;
  /** A count next to the label (v3), e.g. izin waiting. `label` is the spoken text ("4 izin menunggu"). */
  badge?: { count: number; tone: 'stabilo' | 'alpa'; label: string };
}

const BADGE = { stabilo: 'bg-stabilo-soft text-on-stabilo-soft', alpa: 'bg-alpa-soft text-alpa' } as const;

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
  /** "sidebar": on the light v3 side column of a laptop (an icon rail from 1024 to 1279 px). "light" (default): on a light surface, e.g. the phone's sheet. */
  tone?: 'light' | 'sidebar';
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
export function SideNav({ groups, linkAs, label = messages.sideNav.label, onNavigate, className, collapsible = false, storageKey = DEFAULT_KEY, tone = 'light' }: SideNavProps) {
  const dark = tone === 'sidebar';
  const Link = linkAs ?? 'a';
  const [memory, remember] = useGroupMemory(storageKey, collapsible);
  // 1024-1279 px: the column is an icon rail. Every group is open there (a fold button has no room), labels become tooltips.
  const rail = useRailScreen() && dark;
  // The rail's CSS: labels and headings are only for screen readers between lg and xl.
  const railText = dark ? 'lg:max-xl:sr-only' : '';
  return (
    <nav aria-label={label} className={cx('flex flex-col gap-3', className)}>
      {groups.map((group) => {
        const folds = collapsible && Boolean(group.title) && !rail;
        const holdsCurrent = group.items.some((i) => i.current);
        const open = !folds || holdsCurrent || (memory[group.key] ?? false);
        const listId = `menu-${group.key}`;
        return (
          <div key={group.key} className="flex flex-col gap-1">
            {/* A visible heading is enough to read the group; naming the list too would make its title match any label query. */}
            {group.title && !folds && (
              <p className={cx('m-0 px-3 pt-1 text-mini font-bold uppercase tracking-wider', dark ? 'text-sidebar-muted' : 'text-tinta-muted', railText)}>{group.title}</p>
            )}
            {group.title && folds && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                // The group with the current page cannot be shut: the person would lose sight of where they are.
                aria-disabled={holdsCurrent || undefined}
                onClick={() => !holdsCurrent && remember(group.key, !open)}
                className={cx(
                  'box-border flex min-h-8 w-full items-center justify-between gap-2 rounded-md border-0 bg-transparent px-3 text-left text-mini font-bold uppercase tracking-wider',
                  dark ? 'text-sidebar-muted hover:bg-sidebar-hover' : 'text-tinta-muted hover:bg-kapur',
                  holdsCurrent ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <span>{group.title}</span>
                {open ? <ChevronDown aria-hidden strokeWidth={1.75} className="size-4" /> : <ChevronRight aria-hidden strokeWidth={1.75} className="size-4" />}
              </button>
            )}
            {/* A shut group is not rendered at all: nothing to tab through, nothing for a screen reader to read. */}
            {open && (
            <ul id={listId} className="m-0 flex list-none flex-col gap-px p-0">
              {group.items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    onClick={onNavigate}
                    title={rail ? item.label : undefined}
                    className={cx(
                      // The current item is bold, filled and has a 4 px bar on the left (v3), so it does not depend on colour alone.
                      'relative flex min-h-11 items-center gap-3 rounded-kontrol px-3 text-isi no-underline lg:min-h-10',
                      dark && 'lg:max-xl:justify-center lg:max-xl:px-0',
                      item.current
                        ? dark
                          ? 'bg-sidebar-aktif font-bold text-papan'
                          : 'bg-papan-soft font-bold text-papan'
                        : dark
                          ? 'font-medium text-on-sidebar hover:bg-sidebar-hover'
                          : 'font-semibold text-tinta hover:bg-kapur',
                    )}
                  >
                    {item.current && <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-papan lg:max-xl:-left-2" />}
                    <span aria-hidden className={cx('relative inline-flex shrink-0', !item.current && (dark ? 'text-sidebar-muted' : 'text-tinta-muted'))}>
                      {item.icon}
                      {item.badge && item.badge.count > 0 && (
                        <span className={cx('absolute -right-1 -top-1 hidden size-2 rounded-full lg:max-xl:block', item.badge.tone === 'alpa' ? 'bg-alpa' : 'bg-stabilo')} />
                      )}
                    </span>
                    <span className={cx('min-w-0 flex-1 truncate', railText)}>{item.label}</span>
                    {item.badge && item.badge.count > 0 && (
                      <span className={cx('inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-mini font-bold tabular-nums', BADGE[item.badge.tone], railText)}>
                        <span aria-hidden>{item.badge.count}</span>
                        <span className="sr-only">{item.badge.label}</span>
                      </span>
                    )}
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
