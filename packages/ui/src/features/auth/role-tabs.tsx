'use client';

import * as RTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cx } from '../../cx';

export interface RoleTab<K extends string> {
  key: K;
  label: string;
}

export interface RoleTabsProps<K extends string> {
  label: string;
  tabs: readonly RoleTab<K>[];
  value: K;
  onValueChange: (value: K) => void;
  /** Hide the tab buttons (the code step replaces them) while the panel keeps its state. */
  tabsHidden?: boolean;
  /** The panel for the chosen tab. */
  children: ReactNode;
}

/** The three ways in (staff, parent, student): equal-width tabs, the chosen one has a thick green outline AND a soft fill. */
export function RoleTabs<K extends string>({ label, tabs, value, onValueChange, tabsHidden, children }: RoleTabsProps<K>) {
  return (
    <RTabs.Root value={value} onValueChange={(v) => onValueChange(v as K)} className="flex flex-col gap-5">
      <RTabs.List aria-label={label} className={cx('flex gap-2', tabsHidden && 'hidden')}>
        {tabs.map((tab) => (
          <RTabs.Trigger
            key={tab.key}
            value={tab.key}
            className={cx(
              'min-h-11 min-w-0 flex-1 cursor-pointer rounded-md px-2 text-small font-bold text-tinta',
              'border border-garis bg-kapur-raised data-[state=active]:border-2 data-[state=active]:border-papan data-[state=active]:bg-papan-soft',
            )}
          >
            {tab.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      <RTabs.Content value={value} className="flex flex-col gap-5 outline-none">
        {children}
      </RTabs.Content>
    </RTabs.Root>
  );
}
