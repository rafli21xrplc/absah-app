'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '../../components/button';
import { Dialog } from '../../components/dialog';

export interface ExitReason<V extends string> {
  value: V;
  label: string;
}

export interface ExitDialogProps<V extends string> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Keluarkan Bunga Lestari dari siswa aktif?" */
  title: string;
  /** What stays and what changes, in plain words. */
  description: ReactNode;
  /** Names the group of reasons, e.g. "Alasan". */
  reasonLabel: string;
  reasons: readonly ExitReason<V>[];
  confirmLabel: string;
  busy?: boolean;
  /** Shown in red under the reasons when the API refused or the call failed. */
  error?: string | null;
  onConfirm: (reason: V) => void;
}

/**
 * Takes someone off a list for a reason the school must name. Nothing is picked beforehand, and the button stays off until a
 * reason is chosen, so a tap on "Keluarkan" can never record a reason nobody gave.
 */
export function ExitDialog<V extends string>({ open, onOpenChange, title, description, reasonLabel, reasons, confirmLabel, busy = false, error, onConfirm }: ExitDialogProps<V>) {
  const [reason, setReason] = useState<V | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason(null);
        onOpenChange(next);
      }}
      alert
      title={title}
      description={description}
      actions={
        <Button loading={busy} disabled={reason === null} onClick={() => reason && onConfirm(reason)}>
          {confirmLabel}
        </Button>
      }
    >
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 p-0 text-small font-semibold text-tinta">{reasonLabel}</legend>
        {reasons.map((r) => (
          <label key={r.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-garis-kuat bg-kapur-raised px-3 text-body text-tinta">
            <input type="radio" name="exit-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="size-5 accent-papan" />
            {r.label}
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert" className="m-0 text-body text-alpa">
          {error}
        </p>
      )}
    </Dialog>
  );
}
