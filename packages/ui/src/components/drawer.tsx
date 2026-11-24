'use client';

import * as RDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { messages } from '../../messages/id';
import { Button } from './button';
import { IconButton } from './icon-button';
import { SCRIM, useRestoreFocus } from './overlay';

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: the drawer is named by it. */
  title: string;
  children: ReactNode;
  /** The saving button(s). Batal is always there and always comes first. */
  actions?: ReactNode;
  /** When set, the whole drawer is a <form> and a submit button in `actions` sends it. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  closeLabel?: string;
  cancelLabel?: string;
}

const PANEL = 'fixed inset-y-0 right-0 z-50 flex w-115 max-w-full flex-col border-l border-garis bg-kapur-raised text-tinta';

/** Side panel from the right for a form or a detail, on Radix Dialog (focus trap, focus returns to the opener). */
export function Drawer({ open, onOpenChange, title, children, actions, onSubmit, closeLabel = messages.drawer.close, cancelLabel = messages.drawer.cancel }: DrawerProps) {
  const restoreFocus = useRestoreFocus(open);
  const body = (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-garis px-6 py-4">
        <RDialog.Title className="m-0 text-h2">{title}</RDialog.Title>
        <RDialog.Close asChild>
          <IconButton label={closeLabel} icon={<X aria-hidden strokeWidth={1.75} className="size-5" />} />
        </RDialog.Close>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">{children}</div>
      <footer className="flex justify-end gap-2 border-t border-garis px-6 py-4">
        <RDialog.Close asChild>
          <Button variant="secondary">{cancelLabel}</Button>
        </RDialog.Close>
        {actions}
      </footer>
    </>
  );
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={SCRIM} />
        <RDialog.Content aria-describedby={undefined} onCloseAutoFocus={restoreFocus} className={PANEL}>
          {/* The dialog is the div; a <form> may not carry role="dialog" (axe: aria-allowed-role), so it sits inside. */}
          {onSubmit ? (
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              {body}
            </form>
          ) : (
            body
          )}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
