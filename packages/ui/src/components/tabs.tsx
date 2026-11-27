'use client';

import * as RTabs from '@radix-ui/react-tabs';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cx } from '../cx';

/** Tabs on Radix: arrow keys move between tabs, the panel is tied to its tab by aria. */
export const Tabs = RTabs.Root;

export function TabsList({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <RTabs.List aria-label={label} className={cx('inline-flex max-w-full gap-1 overflow-x-auto rounded-kontrol bg-track p-1', className)}>
      {children}
    </RTabs.List>
  );
}

export function TabsTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cx(
        // The chosen tab is a white pill with a shadow and its word in `papan`. `tinta-muted` on the `track` is 5.5:1 (light).
        'inline-flex min-h-11 cursor-pointer items-center whitespace-nowrap rounded-md border border-transparent bg-transparent px-4 text-small font-bold text-tinta-muted transition-colors hover:text-tinta',
        'data-[state=active]:border-batas-lembut data-[state=active]:bg-kapur-raised data-[state=active]:text-papan data-[state=active]:shadow-aksi',
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = RTabs.Content;
