'use client';

import { TppkCaseDetail } from '@absah/contracts';
import { Button, Select, Textarea } from '@absah/ui';
import Link from 'next/link';
import { use, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { CASE_STATUS_LABELS, CATEGORY_LABELS, EVENT_LABELS } from '@/lib/tppk';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../../forms.module.css';
import styles from '../../../data.module.css';
import ui from '../../../presensi.module.css';

const when = (iso: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso));
type Action = 'catatan' | 'langkah' | 'tutup' | 'buka';

/** A case: the report, every step in order, and the next step, closing or reopening. */
export default function KasusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { schoolId } = useWorkspace();
  const [detail, setDetail] = useState<TppkCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action>('langkah');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // One key per write until it went through; editing makes it a new write.
  const key = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api(`/tppk/cases/${id}`, TppkCaseDetail, { schoolId })
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat kasus.'));
  }, [schoolId, id]);

  const closed = detail?.status === 'closed';
  const effective: Action = closed ? 'buka' : action;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (effective === 'tutup' && !window.confirm('Tutup kasus ini? Pelapor akan melihat status "Selesai".')) return;
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    const path = effective === 'tutup' ? 'close' : effective === 'buka' ? 'reopen' : 'events';
    const body = effective === 'catatan' || effective === 'langkah' ? { kind: effective, note } : { note };
    try {
      setDetail(await api(`/tppk/cases/${id}/${path}`, TppkCaseDetail, { method: 'POST', schoolId, idempotencyKey: key.current, body }));
      key.current = null;
      setNote('');
      setAction('langkah');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/tppk">
        ← Papan TPPK
      </Link>
      {error && <p role="alert">{error}</p>}
      {detail && (
        <>
          <h1 className={styles.title}>{detail.summary}</h1>
          <p className={styles.muted}>
            <span className={closed ? styles.badgeOk : styles.badgeWarn}>{CASE_STATUS_LABELS[detail.status]}</span>{' '}
            {detail.category ? `${CATEGORY_LABELS[detail.category].label} · ` : ''}dibuka {when(detail.openedAt)}
            {detail.openedBy ? ` oleh ${detail.openedBy.name}` : ''}
          </p>
          {detail.report && (
            <details className={styles.section}>
              <summary>Kronologi dari laporan</summary>
              <p style={{ whiteSpace: 'pre-wrap' }}>{detail.report.chronology}</p>
              <p className={styles.muted}>{detail.report.reporter ? `Pelapor: ${detail.report.reporter.name ?? detail.report.reporter.account?.name ?? 'tanpa nama'}` : 'Pelapor anonim.'}</p>
            </details>
          )}

          <section className={styles.section} aria-labelledby="langkah">
            <h2 id="langkah">Penanganan</h2>
            {detail.events.length === 0 && <p className={styles.muted}>Belum ada catatan.</p>}
            <ol className={ui.sessions} aria-label="Riwayat penanganan">
              {detail.events.map((e) => (
                <li key={e.id} className={ui.student}>
                  <span className={ui.studentName}>{EVENT_LABELS[e.kind]}</span>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{e.note}</span>
                  <span className={styles.muted}>
                    {when(e.createdAt)}
                    {e.createdBy ? ` · ${e.createdBy.name}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <form className={forms.form} onSubmit={(e) => void submit(e)}>
            {!closed && (
              <label className={forms.field}>
                <span className={forms.label}>Jenis</span>
                <Select value={action} onChange={(e) => setAction(e.target.value as Action)}>
                  <option value="langkah">Langkah yang diambil</option>
                  <option value="catatan">Catatan</option>
                  <option value="tutup">Tutup kasus</option>
                </Select>
              </label>
            )}
            <label className={forms.field}>
              <span className={forms.label}>{effective === 'tutup' ? 'Hasil penanganan' : effective === 'buka' ? 'Alasan dibuka kembali' : 'Isi'}</span>
              <Textarea
                style={{ minHeight: 100, paddingTop: 8 }}
                value={note}
                maxLength={4000}
                onChange={(e) => {
                  key.current = null;
                  setNote(e.target.value);
                }}
              />
            </label>
            <Button type="submit" disabled={busy || note.trim().length < 2}>
              {busy ? 'Menyimpan…' : effective === 'tutup' ? 'Tutup kasus' : effective === 'buka' ? 'Buka kembali' : 'Simpan'}
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
