'use client';

import type { ElementType, ReactNode } from 'react';
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
}

/** The staff side menu: groups of links, the current one marked with aria-current="page". The caller drops items that must not show. */
export function SideNav({ groups, linkAs, label = messages.sideNav.label, onNavigate, className }: SideNavProps) {
  const Link = linkAs ?? 'a';
  return (
    <nav aria-label={label} className={cx('flex flex-col gap-5', className)}>
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-1">
          {/* A visible heading is enough to read the group; naming the list too would make its title match any label query. */}
          {group.title && <p className="m-0 px-3 text-small font-bold uppercase text-tinta-muted">{group.title}</p>}
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {group.items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  onClick={onNavigate}
                  className={cx(
                    // The current item is bold, filled and has a bar on the left, so it does not depend on colour alone.
                    'flex min-h-11 items-center gap-3 rounded-md border-l-4 px-3 text-body no-underline',
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
        </div>
      ))}
    </nav>
  );
}
