'use client';

import { LoaderCircle, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { Skeleton } from './skeleton';

/** What is coming, so the placeholder has its shape and nothing jumps when it arrives. */
export type LoadingVariant = 'rows' | 'table' | 'cards' | 'detail';

export interface LoadingStateProps {
  variant?: LoadingVariant;
  /** Spoken to screen readers: what is loading, e.g. "Memuat jurnal". Default "Sedang memuat". */
  label?: string;
  /** Rows of a list or table. */
  count?: number;
  className?: string;
}

/** Fast answers never flash a placeholder; slow ones say so, and a stuck one offers Muat ulang. */
const SHOW_AFTER_MS = 200;
const SLOW_AFTER_MS = 8_000;
const STUCK_AFTER_MS = 20_000;

type Phase = 'wait' | 'show' | 'slow' | 'stuck';

function usePhase(): Phase {
  const [phase, setPhase] = useState<Phase>('wait');
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('show'), SHOW_AFTER_MS),
      setTimeout(() => setPhase('slow'), SLOW_AFTER_MS),
      setTimeout(() => setPhase('stuck'), STUCK_AFTER_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  return phase;
}

const box = 'rounded-lg border border-garis bg-kapur-raised';

function Rows({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cx(box, 'flex min-h-16 items-center gap-3 rounded-md px-3 py-2')}>
          <Skeleton shape="circle" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className={i % 2 ? 'w-1/2' : 'w-2/3'} />
            <Skeleton className="w-1/3" />
          </div>
          <Skeleton shape="block" />
        </div>
      ))}
    </div>
  );
}

function Table({ count }: { count: number }) {
  return (
    <div className={cx(box, 'overflow-hidden')}>
      <div className="flex gap-4 border-b border-garis bg-latar-app px-4 py-3">
        <Skeleton className="w-32" />
        <Skeleton className="ml-auto w-16" />
        <Skeleton className="w-16" />
        <Skeleton className="hidden w-16 sm:block" />
      </div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-garis px-4 py-3 last:border-b-0">
          <Skeleton className={i % 3 === 1 ? 'w-40' : 'w-52 max-w-1/2'} />
          <Skeleton className="ml-auto w-10" />
          <Skeleton className="w-10" />
          <Skeleton className="hidden w-10 sm:block" />
        </div>
      ))}
    </div>
  );
}

function Cards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cx(box, 'flex flex-col gap-3 p-4')}>
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="w-24" />
          </div>
          <Skeleton className="h-7 w-16" />
          <Skeleton className="w-32" />
        </div>
      ))}
    </div>
  );
}

function Detail() {
  return (
    <div className={cx(box, 'flex flex-col gap-4 p-5')}>
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="w-20" />
            <Skeleton className="w-40 max-w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="w-3/4" />
    </div>
  );
}

/**
 * The "memuat" state of a part of a page (V13), instead of a bare "Memuat…": a placeholder shaped like what is coming,
 * announced once to screen readers. Under 200 ms nothing shows (no flash); after 8 s it says the connection seems slow,
 * after 20 s it offers Muat ulang. For a whole page use LoadingPage (loading.tsx).
 */
export function LoadingState({ variant = 'rows', label = messages.skeleton.label, count = 4, className }: LoadingStateProps) {
  const phase = usePhase();
  const slow = phase === 'slow' || phase === 'stuck';
  return (
    <div role="status" aria-live="polite" aria-busy className={cx('flex flex-col gap-3', className)}>
      <span className="sr-only">{label}</span>
      {phase !== 'wait' && (
        <div aria-hidden className="flex flex-col gap-3 motion-card-in">
          {variant === 'rows' && <Rows count={count} />}
          {variant === 'table' && <Table count={count} />}
          {variant === 'cards' && <Cards />}
          {variant === 'detail' && <Detail />}
        </div>
      )}
      {slow && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-telat-soft px-3 py-2 text-small text-tinta">
          <LoaderCircle aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-telat motion-spin" />
          <span className="min-w-0 flex-1">{phase === 'stuck' ? messages.loadingState.stuck : messages.loadingState.slow}</span>
          {phase === 'stuck' && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-garis-kuat bg-kapur-raised px-3 text-small font-semibold text-tinta hover:bg-papan-soft"
            >
              <RotateCw aria-hidden strokeWidth={1.75} className="size-4" />
              {messages.loadingState.reload}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** First paint of the signed-in app while /me/context answers: the brand and a calm spinner, centred. */
export function AppLoading() {
  const phase = usePhase();
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-latar-app px-6 text-center text-tinta">
      <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-lg bg-papan-soft text-papan">
        <LoaderCircle strokeWidth={1.75} className="size-7 motion-spin" />
      </span>
      <p className="m-0 text-body-strong">{messages.loadingState.app}</p>
      {(phase === 'slow' || phase === 'stuck') && (
        <p className="m-0 max-w-sm text-small text-tinta-muted">{phase === 'stuck' ? messages.loadingState.stuck : messages.loadingState.slow}</p>
      )}
      {phase === 'stuck' && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-garis-kuat bg-kapur-raised px-4 text-isi font-semibold text-tinta hover:bg-papan-soft"
        >
          <RotateCw aria-hidden strokeWidth={1.75} className="size-4" />
          {messages.loadingState.reload}
        </button>
      )}
    </div>
  );
}
