'use client';

import { TppkTrackResponse, type TppkReportStatus } from '@absah/contracts';
import { Button, Card, Field, Input, PageMain, messages } from '@absah/ui';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/tppk';

const t = messages.report;

/** Status of a report by its tracking code: nothing else is shown, and nothing is remembered. */
export default function LacakPage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<TppkReportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await api(`/tppk/reports/track/${encodeURIComponent(code.trim())}`, TppkTrackResponse, { anonymous: true });
      setStatus(res.status);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t.trackTooMany : err instanceof ApiError ? err.message : t.trackOffline);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageMain>
      <h1 className="m-0 text-h1">{t.trackTitle}</h1>
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
        <Field label={t.codeLabel} error={error ?? undefined}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} autoComplete="off" autoCapitalize="characters" placeholder="XXXXX-XXXXX" />
        </Field>
        <Button type="submit" size="52" loading={busy} disabled={code.trim().length < 10}>
          {t.seeStatus}
        </Button>
      </form>
      {status && (
        <Card as="section" role="status" aria-label={t.statusLabel} className="flex flex-col gap-1">
          <h2 className="m-0 text-h2">{STATUS_LABELS[status].label}</h2>
          <p className="m-0 text-body text-tinta-muted">{STATUS_LABELS[status].hint}</p>
        </Card>
      )}
    </PageMain>
  );
}
