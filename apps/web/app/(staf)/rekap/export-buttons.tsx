'use client';

import { ExportDownload, ExportJob, type ClassStream, type ExportFormat } from '@absah/contracts';
import { Button } from '@absah/ui';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { STREAM_LABELS } from '@/lib/report';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';

const POLL_MS = 2000;
const TARGET_LABELS = { erapor: 'e-Rapor', rdm: 'RDM (uji coba)' } as const;

/**
 * Semester rekap files (RKP-02, RKP-03): the worker builds them, this polls until done and then opens
 * the 5-minute download link. Without classId the file covers every rombel.
 */
export function ExportButtons({ semesterId, classId, stream }: { semesterId: string; classId?: string; stream?: ClassStream }) {
  const { schoolId } = useWorkspace();
  const target = useCapability('report.target') ?? 'erapor';
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Stops polling when the page is left. Reset on mount: StrictMode mounts, cleans up and mounts again.
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  async function run(format: ExportFormat) {
    if (!schoolId) return;
    setBusy(format);
    setMessage({ ok: true, text: 'Menyiapkan berkas…' });
    try {
      let job = await api('/exports', ExportJob, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { format, semesterId, classId, stream } });
      while (job.status === 'queued') {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (cancelled.current) return;
        job = await api(`/exports/${job.id}`, ExportJob, { schoolId });
      }
      if (job.status !== 'done') {
        setMessage({ ok: false, text: job.error ?? 'Berkas gagal dibuat. Coba lagi.' });
        return;
      }
      const link = await api(`/exports/${job.id}/download`, ExportDownload, { schoolId });
      window.location.assign(link.url);
      setMessage({ ok: true, text: `${link.fileName} diunduh.` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Berkas gagal dibuat. Coba lagi.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.section} aria-labelledby="ekspor">
      <h2 id="ekspor">Ekspor semester{stream ? ` jurusan ${STREAM_LABELS[stream]}` : ''}</h2>
      <div className={styles.rowActions}>
        <Button variant="secondary" disabled={busy !== null} onClick={() => void run('xlsx')}>
          {busy === 'xlsx' ? 'Menyiapkan…' : `Excel untuk ${TARGET_LABELS[target]}`}
        </Button>
        <Button variant="secondary" disabled={busy !== null} onClick={() => void run('pdf')}>
          {busy === 'pdf' ? 'Menyiapkan…' : 'PDF arsip (tanda tangan)'}
        </Button>
      </div>
      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={message.ok ? styles.muted : undefined}>
          {message.text}
        </p>
      )}
    </section>
  );
}
