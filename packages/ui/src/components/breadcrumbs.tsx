import { ChevronRight } from 'lucide-react';
import type { ElementType } from 'react';
import { messages } from '../../messages/id';

export interface Crumb {
  label: string;
  /** A crumb with a link goes there; the last one (where the person is) never has one. */
  href?: string;
}

/** Where the page sits: "Data sekolah › Siswa". The last crumb is the page and is marked aria-current. */
export function Breadcrumbs({ items, linkAs }: { items: readonly Crumb[]; linkAs?: ElementType }) {
  const Link = linkAs ?? 'a';
  if (items.length === 0) return null;
  return (
    <nav aria-label={messages.breadcrumb.label} className="min-w-0">
      <ol className="m-0 flex list-none items-center gap-1 p-0 text-small">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />}
              {last ? (
                <span aria-current="page" className="truncate font-semibold text-tinta">
                  {c.label}
                </span>
              ) : c.href ? (
                <Link href={c.href} className="truncate text-tinta-muted no-underline hover:text-tinta">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate text-tinta-muted">{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
