'use client';

import * as RDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { messages } from '../../messages/id';
import { Button } from './button';
import { SCRIM, useRestoreFocus } from './overlay';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: the sheet is named by it. */
  title: string;
  /** A short line above the title, e.g. "Pilih kehadiran untuk". */
  eyebrow?: string;
  children: ReactNode;
  cancelLabel?: string;
}

/**
 * Bottom sheet for a choice. Built on Radix Dialog: focus goes in and returns to the opener; Esc, a tap on the scrim and
 * Batal close it. The small bar on top is a picture only: nothing can be dragged (no gesture is ever the only way).
 */
export function Sheet({ open, onOpenChange, title, eyebrow, children, cancelLabel = messages.sheet.cancel }: SheetProps) {
  const restoreFocus = useRestoreFocus(open);
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={SCRIM} />
        <RDialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={restoreFocus}
          // Focus lands on the sheet itself, not on its first field: on a phone a focused text field opens the keyboard over what the person came to read.
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          className="outline-none fixed inset-x-0 bottom-0 z-50 flex max-h-dvh flex-col gap-4 overflow-y-auto rounded-t-lg border border-b-0 border-garis bg-kapur-raised px-4 pb-4 pt-3 text-tinta sm:mx-auto sm:max-w-120"
        >
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-garis-kuat" />
          <header className="flex flex-col">
            {eyebrow && (
              <p aria-hidden className="m-0 text-small text-tinta-muted">
                {eyebrow}
              </p>
            )}
            {/* The eyebrow is read as part of the name ("Pilih kehadiran untuk Gilang"), shown once. */}
            <RDialog.Title className="m-0 text-h2">
              {eyebrow && (
                <>
                  <span className="sr-only">{eyebrow}</span>{' '}
                </>
              )}
              {title}
            </RDialog.Title>
          </header>
          {children}
          <RDialog.Close asChild>
            <Button variant="ghost" size="48" className="w-full">
              {cancelLabel}
            </Button>
          </RDialog.Close>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
