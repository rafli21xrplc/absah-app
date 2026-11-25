import type { ReactNode } from 'react';
import { messages } from '../../../messages/id';
import { cx } from '../../cx';
import { BrandName, BrandPanel } from './brand';

export interface AuthShellProps {
  children: ReactNode;
  /** Show the green panel beside the form on wide screens. */
  panel?: boolean;
  /** A short line under the content, e.g. "Akun dibuat oleh admin sekolah Anda." */
  footer?: ReactNode;
  className?: string;
}

/**
 * The frame of every page before sign-in: on 1024 px and up the green panel (600 px) is on the left and the form on the right;
 * on a phone it is one column with the logo on top and no sample board. The form is the page's <main>.
 */
export function AuthShell({ children, panel = true, footer, className }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh bg-kapur text-tinta">
      <nav aria-label={messages.appShell.shortcuts}>
        <a href="#isi-masuk" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-kapur-raised focus:px-4 focus:py-3 focus:font-bold">
          {messages.auth.skip}
        </a>
      </nav>
      {panel && <BrandPanel className="hidden w-150 shrink-0 lg:flex" />}
      <main id="isi-masuk" className="flex min-w-0 flex-1 flex-col items-center px-4 py-8 lg:px-8 lg:pb-8 lg:pt-36">
        <div className={cx('motion-card-in flex w-full max-w-105 flex-col gap-5', className)}>
          <BrandName className={panel ? 'lg:hidden' : undefined} />
          {children}
          {footer && <p className="m-0 text-center text-small text-tinta-muted">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
