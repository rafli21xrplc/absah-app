import type { LucideIcon } from 'lucide-react';
import type { ElementType, ReactNode } from 'react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';
import { DeltaPill, type DeltaPillProps } from '../../components/delta-pill';
import type { StackTone } from '../../components/stack-bar';

const t = messages.v3;

/** 95,8% from 0..1. One decimal at most, id-ID comma. */
export function percentText(rate: number, digits = 1): string {
  return `${(rate * 100).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;
}

const nf = (n: number) => n.toLocaleString('id-ID');

// ---------------------------------------------------------------- StatGroupCard

export type IconTone = 'papan' | 'telat' | 'alpa' | 'izin';
const ICON_TONE: Record<IconTone, string> = {
  papan: 'bg-papan-soft text-papan',
  telat: 'bg-telat-soft text-telat',
  alpa: 'bg-alpa-soft text-alpa',
  izin: 'bg-izin-soft text-izin',
};

const DOT: Record<StackTone, string> = {
  hadir: 'bg-hadir',
  telat: 'bg-telat',
  izin: 'bg-izin',
  sakit: 'bg-sakit',
  alpa: 'bg-alpa',
  papan: 'bg-papan',
  grafik: 'bg-grafik-batang',
  muted: 'bg-garis-kuat',
};

export interface StatTileData {
  label: string;
  value: number | string;
  /** Colour dot before the label; the label is always written. */
  dot?: StackTone;
  delta?: DeltaPillProps;
}

/** A square icon chip as in the board's card headings. Decorative. */
export function IconChip({ icon: Icon, tone = 'papan' }: { icon: LucideIcon; tone?: IconTone }) {
  return (
    <span aria-hidden className={cx('inline-flex size-8 shrink-0 items-center justify-center rounded-md', ICON_TONE[tone])}>
      <Icon strokeWidth={2} className="size-4" />
    </span>
  );
}

export interface StatGroupCardProps {
  title: string;
  icon: LucideIcon;
  iconTone?: IconTone;
  /** Right of the title, e.g. "dibanding kemarin". */
  aside?: string;
  /** Three tiles in a row. */
  stats: StatTileData[];
  /** Under the tiles: a StackBar or ProgressBar (required by the board: never bare numbers). */
  bar?: ReactNode;
  /** One line of context under the bar: left and right. */
  footer?: ReactNode;
  footerEnd?: ReactNode;
  /** The card's lower slot (histogram, worst rombel). */
  children?: ReactNode;
  className?: string;
}

/** v3 group card: heading, three tiles (label, 30 px number, delta), a proportion bar and a line of context. */
export function StatGroupCard({ title, icon, iconTone = 'papan', aside, stats, bar, footer, footerEnd, children, className }: StatGroupCardProps) {
  const id = `stat-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className={cx('card-surface box-border flex min-w-0 flex-col gap-4 rounded-kartu border border-transparent bg-kapur-raised p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <IconChip icon={icon} tone={iconTone} />
          <h2 id={id} className="m-0 truncate text-judul-kartu text-tinta">
            {title}
          </h2>
        </div>
        {aside && <span className="shrink-0 text-mini text-tinta-muted">{aside}</span>}
      </div>
      <dl className="m-0 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-1 rounded-ubin bg-ubin p-3">
            <dt className="flex min-w-0 items-center gap-1 text-mini text-tinta-muted">
              {s.dot && <span aria-hidden className={cx('size-2 shrink-0 rounded-full', DOT[s.dot])} />}
              <span className="truncate">{s.label}</span>
            </dt>
            <dd className="m-0 flex flex-col items-start gap-1">
              <span className="text-angka-ubin tabular-nums text-tinta">{typeof s.value === 'number' ? nf(s.value) : s.value}</span>
              {s.delta && <DeltaPill {...s.delta} />}
            </dd>
          </div>
        ))}
      </dl>
      {bar}
      {(footer || footerEnd) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-small text-tinta-muted">
          <span>{footer}</span>
          {footerEnd && <span>{footerEnd}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- HeroRingCard

export interface HeroRingCardProps {
  title: string;
  /** Badge at the top right, e.g. "900 siswa aktif". */
  badge?: string;
  /** 0..1. */
  rate: number;
  /** The big number beside the ring ("862") and the lines under it. */
  value: string;
  lines: ReactNode[];
  /** Present rate per school day, oldest first (0..1): the sparkline. Two points or more, or none is drawn. */
  spark?: number[];
  sparkLabel?: string;
  /** 0..1; drawn only when the school has one. */
  target?: number;
  /** A note under the chart, e.g. "0,8 poin di atas target sekolah". */
  note?: ReactNode;
  /** Shares of the day under the ring (label, value), pinned to the bottom of the card. */
  parts?: { label: string; value: string }[];
}

const RING = 2 * Math.PI * 44;

/** One per page: the dark hero with the attendance ring. The ring is role="img" with the value in words. */
export function HeroRingCard({ title, badge, rate, value, lines, spark, sparkLabel, target, note, parts }: HeroRingCardProps) {
  const clamped = Math.min(Math.max(rate, 0), 1);
  const pct = percentText(clamped);
  const id = `hero-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="box-border flex min-w-0 flex-col gap-4 rounded-kartu bg-papan-hero p-5 text-on-papan-hero shadow-hero">
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="m-0 text-judul-kartu">
          {title}
        </h2>
        {badge && <span className="rounded-full bg-on-papan-hero/10 px-2 py-1 text-mini font-semibold">{badge}</span>}
      </div>
      <div className="flex items-center gap-5">
        <svg role="img" aria-label={`${t.ring} ${pct}`} viewBox="0 0 100 100" className="size-30 shrink-0">
          <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" className="stroke-on-papan-hero/15" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${clamped * RING} ${RING}`}
            transform="rotate(-90 50 50)"
            className="stroke-grafik-batang"
          />
          <text x="50" y="50" textAnchor="middle" className="fill-on-papan-hero text-h2 font-bold">
            {pct}
          </text>
          <text x="50" y="66" textAnchor="middle" className="fill-papan-hero-muted text-sumbu">
            {t.present}
          </text>
        </svg>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-angka-hero tabular-nums">{value}</span>
          {lines.map((l, i) => (
            <span key={i} className="text-small text-papan-hero-muted">
              {l}
            </span>
          ))}
        </div>
      </div>
      {spark && spark.length >= 2 && <Sparkline values={spark} label={sparkLabel ?? t.trend} {...(target === undefined ? {} : { target })} />}
      {parts && parts.length > 0 && (
        <dl className="m-0 mt-auto grid grid-cols-3 gap-2">
          {parts.map((p) => (
            <div key={p.label} className="flex flex-col gap-1 rounded-ubin bg-on-papan-hero/10 px-3 py-2">
              <dt className="text-mini text-papan-hero-muted">{p.label}</dt>
              <dd className="m-0 text-isi-strong tabular-nums">{p.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {note && <p className="m-0 rounded-ubin bg-on-papan-hero/10 px-3 py-2 text-small font-semibold">{note}</p>}
    </section>
  );
}

function Sparkline({ values, label, target }: { values: number[]; label: string; target?: number }) {
  const all = target === undefined ? values : [...values, target];
  const lo = Math.min(...all) - 0.01;
  const hi = Math.max(...all) + 0.01;
  const x = (i: number) => (i / (values.length - 1)) * 280;
  const y = (v: number) => 36 - ((v - lo) / (hi - lo)) * 32;
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values[values.length - 1] ?? 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-mini text-papan-hero-muted">
        <span>{label}</span>
        {target !== undefined && <span>{`${t.target} ${percentText(target)}`}</span>}
      </div>
      <svg role="img" aria-label={`${label}: ${values.map((v) => percentText(v)).join(', ')}`} viewBox="0 0 280 40" preserveAspectRatio="none" className="h-10 w-full">
        <path d={`${line} L280,40 L0,40 Z`} className="fill-on-papan-hero/10" />
        <path d={line} fill="none" strokeWidth="1.5" className="stroke-on-papan-hero/70" vectorEffect="non-scaling-stroke" />
        {target !== undefined && <line x1="0" x2="280" y1={y(target)} y2={y(target)} strokeDasharray="3 3" className="stroke-on-papan-hero/40" vectorEffect="non-scaling-stroke" />}
        <circle cx={x(values.length - 1)} cy={y(last)} r="3" className="fill-stabilo" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- TrendBarChart

export interface TrendPoint {
  /** Axis label, e.g. "25". */
  label: string;
  /** Full label for the bar's title, e.g. "Senin, 25 Januari 2027". */
  title: string;
  /** 0..1, or null when that day has no record. */
  value: number | null;
}

export interface TrendBarChartProps {
  data: TrendPoint[];
  /** Index of today: the dark bar with its value on top. Default: the last one. */
  todayIndex?: number;
  /** 0..1; dashed, labelled line. Only when the school has a target. */
  target?: number;
  /** Lower end of the y axis (0..1). Default 0.9: this axis is only for attendance rates and is always labelled. */
  min?: number;
  /** Month under the first label, e.g. "Januari 2027". */
  caption?: string;
}

/** The text summary every chart must carry: highest, lowest (with their day) and mean of the days with a value. */
type Valued = TrendPoint & { value: number };

export function trendSummary(data: TrendPoint[]): { high: Valued; low: Valued; mean: number } | null {
  const days = data.filter((d): d is Valued => d.value !== null);
  if (days.length === 0) return null;
  const high = days.reduce((a, b) => (b.value > a.value ? b : a));
  const low = days.reduce((a, b) => (b.value < a.value ? b : a));
  return { high, low, mean: days.reduce((s, d) => s + d.value, 0) / days.length };
}

/** Hand-made SVG bar chart of the attendance rate per school day, with axis labels, target line, <title> per bar and a summary. */
export function TrendBarChart({ data, todayIndex = data.length - 1, target, min = 0.9, caption }: TrendBarChartProps) {
  const W = 620;
  const H = 220;
  const left = 40;
  const bottom = 26;
  const top = 26;
  const plotH = H - bottom - top;
  const step = (W - left) / Math.max(data.length, 1);
  const barW = Math.min(26, step * 0.62);
  const y = (v: number) => top + plotH - ((Math.min(Math.max(v, min), 1) - min) / (1 - min)) * plotH;
  const ticks = [min, (min + 1) / 2, 1];
  const summary = trendSummary(data);
  return (
    <figure className="m-0 flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="group" aria-label={t.trendChart}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={left} x2={W} y1={y(v)} y2={y(v)} className="stroke-hairline" strokeWidth="1" />
            <text x={left - 8} y={y(v) + 4} textAnchor="end" className="fill-tinta-muted text-sumbu">
              {percentText(v, 0)}
            </text>
          </g>
        ))}
        {target !== undefined && (
          <line x1={left} x2={W} y1={y(target)} y2={y(target)} strokeDasharray="5 4" strokeWidth="1.5" className="stroke-grafik-target">
            <title>{`${t.target} ${percentText(target)}`}</title>
          </line>
        )}
        {data.map((d, i) => {
          const mid = left + step * i + step / 2;
          const today = i === todayIndex;
          return (
            <g key={`${d.label}-${i}`}>
              {d.value !== null && (
                <rect x={mid - barW / 2} y={y(d.value)} width={barW} height={top + plotH - y(d.value)} rx="5" className={today ? 'fill-papan' : 'fill-grafik-batang'}>
                  <title>{`${d.title}: ${percentText(d.value)}`}</title>
                </rect>
              )}
              {today && d.value !== null && (
                <g>
                  <rect x={mid - 22} y={y(d.value) - 24} width="44" height="20" rx="6" className="fill-papan-hero" />
                  <text x={mid} y={y(d.value) - 10} textAnchor="middle" className="fill-on-papan-hero text-sumbu font-bold">
                    {(d.value * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                  </text>
                </g>
              )}
              <text x={mid} y={H - 8} textAnchor="middle" className={cx('text-sumbu', today ? 'fill-tinta font-bold' : 'fill-tinta-muted')}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      {caption && <span className="-mt-2 pl-10 text-mini text-tinta-muted">{caption}</span>}
      {summary && (
        <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-small text-tinta-muted">
          <span>
            {t.highest} <strong className="text-tinta">{percentText(summary.high.value)}</strong> ({summary.high.title})
          </span>
          <span>
            {t.lowest} <strong className="text-tinta">{percentText(summary.low.value)}</strong> ({summary.low.title})
          </span>
          <span>
            {t.mean} <strong className="text-tinta">{percentText(summary.mean)}</strong>
          </span>
          {target !== undefined && <span>{t.targetNote.replace('{n}', percentText(target))}</span>}
        </figcaption>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------- Histogram

export interface HistogramBin {
  label: string;
  count: number;
  /** This bin is after the bell: drawn in the late colour and labelled. */
  late?: boolean;
}

/** Arrivals per time slot: count above each bar, late bins in the late colour and named "telat" in the bar's title. */
export function Histogram({ bins, label, caption }: { bins: HistogramBin[]; label: string; caption?: string }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-small">
        <span className="font-semibold text-tinta">{label}</span>
        {caption && <span className="text-tinta-muted">{caption}</span>}
      </div>
      <ul className="m-0 flex h-28 list-none items-end gap-2 p-0">
        {bins.map((b) => (
          <li key={b.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${b.label}: ${nf(b.count)} ${t.students}${b.late ? `, ${t.late}` : ''}`}>
            <span className="text-mini font-bold tabular-nums text-tinta">{nf(b.count)}</span>
            <span aria-hidden className={cx('w-full max-w-8 rounded-t-md', b.late ? 'bg-telat' : 'bg-papan')} style={{ height: `${Math.max(4, (b.count / max) * 72)}px` }} />
            <span className="text-sumbu text-tinta-muted">{b.label}</span>
            <span className="sr-only">{`${nf(b.count)} ${t.students}${b.late ? `, ${t.late}` : ''}`}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// ---------------------------------------------------------------- ActivityFeed

export interface ActivityItem {
  key: string;
  /** ISO date-time for <time>, and the label shown ("09.42"). */
  at: string;
  timeLabel: string;
  icon: LucideIcon;
  title: string;
  detail?: string;
}

/** Newest first, at most five, a "Lihat semua" link. Each event has its time in a <time> element. */
export function ActivityFeed({ items, moreHref, linkAs }: { items: ActivityItem[]; moreHref?: string; linkAs?: ElementType }) {
  const Link = linkAs ?? 'a';
  const shown = [...items].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  return (
    <div className="flex flex-col gap-3">
      <ol className="m-0 flex list-none flex-col p-0">
        {shown.map((it, i) => (
          <li key={it.key} className="relative flex gap-3 pb-4 last:pb-0">
            {i < shown.length - 1 && <span aria-hidden className="absolute left-4 top-9 bottom-0 w-px bg-hairline" />}
            <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-papan-soft text-papan">
              <it.icon strokeWidth={2} className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-isi-strong text-tinta">{it.title}</span>
                <time dateTime={it.at} className="shrink-0 text-mini tabular-nums text-tinta-muted">
                  {it.timeLabel}
                </time>
              </div>
              {it.detail && <span className="text-small text-tinta-muted">{it.detail}</span>}
            </div>
          </li>
        ))}
      </ol>
      {moreHref && (
        <Link href={moreHref} className="text-small font-semibold text-papan no-underline hover:underline">
          {t.seeAll}
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ListCard rows

export interface ListCardRowProps {
  /** Leading picture (Avatar, IconChip). */
  lead?: ReactNode;
  title: ReactNode;
  /** Chips after the title (rombel, status). */
  tags?: ReactNode;
  detail?: ReactNode;
  /** Right side: time, one action. */
  end?: ReactNode;
  /** A text link under the detail ("Hubungi orang tua"). */
  below?: ReactNode;
}

/** One row of a list card (Perlu perhatian, Izin menunggu): picture, title + chips, detail, and one action at the end. */
export function ListCardRow({ lead, title, tags, detail, end, below }: ListCardRowProps) {
  return (
    <li className="flex items-start gap-3 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0">
      {lead}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-isi-strong text-tinta">{title}</span>
          {tags}
        </div>
        {detail && <span className="text-small text-tinta-muted">{detail}</span>}
        {below}
      </div>
      {end && <div className="flex shrink-0 items-center gap-2 self-center">{end}</div>}
    </li>
  );
}

/** The list of a list card. */
export function ListCardList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-col p-0">
      {children}
    </ul>
  );
}
