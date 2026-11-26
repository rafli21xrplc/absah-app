import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

const t = messages.pageHeader;

export interface DateSwitcherProps {
  /** Already formatted on the school clock, e.g. "Senin, 25 Januari 2027". */
  label: string;
  /** Without these the date is shown alone (a page that only knows today): no arrows that do nothing. */
  onPrev?: () => void;
  onNext?: () => void;
  /** The next day is in the future: the arrow stays but is unavailable. */
  nextDisabled?: boolean;
}

const control =
  'box-border inline-flex h-11 items-center justify-center rounded-kontrol border border-batas-lembut bg-kapur-raised text-tinta shadow-kartu';

/** Day before, the date, day after. The arrows are named "Hari sebelumnya" and "Hari berikutnya". */
export function DateSwitcher({ label, onPrev, onNext, nextDisabled = false }: DateSwitcherProps) {
  const date = (
    <span className={cx(control, 'gap-2 px-4 text-isi-strong')}>
      <CalendarDays aria-hidden strokeWidth={1.75} className="size-4 text-tinta-muted" />
      <time>{label}</time>
    </span>
  );
  if (!onPrev && !onNext) return date;
  return (
    <div role="group" aria-label={t.date} className="flex items-center gap-2">
      <button type="button" aria-label={t.prevDay} onClick={onPrev} disabled={!onPrev} className={cx(control, 'w-11 cursor-pointer hover:bg-ubin disabled:cursor-not-allowed disabled:text-tinta-muted')}>
        <ChevronLeft aria-hidden strokeWidth={2} className="size-4" />
      </button>
      {date}
      <button
        type="button"
        aria-label={t.nextDay}
        onClick={onNext}
        disabled={!onNext || nextDisabled}
        className={cx(control, 'w-11 cursor-pointer hover:bg-ubin disabled:cursor-not-allowed disabled:text-tinta-muted')}
      >
        <ChevronRight aria-hidden strokeWidth={2} className="size-4" />
      </button>
    </div>
  );
}

export interface PageHeaderProps {
  /** The page's one h1. */
  title: string;
  date?: DateSwitcherProps;
  /** How fresh the data is, e.g. "Diperbarui 09.42 · semester genap 2026/2027". Always shown when the page shows live numbers. */
  updated?: string;
  /** Extra context after the date (or instead of it). */
  meta?: ReactNode;
  /** Buttons on the right: at most one primary. */
  actions?: ReactNode;
}

/** v3 page header: h1, then date switcher + freshness on the left and the actions on the right, on one line from 1024 px. */
export function PageHeader({ title, date, updated, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="m-0 text-h1 text-tinta">{title}</h1>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          {date && <DateSwitcher {...date} />}
          {updated && (
            <p className="m-0 inline-flex items-center gap-2 text-small text-tinta-muted">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-papan" />
              {updated}
            </p>
          )}
          {meta}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
