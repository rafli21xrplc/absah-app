'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cx } from '../cx';

// shadcn/ui "command" (cmdk), mapped to Absah tokens. Rows are 44 px (tap target), the selected row is papan-soft.
// CommandDialog is left out: nothing here opens a command palette.

function Command({ className, ...props }: ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cx('flex w-full flex-col overflow-hidden rounded-lg bg-kapur-raised text-tinta', className)} {...props} />;
}

function CommandInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex min-h-11 items-center gap-2 border-b border-garis px-3 focus-within:border-papan">
      <Search aria-hidden strokeWidth={1.75} className="size-4 shrink-0 text-tinta-muted" />
      <CommandPrimitive.Input
        data-slot="command-input"
        // The field sits in a box that shows focus by its bottom line turning green; the global ring would draw a second frame inside it.
        className={cx('flex min-h-11 w-full border-0 bg-transparent p-0 text-body text-tinta outline-hidden placeholder:text-tinta-muted focus-visible:!shadow-none', className)}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cx('max-h-72 scroll-py-1 overflow-y-auto overflow-x-hidden', className)} {...props} />;
}

function CommandEmpty({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className={cx('px-3 py-6 text-center text-small text-tinta-muted', className)} {...props} />;
}

function CommandGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cx(
        'overflow-hidden p-1 text-tinta [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-small [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-tinta-muted',
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({ className, ...props }: ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator data-slot="command-separator" className={cx('-mx-1 h-px bg-garis', className)} {...props} />;
}

function CommandItem({ className, ...props }: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cx(
        'relative flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-md px-3 text-body text-tinta outline-hidden data-[disabled=true]:pointer-events-none data-[disabled=true]:text-tinta-muted data-[selected=true]:bg-papan-soft [&_svg]:pointer-events-none [&_svg]:shrink-0',
        className,
      )}
      {...props}
    />
  );
}

export { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator };
