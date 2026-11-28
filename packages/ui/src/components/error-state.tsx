import { TriangleAlert, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';
import { Button } from './button';

export interface ErrorStateProps {
  /** error = it did not work; offline = no signal and nothing is lost (the "tanpa sinyal" state). */
  kind?: 'error' | 'offline';
  /** The state in a few words, e.g. "Presensi belum terkirim". */
  title: string;
  /** What happened and what is safe, in plain words, no codes. */
  children?: ReactNode;
  /** Shows a "Coba lagi" button. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Items waiting to be sent: shows "Menunggu · n". */
  pending?: number;
  /** Heading level of the title, to fit the page outline (h1 when the state is the whole page). */
  headingLevel?: 'h1' | 'h2' | 'h3';
  className?: string;
}

/** The "galat" and "tanpa sinyal" states of a list or form. An error is announced at once, offline politely. */
export function ErrorState({ kind = 'error', title, children, onRetry, retryLabel = messages.errorState.retry, pending, headingLevel: Heading = 'h2', className }: ErrorStateProps) {
  return (
    <section role={kind === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-4 rounded-lg border bg-kapur-raised p-5 text-tinta', kind === 'error' ? 'border-alpa/30' : 'border-garis', className)}>
      <span aria-hidden className={cx('inline-flex size-11 shrink-0 items-center justify-center rounded-lg', kind === 'error' ? 'bg-alpa-soft text-alpa' : 'bg-telat-soft text-telat')}>
        {kind === 'error' ? <TriangleAlert strokeWidth={1.75} className="size-6" /> : <WifiOff strokeWidth={1.75} className="size-6" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <Heading className="m-0 text-body-strong">{title}</Heading>
        {children && <p className="m-0 text-body text-tinta-muted">{children}</p>}
        {pending !== undefined && pending > 0 && (
          <span className="rounded-sm bg-telat-soft px-2 py-1 text-small font-bold text-telat">
            {messages.errorState.pending} · {pending}
          </span>
        )}
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
