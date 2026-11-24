import { useLayoutEffect, useRef } from 'react';

/** The scrim behind Dialog, Sheet and Drawer. The dark theme darkens the page; `tinta` is near white there, so it is not used. */
export const SCRIM = 'fixed inset-0 z-40 bg-tinta/30 dark:bg-kapur/70';

/**
 * Brings focus back to whatever opened an overlay.
 * Radix only does this for a Dialog.Trigger it knows about (its own close handler focuses the trigger and cancels the
 * default). Ours are controlled by `open` with no Trigger, so without this focus would fall to <body> and a keyboard
 * user would lose their place. The opener is read when `open` turns true, before Radix moves focus into the overlay.
 */
export function useRestoreFocus(open: boolean): (event: Event) => void {
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);
  return (event) => {
    event.preventDefault();
    opener.current?.focus();
  };
}
