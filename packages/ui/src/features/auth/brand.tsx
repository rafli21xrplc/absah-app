'use client';

import { useState } from 'react';
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

const TONE = { hadir: 'bg-hadir', izin: 'bg-izin', telat: 'bg-telat' } as const;

/** A sample of the arrival board: decoration only, so it is hidden from screen readers and labelled "Contoh tampilan". */
function SampleBoard() {
  const t = messages.auth;
  return (
    <section aria-hidden className="flex flex-col gap-4 rounded-lg bg-kapur-raised p-4 text-tinta shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body-strong font-bold">{t.boardTitle}</span>
        <span className="rounded-sm border border-garis bg-kapur px-2 py-0.5 text-small font-semibold text-tinta-muted">{t.boardExample}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="board-count text-display text-papan tabular-nums" />
        <span className="text-body text-tinta-muted">{t.boardRest}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-garis">
        <div className="board-bar h-2 rounded-full bg-papan" />
      </div>
      <div className="flex min-h-48 flex-col gap-2">
        {t.boardEvents.map((e, i) => (
          <div key={e.text} data-n={i + 1} className="board-event flex items-center gap-3 rounded-md border border-garis px-3 py-2">
            <span className={cx('flex size-6 shrink-0 items-center justify-center rounded-sm text-small font-bold text-on-papan', TONE[e.tone])}>{e.letter}</span>
            <span className="min-w-0 flex-1 text-body">{e.text}</span>
            <span className="text-small text-tinta-muted">{e.time}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The green panel beside the form (wide screens only). The sample board loops for 14 seconds, which is longer than the 5 seconds
 * Motion-UI allows without a pause control, so "Jeda animasi" is always here and stays reachable by keyboard.
 */
export function BrandPanel({ className }: { className?: string }) {
  const [paused, setPaused] = useState(false);
  const t = messages.auth;
  return (
    <aside
      aria-label={t.aboutLabel}
      className={cx(
        'flex flex-col justify-between gap-8 bg-papan p-11 text-on-papan lg:px-13',
        paused && 'board-paused',
        className,
      )}
    >
      <BrandName tone="on-papan" />
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="m-0 text-display font-bold">{t.headline}</h2>
          <p className="m-0 max-w-110 text-body">{t.headlineBody}</p>
        </div>
        <SampleBoard />
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-small">{t.footerNote}</span>
        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className="min-h-11 cursor-pointer rounded-md border border-on-papan/60 bg-transparent px-4 text-small font-bold text-on-papan hover:bg-on-papan/10"
        >
          {paused ? messages.motion.resume : messages.motion.pause}
        </button>
      </div>
    </aside>
  );
}
