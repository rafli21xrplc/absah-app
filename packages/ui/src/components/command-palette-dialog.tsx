'use client';

import * as RDialog from '@radix-ui/react-dialog';
import type { CommandPaletteProps } from './command-palette';
import { messages } from '../../messages/id';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';
import { SCRIM, useRestoreFocus } from './overlay';

const t = messages.search;

/** The palette itself: cmdk inside a Radix dialog. Loaded on first use (see command-palette.tsx). */
export default function CommandPaletteDialog({ open, onOpenChange, groups, query, onQueryChange, busy = false }: CommandPaletteProps) {
  const restoreFocus = useRestoreFocus(open);
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={SCRIM} />
        <RDialog.Content
          onCloseAutoFocus={restoreFocus}
          aria-describedby="palette-hint"
          className="popover-surface fixed left-1/2 top-[12vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-garis bg-kapur-raised text-tinta outline-none"
        >
          <RDialog.Title className="sr-only">{t.title}</RDialog.Title>
          <p id="palette-hint" className="sr-only">
            {t.hint}
          </p>
          {/* Filtering is cmdk's, except for the groups that come from the server (forceMount): those were searched already. */}
          <Command loop label={t.title} className="rounded-none">
            <CommandInput placeholder={t.placeholder} value={query} onValueChange={onQueryChange} />
            <CommandList className="max-h-[min(24rem,60vh)]">
              <CommandEmpty>{busy ? t.loading : t.empty}</CommandEmpty>
              {groups.map((g) => (
                <CommandGroup key={g.key} heading={g.heading}>
                  {g.items.map((item) => (
                    <CommandItem
                      key={item.key}
                      value={`${g.key}:${item.key}:${item.label}`}
                      keywords={item.keywords ?? []}
                      forceMount={g.remote ? true : undefined}
                      onSelect={() => {
                        onOpenChange(false);
                        item.onSelect();
                      }}
                    >
                      {item.icon && <span aria-hidden className="inline-flex shrink-0 text-tinta-muted">{item.icon}</span>}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="shrink-0 text-small text-tinta-muted">{item.hint}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
