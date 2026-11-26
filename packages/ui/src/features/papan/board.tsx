import type { ReactNode } from 'react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';
import { Banner } from '../../components/banner';
import { Button } from '../../components/button';
import { EmptyState } from '../../components/empty-state';
import { ErrorState } from '../../components/error-state';
import { SkeletonRows } from '../../components/skeleton';
import { STATUS_LOOK } from '../../components/status-pill';
import { statusTokens, type StatusCode } from '../../status';

const t = messages.board;

export interface StatusBoxData {
  code: Exclude<StatusCode, '?'>;
  count: number;
  /** One line under the number. Only what the API knows: nothing is worked out here. */
  caption?: string;
}

/**
 * The five boxes H, T, I, S, A of the arrival board. Each is letter + word + number + caption, never colour alone, in the fixed order
 * Hadir, Telat, Izin, Sakit, Alpa. A list, so a reader hears "5 items".
 */
export function StatusBoard({ items, label = t.summaryLabel }: { items: readonly StatusBoxData[]; label?: string }) {
  return (
    <ul aria-label={label} className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => {
        const { huruf, kata } = statusTokens(it.code);
        return (
          // White cards: the colour is only the letter chip (palet CMS: 80% neutral; full green only on the Hadir chip).
          <li key={it.code} className="card-surface box-border flex min-h-28 flex-col gap-2 rounded-lg border border-garis bg-kapur-raised p-4 text-tinta">
            <span className="flex items-center gap-2 text-body-strong text-tinta-muted">
              <span aria-hidden className={cx('inline-flex size-7 items-center justify-center rounded-sm text-small font-bold', STATUS_LOOK[it.code].chip)}>
                {huruf}
              </span>
              {kata}
            </span>
            <span className="text-angka">{it.count}</span>
            {it.caption && <span className="text-small text-tinta-muted">{it.caption}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** The four states of every part of the board. `offline` is a failed load without signal; `error` is an answer that was no. */
export type SectionState = 'loading' | 'ready' | 'empty' | 'error' | 'offline';

export interface BoardSectionProps {
  /** The section's own name; it is the h2 and the region's label. */
  title: string;
  /** Small line next to the title ("6 sesi", "Peringatan dini dari pola kehadiran"). */
  aside?: ReactNode;
  /** v3: a line under the title ("Diurutkan dari yang paling lama terlewat"). */
  subtitle?: ReactNode;
  /** v3: the list's count as a badge next to the action ("6 sesi"). Lists always say how many. */
  count?: string;
  /** A button or link at the right of the title. */
  action?: ReactNode;
  state: SectionState;
  /** What the empty state says. */
  emptyText?: string;
  onRetry?: () => void;
  children?: ReactNode;
  className?: string;
}

/** One part of the board. A slow or broken part shows its own state and never holds back the others. */
export function BoardSection({ title, aside, subtitle, count, action, state, emptyText, onRetry, children, className }: BoardSectionProps) {
  const id = `sec-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const retry = onRetry && (
    <Button variant="secondary" onClick={onRetry}>
      {t.retry}
    </Button>
  );
  return (
    <section aria-labelledby={id} aria-busy={state === 'loading'} className={cx('card-surface box-border flex min-w-0 flex-col gap-4 rounded-kartu border border-transparent bg-kapur-raised p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id={id} className="m-0 text-judul-kartu text-tinta">
              {title}
            </h2>
            {aside && <span className="text-small text-tinta-muted">{aside}</span>}
          </div>
          {subtitle && <p className="m-0 text-small text-tinta-muted">{subtitle}</p>}
        </div>
        {(count || (state === 'ready' && action)) && (
          <div className="flex shrink-0 items-center gap-2">
            {count && <span className="inline-flex h-6 items-center rounded-full bg-stabilo-soft px-2 text-mini font-bold text-on-stabilo-soft">{count}</span>}
            {state === 'ready' && action}
          </div>
        )}
      </div>
      {state === 'loading' && <SkeletonRows count={2} />}
      {state === 'empty' && <EmptyState bare title={emptyText ?? ''} headingLevel="h3" />}
      {state === 'error' && (
        <ErrorState title={t.loadFailed.replace('{title}', title)} onRetry={onRetry} headingLevel="h3">
          {t.loadFailedBody}
        </ErrorState>
      )}
      {state === 'offline' && (
        <Banner kind="offline" action={retry}>
          {t.offlineBody}
        </Banner>
      )}
      {state === 'ready' && children}
    </section>
  );
}

export interface AlertRowProps {
  code: Exclude<StatusCode, '?'>;
  /** "Fajar Nugroho · XI-6" */
  title: string;
  /** "Alpa 3 hari berturut-turut" */
  detail: string;
  /** Buttons or a link at the right. */
  actions?: ReactNode;
}

/** A line of "Perlu perhatian" or "Izin menunggu": the status letter, who and why, and what can be done. */
export function AlertRow({ code, title, detail, actions }: AlertRowProps) {
  const { huruf, kata } = statusTokens(code);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-garis bg-kapur px-3 py-3">
      <span role="img" aria-label={kata} className={cx('inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-body-strong font-bold', STATUS_LOOK[code].chip)}>
        {huruf}
      </span>
      <span className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="text-body-strong">{title}</span>
        <span className="text-small text-tinta-muted">{detail}</span>
      </span>
      {actions && <span className="flex shrink-0 gap-2">{actions}</span>}
    </li>
  );
}

export interface BarItem {
  key: string;
  label: string;
  /** 0..1 as the API gives it; null = nothing recorded, an empty bar and never a full one. */
  value: number | null;
  /** The number beside the bar, already written ("95%"). */
  text: string;
  /** "A 2": a word or letter that marks the row without colour. */
  flag?: string;
  /** Spoken name of the bar, e.g. "X-4: 96% hadir". */
  name: string;
}

/** A list of horizontal bars (rombel today, the last school days). The bar is decoration: the number and the flag say it. */
export function BarList({ items, label, columns = 3, dense = false }: { items: readonly BarItem[]; label: string; columns?: 1 | 3; dense?: boolean }) {
  return (
    <ul aria-label={label} className={cx('m-0 grid list-none grid-cols-1 p-0', dense ? 'gap-1' : 'gap-2', columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map((b) => (
        <li key={b.key} className={cx('flex items-center gap-3 rounded-md border px-3', dense ? 'py-1' : 'py-2', b.flag ? 'border-alpa-soft bg-alpa-soft' : 'border-garis bg-kapur')}>
          <span className="w-20 shrink-0 truncate text-body-strong">{b.label}</span>
          <span role="img" aria-label={b.name} className="block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-garis">
            <span className="block h-full rounded-full bg-papan" style={{ width: `${b.value === null ? 0 : Math.round(Math.max(0, Math.min(1, b.value)) * 100)}%` }} />
          </span>
          <span className="shrink-0 text-small tabular-nums">{b.text}</span>
          {b.flag && <span className="shrink-0 text-small font-bold text-alpa">{b.flag}</span>}
        </li>
      ))}
    </ul>
  );
}
