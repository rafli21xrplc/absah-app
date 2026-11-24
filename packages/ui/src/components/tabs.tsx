'use client';

import * as RTabs from '@radix-ui/react-tabs';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cx } from '../cx';

/** Tabs on Radix: arrow keys move between tabs, the panel is tied to its tab by aria. */
export const Tabs = RTabs.Root;

export function TabsList({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <RTabs.List aria-label={label} className={cx('inline-flex max-w-full gap-1 overflow-x-auto rounded-md bg-garis p-1', className)}>
      {children}
    </RTabs.List>
  );
}

export function TabsTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cx(
        // The chosen tab is lighter AND has an outline, so it never depends on colour alone. The text stays `tinta`: grey text on
        // the `garis` track is 4.44:1 in the light theme, just under 4.5.
        'inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-sm border border-transparent bg-transparent px-4 text-small font-bold text-tinta',
        'data-[state=active]:border-garis-kuat data-[state=active]:bg-kapur-raised',
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = RTabs.Content;
