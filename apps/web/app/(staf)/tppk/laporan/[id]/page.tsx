'use client';

import { TppkCaseDetail, TppkReportDetail } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { CATEGORY_LABELS, RELATION_LABELS, STATUS_LABELS } from '@/lib/tppk';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../../forms.module.css';
import styles from '../../../data.module.css';

/** One report for a TPPK member: the story, the reporter if named, and "Buat kasus". */
export default function LaporanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { schoolId } = useWorkspace();
  const router = useRouter();
  const [report, setReport] = useState<TppkReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!schoolId) return;
    api(`/tppk/reports/${id}`, TppkReportDetail, { schoolId })
      .then(setReport)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat laporan.'));
  }, [schoolId, id]);

  async function openCase(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await api('/tppk/cases', TppkCaseDetail, { method: 'POST', schoolId, idempotencyKey: key, body: { reportId: id, summary } });
      router.push(`/tppk/kasus/${c.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Coba lagi.');
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/tppk">
        ← Papan TPPK
      </Link>
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <h1 className={styles.title}>{CATEGORY_LABELS[report.category].label}</h1>
          <p className={styles.muted}>
            {STATUS_LABELS[report.status].label} · pelapor: {RELATION_LABELS[report.reporterRelation].toLowerCase()}
            {report.occurredOn ? ` · kejadian ${report.occurredOn}` : ''}
          </p>
          <section className={styles.section} aria-labelledby="kronologi">
            <h2 id="kronologi">Kronologi</h2>
            <p style={{ whiteSpace: 'pre-wrap' }}>{report.chronology}</p>
          </section>
          <section className={styles.section} aria-labelledby="pelapor">
            <h2 id="pelapor">Pelapor</h2>
            {report.reporter ? (
              <p>
                {report.reporter.name ?? report.reporter.account?.name ?? 'Tanpa nama'}
                {report.reporter.contact ? ` · ${report.reporter.contact}` : ''}
              </p>
            ) : (
              <p className={styles.muted}>Anonim. Identitas pelapor tidak disimpan.</p>
            )}
          </section>
          {report.caseId ? (
            <Link className={styles.notice} href={`/tppk/kasus/${report.caseId}`}>
              Buka kasus laporan ini
            </Link>
          ) : (
            <form className={forms.form} onSubmit={(e) => void openCase(e)}>
              <label className={forms.field}>
                <span className={forms.label}>Ringkasan kasus</span>
                <input className={forms.input} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} />
              </label>
              <Button type="submit" disabled={busy || summary.trim().length < 5}>
                {busy ? 'Menyimpan…' : 'Buat kasus'}
              </Button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
