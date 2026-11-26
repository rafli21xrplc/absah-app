'use client';

import { useState } from 'react';
import { BarChart3, CalendarDays, ClipboardCheck, FileText, MessageCircle, NotebookPen, ScanLine, Users, Pause, Play, type LucideIcon } from 'lucide-react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';

/** The Absah mark: a tick on a rounded square, with a yellow dot (the one highlight). */
export function BrandMark({ size = 40, tone = 'papan', className }: { size?: number; tone?: 'papan' | 'on-papan'; className?: string }) {
  const onPapan = tone === 'on-papan';
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 64 64" className={cx('shrink-0', className)}>
      <rect width="64" height="64" rx="16" className={onPapan ? 'fill-on-papan' : 'fill-papan'} />
      <path d="M17 34 L28 45 L47 22" fill="none" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className={onPapan ? 'stroke-papan' : 'stroke-on-papan'} />
      <circle cx="47" cy="14" r="6" className="fill-stabilo" />
    </svg>
  );
}

/** Logo and name together. */
export function BrandName({ tone = 'papan', className }: { tone?: 'papan' | 'on-papan'; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-3', className)}>
      <BrandMark tone={tone} />
      <span className={cx('text-h2 font-bold', tone === 'on-papan' ? 'text-on-papan' : 'text-tinta')}>{messages.auth.brand}</span>
    </span>
  );
}

// Eight parts of Absah around the mark, clockwise from the top left. Positions are % of the square diagram: corners and the
// middles of the sides. Corners are white tiles, middles are green tiles, like a hub with its spokes.
const RING = [10, 50, 90] as const;
const SPOTS: { x: number; y: number }[] = [
  { x: RING[0], y: RING[0] },
  { x: RING[1], y: RING[0] },
  { x: RING[2], y: RING[0] },
  { x: RING[2], y: RING[1] },
  { x: RING[2], y: RING[2] },
  { x: RING[1], y: RING[2] },
  { x: RING[0], y: RING[2] },
  { x: RING[0], y: RING[1] },
];
const ICONS: LucideIcon[] = [ScanLine, ClipboardCheck, MessageCircle, FileText, BarChart3, Users, CalendarDays, NotebookPen];

/** Dotted lines of the diagram: the outer square, the cross and the diagonals, all through the centre. Decoration. */
function Lines() {
  const [a, m, b] = RING;
  const segments = [
    [a, a, b, a],
    [b, a, b, b],
    [b, b, a, b],
    [a, b, a, a],
    [m, a, m, b],
    [a, m, b, m],
    [a, a, b, b],
    [b, a, a, b],
  ];
  return (
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
      {segments.map(([x1, y1, x2, y2]) => (
        <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" strokeWidth="1.25" strokeDasharray="2 5" strokeLinecap="round" className="auth-line stroke-garis-kuat opacity-60" />
      ))}
    </svg>
  );
}

/**
 * The panel beside the form on wide screens (MA1, MA2): a card on a dot grid, a short line about Absah and a diagram of what it
 * connects. The diagram builds itself once, then the dashes flow and each part pings in turn (base.css auth-*). That loop is
 * longer than 5 s, so a pause button sits at the foot (hidden with reduced motion, when nothing moves). The parts are a real
 * list with their names, so a screen reader hears them too.
 */
export function BrandPanel({ className }: { className?: string }) {
  const t = messages.auth;
  const [paused, setPaused] = useState(false);
  const label = paused ? t.playPanel : t.pausePanel;
  return (
    <aside
      aria-label={t.aboutLabel}
      className={cx('auth-dots relative box-border flex-col items-center justify-center gap-12 rounded-lg border border-garis bg-kapur p-12', paused && 'auth-paused', className)}
    >
      <div className="flex max-w-110 flex-col items-center gap-3 text-center">
        <h2 className="m-0 text-h1 text-tinta">{t.headline}</h2>
        <p className="m-0 text-body text-tinta-muted">{t.headlineBody}</p>
      </div>
      <div className="relative aspect-square w-full max-w-100">
        <Lines />
        <ul aria-label={t.connectLabel} className="m-0 list-none p-0">
          {t.connect.map((label, i) => {
            const Icon = ICONS[i] ?? ScanLine;
            const spot = SPOTS[i] ?? { x: 50, y: 50 };
            const middle = spot.x === 50 || spot.y === 50;
            return (
              <li key={label} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
                <span
                  aria-hidden
                  style={{ ['--n' as string]: i }}
                  className={cx(
                    'auth-node card-surface relative flex size-13 items-center justify-center rounded-md border',
                    middle ? 'border-papan bg-papan text-on-papan' : 'border-garis bg-kapur-raised text-papan',
                  )}
                >
                  <Icon strokeWidth={1.75} className="size-6" />
                </span>
                <span className="whitespace-nowrap rounded-sm bg-kapur px-1 text-small text-tinta-muted">{label}</span>
              </li>
            );
          })}
        </ul>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="auth-hub card-surface flex size-22 items-center justify-center rounded-lg border border-garis bg-kapur-raised">
            <BrandMark size={56} />
          </span>
        </span>
      </div>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setPaused((p) => !p)}
        className="auth-pause absolute bottom-4 left-1/2 inline-flex size-10 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-garis bg-kapur-raised text-tinta-muted hover:border-garis-kuat hover:text-tinta"
      >
        {paused ? <Play aria-hidden strokeWidth={1.75} className="size-4" /> : <Pause aria-hidden strokeWidth={1.75} className="size-4" />}
      </button>
    </aside>
  );
}
