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
  className?: string;
}

/** The "galat" and "tanpa sinyal" states of a list or form. An error is announced at once, offline politely. */
export function ErrorState({ kind = 'error', title, children, onRetry, retryLabel = messages.errorState.retry, pending, className }: ErrorStateProps) {
  return (
    <section role={kind === 'error' ? 'alert' : 'status'} className={cx('flex flex-col items-start gap-3 rounded-lg border border-garis bg-kapur-raised p-6 text-tinta', className)}>
      <h2 className="m-0 text-body-strong">{title}</h2>
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
    </section>
  );
}
