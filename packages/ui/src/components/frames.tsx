import type { ElementType, ReactNode } from 'react';
import { messages } from '../../messages/id';
import { Button } from './button';
import { cx } from '../cx';
import { buttonStyles } from './button-styles';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { SkeletonRows } from './skeleton';

export interface AppShellProps {
  /** Side menu column (240 px, from 1024 px up). Below that it is hidden: the page offers the menu another way (a sheet). */
  sidebar: ReactNode;
  /** Pinned above the scrolling menu (brand, school). Without it and `sidebarFooter` the column is one scrolling block. */
  sidebarHeader?: ReactNode;
  /** Pinned under the scrolling menu (the account): always in reach, however long the menu is. */
  sidebarFooter?: ReactNode;
  /** The strip above the page on a laptop (1024 px and up): where search lives. Below that the top bar does the job. */
  header?: ReactNode;
  /** A bar above the page on screens under 1024 px (menu button, school name). */
  topBar?: ReactNode;
  /** The teacher's bottom bar, phone only (under 1024 px); the page gets room under it. */
  bottomBar?: ReactNode;
  children: ReactNode;
  skipLabel?: string;
}

/**
 * The staff page frame: skip link, 240 px side column on a laptop, a top bar on a phone, then the page.
 * The page keeps its own <main>; the frame is not a landmark so there is only one.
 */
export function AppShell({ sidebar, sidebarHeader, sidebarFooter, header, topBar, bottomBar, children, skipLabel = messages.appShell.skip }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-latar-app text-tinta lg:flex">
      <nav aria-label={messages.appShell.shortcuts}>
        <a href="#isi" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-kapur-raised focus:px-4 focus:py-3 focus:font-bold">
          {skipLabel}
        </a>
      </nav>
      {sidebarHeader || sidebarFooter ? (
        // v3: light column, 248 px from 1280 px, a 72 px icon rail from 1024 to 1279 px, a sheet below (the page's top bar).
        <aside className="surface-sidebar hidden w-18 shrink-0 flex-col border-r border-sidebar-garis bg-sidebar text-on-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh xl:w-62">
          {sidebarHeader && <div className="flex shrink-0 flex-col gap-4 px-4 pb-3 pt-5 lg:max-xl:items-center lg:max-xl:px-2">{sidebarHeader}</div>}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-2 lg:max-xl:px-2">{sidebar}</div>
          {sidebarFooter && <div className="shrink-0 p-4 lg:max-xl:px-2">{sidebarFooter}</div>}
        </aside>
      ) : (
        <aside className="hidden w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-garis bg-kapur-raised p-4 lg:sticky lg:top-0 lg:flex lg:h-dvh">{sidebar}</aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {header && (
          <div className="sticky top-0 z-30 hidden bg-latar-app lg:block">
            <div className="mx-auto box-border flex min-h-18 w-full max-w-360 items-center gap-3 px-8">{header}</div>
          </div>
        )}
        {topBar && <div className="sticky top-0 z-30 border-b border-garis bg-kapur-raised lg:hidden">{topBar}</div>}
        <div id="isi" tabIndex={-1} className={cx('min-w-0 flex-1 outline-none', bottomBar ? 'pb-14 lg:pb-0' : '')}>
          {children}
        </div>
        {bottomBar && <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">{bottomBar}</div>}
      </div>
    </div>
  );
}

/** The phone's top bar: a Menu button that opens the menu sheet, then the school (WorkspaceLabel). */
export function AppTopBar({ onMenu, menuLabel = messages.appShell.menu, children, actions }: { onMenu: () => void; menuLabel?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <Button variant="ghost" onClick={onMenu} aria-haspopup="dialog">
        {menuLabel}
      </Button>
      {children}
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
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

/**
 * A page's own main landmark and its column: padding and spacing live here so a page holds no free styling.
 * `full` (v3 boards): the whole width next to the side menu, up to 1440 px, 16 px between cards.
 */
export function PageMain({ children, width = 'md' }: { children: ReactNode; width?: 'md' | 'lg' | 'xl' | 'full' }) {
  if (width === 'full') return <main className="mx-auto box-border flex w-full max-w-360 flex-col gap-4 px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-2">{children}</main>;
  return <main className={cx('mx-auto box-border flex w-full flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8', width === 'xl' ? 'max-w-6xl' : width === 'lg' ? 'max-w-5xl' : 'max-w-xl')}>{children}</main>;
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

