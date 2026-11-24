'use client';

import * as RToast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { messages } from '../../messages/id';
import { cx } from '../cx';

/** Mount once near the root. Radix pauses the countdown while a toast is hovered or has focus. */
export function ToastProvider({ children, duration = 8000 }: { children: ReactNode; duration?: number }) {
  return (
    <RToast.Provider
      label={messages.toast.region}
      duration={duration}
      swipeDirection="down"
      // Swiping is never the only way out: a threshold this large turns the gesture off, the Tutup button and Urungkan stay.
      swipeThreshold={100000}
    >
      {children}
      <RToast.Viewport className="fixed inset-x-0 bottom-0 z-50 m-0 flex list-none flex-col gap-2 p-4 sm:left-auto sm:right-4 sm:w-96" />
    </RToast.Provider>
  );
}

export interface ToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What happened, one short sentence: "24 siswa ditandai Hadir." */
  message: string;
  /** Shown when the action changed many things at once. Pressing it also closes the toast. */
  onUndo?: () => void;
  undoLabel?: string;
  /** Milliseconds before it closes by itself; stops while hovered or focused. */
  duration?: number;
  className?: string;
}

/** Announced through a role="status" live region (Radix renders it), an Urungkan action at least 44 px high, and a Tutup button. */
export function Toast({ open, onOpenChange, message, onUndo, undoLabel = messages.toast.undo, duration, className }: ToastProps) {
  return (
    <RToast.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      // A toast is the answer to something the person just did, so it is announced politely (a live region with
      // role="status", aria-live="polite"), not interrupting like an alert.
      type="background"
      className={cx(
        // Light: dark toast with a yellow action. Dark: the card colour with a border, so the yellow action keeps its contrast.
        'flex items-center gap-2 rounded-md bg-tinta py-1 pl-4 pr-1 text-kapur-raised dark:border dark:border-garis-kuat dark:bg-kapur-raised dark:text-tinta',
        className,
      )}
    >
      <RToast.Description className="min-w-0 flex-1 text-body">{message}</RToast.Description>
      {onUndo && (
        <RToast.Action altText={undoLabel} asChild>
          <button type="button" onClick={onUndo} className="inline-flex min-h-11 cursor-pointer items-center rounded-md border-0 bg-transparent px-4 font-bold text-stabilo">
            {undoLabel}
          </button>
        </RToast.Action>
      )}
      <RToast.Close aria-label={messages.toast.close} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-inherit">
        <X aria-hidden strokeWidth={1.75} className="size-5" />
      </RToast.Close>
    </RToast.Root>
  );
}
