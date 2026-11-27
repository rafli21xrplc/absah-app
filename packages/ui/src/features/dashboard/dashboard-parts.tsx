'use client';

import { ChevronLeft, ChevronRight, Search, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';

/**
 * Building blocks of the CMS pages after PG1 (dashboard, presensi, izin, kegiatan), after the user's reference: a stat card with a
 * coloured band, stacked bars, a table card with its own search and filter, pagination. Colour never carries meaning alone: every
 * band and badge has a word and usually an icon.
 */

export type Tone = 'hadir' | 'telat' | 'izin' | 'sakit' | 'alpa' | 'papan' | 'netral';

/** Soft background + strong text of the same family: every pair passes AA in both themes (tokens.test.ts). */
const BAND: Record<Tone, string> = {
  hadir: 'bg-hadir-soft text-hadir',
  telat: 'bg-telat-soft text-telat',
  izin: 'bg-izin-soft text-izin',
  sakit: 'bg-sakit-soft text-sakit',
  alpa: 'bg-alpa-soft text-alpa',
  papan: 'bg-papan-soft text-papan',
  netral: 'bg-kapur text-tinta',
};

/** The strong fill of each tone, for meters and composition bars. */
export const FILL: Record<Tone, string> = {
  hadir: 'bg-hadir',
  telat: 'bg-telat',
  izin: 'bg-izin',
  sakit: 'bg-sakit',
  alpa: 'bg-alpa',
  papan: 'bg-papan',
  netral: 'bg-garis-kuat',
};

export interface StatPart {
  value: ReactNode;
  label: string;
}

export interface StatCardProps {
  title: string;
  tone: Tone;
  icon?: LucideIcon;
  value: ReactNode;
  /** A word after the number, e.g. "siswa". */
  unit?: string;
  /** "+4 dibanding kemarin": a small chip in the header. */
  delta?: { text: string; label: string };
  /** The split under the number: "611 tepat waktu · 114 telat". */
  parts?: StatPart[];
  /** One short line at the foot, e.g. "2 menunggu persetujuan". */
  note?: ReactNode;
  /** A thin bar under the number (0..1); null = nothing recorded, an empty bar. */
  meter?: number | null;
  className?: string;
}

/**
 * A compact number card (PG2): icon chip and title on one line, the number with its unit, an optional thin meter, then one line of
 * split or note. About 120 px high, so five fit in a row on a laptop.
 */
export function StatCard({ title, tone, icon: Icon, value, unit, delta, parts, note, meter, className }: StatCardProps) {
  return (
    <section aria-label={title} className={cx('card-surface flex min-w-0 flex-col gap-2 rounded-lg border border-garis bg-kapur-raised p-4 text-tinta', className)}>
      <header className="flex items-center gap-2">
        {Icon && (
          <span aria-hidden className={cx('inline-flex size-8 shrink-0 items-center justify-center rounded-md', BAND[tone])}>
            <Icon strokeWidth={1.75} className="size-4" />
          </span>
        )}
        <h2 className="m-0 min-w-0 flex-1 truncate text-small font-semibold text-tinta-muted">{title}</h2>
        {delta && (
          <span title={delta.label} className="shrink-0 rounded-sm bg-papan-soft px-2 text-small font-bold tabular-nums text-papan">
            {delta.text}
            <span className="sr-only"> {delta.label}</span>
          </span>
        )}
      </header>
      <p className="m-0 flex items-baseline gap-2">
        <span className="text-h1 tabular-nums">{value}</span>
        {unit && <span className="text-small text-tinta-muted">{unit}</span>}
      </p>
      {meter !== undefined && (
        <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-kapur">
          <span className={cx('block h-full rounded-full', FILL[tone])} style={{ width: `${meter === null ? 0 : Math.round(Math.max(0, Math.min(1, meter)) * 100)}%` }} />
        </span>
      )}
      {parts && parts.length > 0 && (
        <dl className="m-0 mt-auto flex flex-wrap gap-x-3 gap-y-1 text-small">
          {parts.map((p) => (
            <div key={p.label} className="flex items-baseline gap-1">
              <dt className="sr-only">{p.label}</dt>
              <dd className="m-0 font-bold tabular-nums">{p.value}</dd>
              <span aria-hidden className="text-tinta-muted">
                {p.label}
              </span>
            </div>
          ))}
        </dl>
      )}
      {note && <p className="m-0 mt-auto truncate text-small text-tinta-muted">{note}</p>}
    </section>
  );
}

export interface CompositionItem {
  key: string;
  /** The letter of the status (H, T, ...), shown with the word so the colour never carries it alone. */
  code?: string;
  label: string;
  value: number;
  tone: Tone;
}

/**
 * One bar split into the parts of a whole (today's H/T/I/S/A), with a legend that says count and share in words. The bar is
 * decoration; the legend is the content.
 */
export function CompositionBar({ label, items }: { label: string; items: CompositionItem[] }) {
  const total = items.reduce((n, i) => n + i.value, 0);
  const share = (v: number) => (total > 0 ? `${Math.round((v / total) * 1000) / 10}%`.replace('.', ',') : '–');
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex h-3 gap-1 overflow-hidden rounded-full bg-kapur">
        {total > 0 && items.filter((i) => i.value > 0).map((i) => <span key={i.key} className={cx('block h-full', FILL[i.tone])} style={{ width: `${(i.value / total) * 100}%` }} />)}
      </div>
      <dl aria-label={label} className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-5">
        {items.map((i) => (
          <div key={i.key} className="flex min-w-0 flex-col">
            <dt className="flex items-center gap-2 text-small text-tinta-muted">
              <span aria-hidden className={cx('size-3 shrink-0 rounded-full', FILL[i.tone])} />
              {i.code && <span className="font-bold text-tinta">{i.code}</span>}
              <span className="truncate">{i.label}</span>
            </dt>
            <dd className="m-0 flex items-baseline gap-2">
              <span className="text-h2 tabular-nums">{i.value}</span>
              <span className="text-small text-tinta-muted">{share(i.value)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** One row of a "Perlu tindakan" list: icon, what it is, a count, and the page's own link as the action. */
export function TaskRow({ tone, icon: Icon, title, detail, count, action }: { tone: Tone; icon: LucideIcon; title: string; detail?: string; count: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-b border-garis py-2 last:border-b-0">
      <span aria-hidden className={cx('inline-flex size-9 shrink-0 items-center justify-center rounded-md', BAND[tone])}>
        <Icon strokeWidth={1.75} className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-strong">{title}</span>
        {detail && <span className="truncate text-small text-tinta-muted">{detail}</span>}
      </span>
      <span className="shrink-0 text-h2 tabular-nums">{count}</span>
      {action}
    </li>
  );
}

export interface BarSegment {
  value: number;
  /** Tailwind background class from the token set, e.g. bg-papan. */
  fill: string;
  label: string;
}

export interface StackedBar {
  key: string;
  label: string;
  segments: BarSegment[];
}

/**
 * Stacked bars, each bar the share of its own total (100% tall when there is data). A table with the same numbers sits under it for
 * screen readers, so the picture never has to be read.
 */
export function StackedBars({ title, bars, legend, compact = false }: { title: string; bars: StackedBar[]; legend: { label: string; fill: string }[]; compact?: boolean }) {
  return (
    <figure className="m-0 flex flex-col gap-3">
      <ul aria-hidden className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
        {legend.map((l) => (
          <li key={l.label} className="flex items-center gap-2 text-small text-tinta-muted">
            <span className={cx('size-3 rounded-full', l.fill)} />
            {l.label}
          </li>
        ))}
      </ul>
      <div aria-hidden className={cx('flex items-end gap-2', compact ? 'h-24' : 'h-40')}>
        {bars.map((b) => {
          const total = b.segments.reduce((n, s) => n + s.value, 0);
          return (
            <div key={b.key} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex w-full max-w-10 flex-1 flex-col-reverse overflow-hidden rounded-md bg-kapur">
                {total > 0 &&
                  b.segments.map((s) => <span key={s.label} className={cx('block w-full', s.fill)} style={{ height: `${(s.value / total) * 100}%` }} />)}
              </div>
              <span className="truncate text-small text-tinta-muted">{b.label}</span>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{messages.dashboardParts.date}</th>
            {legend.map((l) => (
              <th key={l.label} scope="col">
                {l.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              {b.segments.map((s) => (
                <td key={s.label}>{s.value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** The search box inside a card's header (smaller than the page toolbar's). The label is for screen readers. */
export function SearchBox({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={cx('box-border flex min-h-10 min-w-0 items-center gap-2 rounded-md border border-garis bg-kapur px-3 focus-within:border-papan lg:min-h-9', className)}>
      <Search aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder ?? label}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-tinta placeholder:text-tinta-muted focus-visible:!shadow-none lg:text-isi"
      />
    </label>
  );
}

export interface DataCardProps {
  title: string;
  /** Short text next to the title, e.g. "24 izin". */
  aside?: string;
  /** Search, filters and actions on the right of the title. */
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A white card with a header row (title left, search/filter right), the content, and an optional footer (pagination). */
export function DataCard({ title, aside, toolbar, footer, children, className }: DataCardProps) {
  return (
    <section aria-label={title} className={cx('card-surface flex min-w-0 flex-col gap-3 rounded-lg border border-garis bg-kapur-raised p-4 text-tinta', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="m-0 text-body-strong">{title}</h2>
          {aside && <span className="text-small text-tinta-muted">{aside}</span>}
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </header>
      {children}
      {footer}
    </section>
  );
}

const BADGE: Record<Tone, string> = {
  hadir: 'border-hadir-soft bg-hadir-soft text-hadir',
  telat: 'border-telat-soft bg-telat-soft text-telat',
  izin: 'border-izin-soft bg-izin-soft text-izin',
  sakit: 'border-sakit-soft bg-sakit-soft text-sakit',
  alpa: 'border-alpa-soft bg-alpa-soft text-alpa',
  papan: 'border-papan bg-papan text-on-papan',
  netral: 'border-garis bg-kapur text-tinta-muted',
};

/** A small rounded label with a word (and an icon when the colour would otherwise carry the meaning). */
export function Badge({ tone, icon: Icon, children }: { tone: Tone; icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 text-small font-semibold', BADGE[tone])}>
      {Icon && <Icon aria-hidden strokeWidth={2} className="size-4" />}
      {children}
    </span>
  );
}

/** Splits a list into pages of `size`; the page resets to 1 when the list changes length. */
export function usePaged<T>(items: readonly T[], size = 10) {
  const [state, setState] = useState({ page: 1, length: items.length });
  const page = state.length === items.length ? state.page : 1;
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pageCount);
  const slice = useMemo(() => items.slice((current - 1) * size, current * size), [items, current, size]);
  return { page: current, pageCount, slice, total: items.length, setPage: (p: number) => setState({ page: p, length: items.length }) };
}

/** "1–10 dari 24" and the page buttons, as in the reference's table footer. */
export function Pagination({ page, pageCount, total, size, onPage }: { page: number; pageCount: number; total: number; size: number; onPage: (p: number) => void }) {
  const t = messages.dashboardParts;
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const pages = pageList(page, pageCount);
  const btn = 'inline-flex size-9 cursor-pointer items-center justify-center rounded-kontrol border text-isi-strong tabular-nums disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav aria-label={t.pages} className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
      <p className="m-0 text-small text-tinta-muted">{t.range.replace('{from}', String(from)).replace('{to}', String(to)).replace('{total}', String(total))}</p>
      {pageCount > 1 && (
        <ul className="m-0 flex list-none items-center gap-1 p-0">
          <li>
            <button type="button" aria-label={t.previous} disabled={page === 1} onClick={() => onPage(page - 1)} className={cx(btn, 'border-batas-lembut bg-kapur-raised text-tinta')}>
              <ChevronLeft aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
          </li>
          {pages.map((p, i) =>
            p === null ? (
              <li key={`gap-${i}`} aria-hidden className="px-1 text-small text-tinta-muted">
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  aria-current={p === page ? 'page' : undefined}
                  aria-label={t.page.replace('{n}', String(p))}
                  onClick={() => onPage(p)}
                  className={cx(btn, p === page ? 'border-papan bg-papan text-on-papan' : 'border-batas-lembut bg-kapur-raised text-tinta hover:border-garis-kuat')}
                >
                  {p}
                </button>
              </li>
            ),
          )}
          <li>
            <button type="button" aria-label={t.next} disabled={page === pageCount} onClick={() => onPage(page + 1)} className={cx(btn, 'border-batas-lembut bg-kapur-raised text-tinta')}>
              <ChevronRight aria-hidden strokeWidth={1.75} className="size-4" />
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
}

/** 1 … 4 5 6 … 11: first, last and the neighbours of the current page. Exported for the test. */
export function pageList(page: number, count: number): (number | null)[] {
  const keep = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const out: (number | null)[] = [];
  let last = 0;
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (p - last > 1) out.push(null);
    out.push(p);
    last = p;
  }
  return out;
}

/** A person in a table cell: initials circle, name, and a second line (class, role). */
export function PersonCell({ name, detail }: { name: string; detail?: string }) {
  const initial = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-papan-soft text-small font-bold text-papan">
        {initial || '?'}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body-strong">{name}</span>
        {detail && <span className="truncate text-small text-tinta-muted">{detail}</span>}
      </span>
    </span>
  );
}

export interface CountRow {
  key: string;
  label: string;
  detail?: string;
  value: number;
  /** Written next to the bar ("12 izin"); defaults to the number. */
  text?: string;
  /** When set, the bar is value / of (20 of 36 filled) instead of a share of the largest row. */
  of?: number;
}

/**
 * A short ranked list with a thin bar per row, scaled to the largest value (per rombel, per jam, per hari). Rows are 36 px; the
 * numbers are text, the bars decoration.
 */
export function CountList({ label, rows, tone = 'papan', max }: { label: string; rows: CountRow[]; tone?: Tone; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col p-0">
      {rows.map((r) => (
        <li key={r.key} className="flex min-h-9 items-center gap-3 border-b border-garis py-1 last:border-b-0">
          <span className="flex w-20 min-w-0 shrink-0 flex-col">
            <span className="truncate text-small font-semibold">{r.label}</span>
            {r.detail && <span className="truncate text-small text-tinta-muted">{r.detail}</span>}
          </span>
          <span aria-hidden className="block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-kapur">
            <span className={cx('block h-full rounded-full', FILL[tone])} style={{ width: `${Math.round((r.value / (r.of && r.of > 0 ? r.of : top)) * 100)}%` }} />
          </span>
          <span className="min-w-12 shrink-0 whitespace-nowrap text-right text-small font-bold tabular-nums">{r.text ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}
