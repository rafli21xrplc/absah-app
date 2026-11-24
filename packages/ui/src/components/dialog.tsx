import * as RDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { messages } from '../../messages/id';
import { Button } from './button';
import { SCRIM, useRestoreFocus } from './overlay';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: the dialog is named by it. */
  title: string;
  /** What will happen, in plain words. Read out after the title. */
  description?: ReactNode;
  /** A question about something that changes data (role "alertdialog"). A plain form or notice leaves it off. */
  alert?: boolean;
  children?: ReactNode;
  /** The confirming button(s). Batal is always there and always comes first. */
  actions?: ReactNode;
  cancelLabel?: string;
}

/** Centred dialog on Radix: focus goes in and comes back to the opener, Esc, the scrim and Batal close it. */
export function Dialog({ open, onOpenChange, title, description, alert = false, children, actions, cancelLabel = messages.dialog.cancel }: DialogProps) {
  const restoreFocus = useRestoreFocus(open);
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={SCRIM} />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <RDialog.Content
            role={alert ? 'alertdialog' : 'dialog'}
            onCloseAutoFocus={restoreFocus}
            // Radix wires aria-describedby to the Description by itself; undefined is only for a dialog without one (it silences the warning).
            {...(description ? {} : { 'aria-describedby': undefined })}
            className="pointer-events-auto flex max-h-dvh w-120 max-w-full flex-col gap-4 overflow-y-auto rounded-lg border border-garis bg-kapur-raised p-6 text-tinta"
          >
            <RDialog.Title className="m-0 text-h2">{title}</RDialog.Title>
            {description && <RDialog.Description className="m-0 text-body text-tinta-muted">{description}</RDialog.Description>}
            {children}
            <div className="flex flex-wrap justify-end gap-2">
              <RDialog.Close asChild>
                <Button variant="secondary">{cancelLabel}</Button>
              </RDialog.Close>
              {actions}
            </div>
          </RDialog.Content>
        </div>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
