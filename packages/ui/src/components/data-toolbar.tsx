import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../cx';

export interface DataToolbarProps {
  search: {
    /** Visible text next to the box, e.g. "Cari siswa". */
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Filters: Select with a label, SegmentedControl, FilterChip. */
  children?: ReactNode;
  /** Buttons at the far end, e.g. the page's primary "Tambah siswa". */
  actions?: ReactNode;
  className?: string;
}

/** The bar above a data table: search, filters and the page's actions. The page decides what a search or filter does. */
export function DataToolbar({ search, children, actions, className }: DataToolbarProps) {
  return (
    <div className={cx('flex flex-wrap items-end gap-2', className)}>
      <label className="flex min-h-11 min-w-60 max-w-120 flex-1 items-center gap-2 rounded-md border border-garis-kuat bg-kapur-raised px-3 lg:min-h-9">
        <Search aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
        <span className="shrink-0 text-small font-bold text-tinta-muted">{search.label}</span>
        <input
          type="search"
          value={search.value}
          placeholder={search.placeholder}
          onChange={(e) => search.onChange(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent text-isi text-tinta placeholder:text-tinta-muted"
        />
      </label>
      {children}
      {actions && <div className="ml-auto flex gap-2">{actions}</div>}
    </div>
  );
}
