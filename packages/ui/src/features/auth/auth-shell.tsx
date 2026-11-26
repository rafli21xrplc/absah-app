import type { ReactNode } from 'react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';
import { BrandMark, BrandPanel } from './brand';

export interface AuthShellProps {
  children: ReactNode;
  /** Show the panel beside the form on wide screens. */
  panel?: boolean;
  /** A short line at the foot of the form column, e.g. "Akun dibuat oleh admin sekolah Anda." */
  footer?: ReactNode;
  className?: string;
}

/**
 * The frame of every page before sign-in (MA1). On 1024 px and up: the form on the left half, centred, with the logo above it;
 * the panel on the right half as a card with a margin around it. On a phone: one column, no panel. The form is the page's <main>.
 */
export function AuthShell({ children, panel = true, footer, className }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh bg-kapur-raised text-tinta">
      <nav aria-label={messages.appShell.shortcuts}>
        <a href="#isi-masuk" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-kapur-raised focus:px-4 focus:py-3 focus:font-bold">
          {messages.auth.skip}
        </a>
      </nav>
      <main id="isi-masuk" className="auth-sheen box-border flex min-w-0 flex-1 flex-col items-center px-4 py-8 lg:px-8">
        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <div className={cx('motion-card-in flex w-full max-w-100 flex-col gap-6', className)}>
            <span className="card-surface mx-auto flex size-14 items-center justify-center rounded-lg border border-garis bg-kapur-raised">
              <BrandMark size={36} />
            </span>
            {children}
          </div>
        </div>
        {footer && <p className="m-0 pt-8 text-center text-small text-tinta-muted">{footer}</p>}
      </main>
      {panel && <BrandPanel className="m-3 hidden flex-1 lg:flex" />}
    </div>
  );
}
