import type { ElementType, ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

export interface BottomNavItem {
  key: string;
  label: string;
  href: string;
  /** Decorative icon (aria-hidden); the label is always shown. */
  icon: ReactNode;
  current?: boolean;
}

export interface BottomNavProps {
  /** Exactly four menus (Sistem-UI): the tuple type enforces it. */
  items: readonly [BottomNavItem, BottomNavItem, BottomNavItem, BottomNavItem];
  /** The link element. Pass next/link in the app; plain <a> by default so the package does not depend on Next. */
  linkAs?: ElementType;
  label?: string;
  className?: string;
}

/** The teacher's bottom bar. Where it sticks on the screen is the page shell's job (U3). */
export function BottomNav({ items, linkAs, label = messages.bottomNav.label, className }: BottomNavProps) {
  const Link = linkAs ?? 'a';
  return (
    <nav aria-label={label} className={cx('border-t border-garis bg-kapur-raised', className)}>
      <ul className="m-0 grid list-none grid-cols-4 p-0">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={cx(
                // The current menu is bold with a bar above it, not only a different colour.
                'flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 text-small no-underline',
                item.current ? 'border-papan font-bold text-papan' : 'border-transparent font-semibold text-tinta-muted',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
