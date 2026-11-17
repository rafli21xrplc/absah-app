'use client';

import { TppkTrackResponse, type TppkReportStatus } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/tppk';
import forms from '../../../forms.module.css';
import styles from '../lapor.module.css';

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
      setError(err instanceof ApiError && err.status === 429 ? 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' : err instanceof ApiError ? err.message : 'Tidak bisa terhubung. Periksa internet lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Lacak laporan</h1>
      <form className={forms.form} onSubmit={(e) => void submit(e)}>
        <label className={forms.field}>
          <span className={forms.label}>Kode lacak</span>
          <input className={forms.input} value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} autoComplete="off" autoCapitalize="characters" placeholder="XXXXX-XXXXX" />
        </label>
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || code.trim().length < 10}>
          {busy ? 'Memeriksa…' : 'Lihat status'}
        </Button>
      </form>
      {status && (
        <section role="status" aria-label="Status laporan">
          <h2>{STATUS_LABELS[status].label}</h2>
          <p className={styles.lead}>{STATUS_LABELS[status].hint}</p>
        </section>
      )}
    </main>
  );
}
