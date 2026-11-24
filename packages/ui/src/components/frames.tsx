import type { ElementType, ReactNode } from 'react';
import { messages } from '../../messages/id';
import { Button } from './button';
import { buttonStyles } from './button-styles';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { SkeletonRows } from './skeleton';

export interface AppShellProps {
  /** Side menu column (240 px, from 1024 px up). Below that it is hidden: the page offers the menu another way (a sheet). */
  sidebar: ReactNode;
  /** A bar above the page on screens under 1024 px (menu button, school name). */
  topBar?: ReactNode;
  children: ReactNode;
  skipLabel?: string;
}

/**
 * The staff page frame: skip link, 240 px side column on a laptop, a top bar on a phone, then the page.
 * The page keeps its own <main>; the frame is not a landmark so there is only one.
 */
export function AppShell({ sidebar, topBar, children, skipLabel = messages.appShell.skip }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-kapur text-tinta lg:flex">
      <a href="#isi" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-kapur-raised focus:px-4 focus:py-3 focus:font-bold">
        {skipLabel}
      </a>
      <aside className="hidden w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-garis bg-kapur-raised p-4 lg:sticky lg:top-0 lg:flex lg:h-dvh">{sidebar}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {topBar && <div className="sticky top-0 z-30 border-b border-garis bg-kapur-raised lg:hidden">{topBar}</div>}
        <div id="isi" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </div>
      </div>
    </div>
  );
}

/** The phone's top bar: a Menu button that opens the menu sheet, then the school (WorkspaceLabel). */
export function AppTopBar({ onMenu, menuLabel = messages.appShell.menu, children }: { onMenu: () => void; menuLabel?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <Button variant="ghost" onClick={onMenu} aria-haspopup="dialog">
        {menuLabel}
      </Button>
      {children}
    </div>
  );
}

/** The school the user works in: name and level, as the top of the side menu and of the phone bar. */
export function WorkspaceLabel({ name, detail }: { name: string; detail?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-body-strong">{name}</span>
      {detail && <span className="truncate text-small text-tinta-muted">{detail}</span>}
    </div>
  );
}

/** The portal: one simple column, at most 480 px wide on a laptop. */
export function PortalFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-120">{children}</div>;
}

/** A loading, error or not-found state replaces the whole page, so it is the page's own main landmark. */
function StateFrame({ children }: { children: ReactNode }) {
  return <main className="mx-auto box-border flex w-full max-w-xl flex-col gap-4 px-4 py-6">{children}</main>;
}

/** loading.tsx of a route group. */
export function LoadingPage() {
  return (
    <StateFrame>
      <h1 className="sr-only">{messages.skeleton.label}</h1>
      <SkeletonRows count={4} />
    </StateFrame>
  );
}

/** error.tsx of a route group. It never shows the error's own text: that is technical and may hold data. */
export function ErrorPage({ onRetry }: { onRetry: () => void }) {
  return (
    <StateFrame>
      <ErrorState title={messages.pageState.errorTitle} headingLevel="h1" onRetry={onRetry}>
        {messages.pageState.errorBody}
      </ErrorState>
    </StateFrame>
  );
}

/** not-found.tsx of a route group. The way out is a link to `homeHref` that looks like a button. */
export function NotFoundPage({ homeHref = '/', linkAs }: { homeHref?: string; linkAs?: ElementType }) {
  const Link = linkAs ?? 'a';
  return (
    <StateFrame>
      <EmptyState
        title={messages.pageState.notFoundTitle}
        headingLevel="h1"
        action={
          <Link href={homeHref} className={buttonStyles({ variant: 'primary', size: '48' }) + ' no-underline'}>
            {messages.pageState.home}
          </Link>
        }
      >
        {messages.pageState.notFoundBody}
      </EmptyState>
    </StateFrame>
  );
}

