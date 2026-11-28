'use client';

import { Correction, CorrectionList } from '@absah/contracts';
import { Button, LoadingState } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { CORRECTION_DECIDERS, STATUS_LABELS } from '@/lib/attendance';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

const STATE_LABELS = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' } as const;

/** Corrections to locked sessions: wakasek and kepsek decide, others follow their own (PRS-05). */
export default function KoreksiPage() {
  const { schoolId, hasRole } = useWorkspace();
  const decider = hasRole(...CORRECTION_DECIDERS);
  const [status, setStatus] = useState<'pending' | 'all'>('pending');
  const [items, setItems] = useState<Correction[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(
    () => api(`/corrections?status=${status}`, CorrectionList, { schoolId }).then((r) => r.items),
    [schoolId, status],
  );

  useEffect(() => {
    if (!schoolId) return;
    fetchItems()
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat koreksi.'));
  }, [schoolId, fetchItems]);

  async function decide(c: Correction, approve: boolean) {
    setBusy(c.id);
    setError(null);
    try {
      await api(`/corrections/${c.id}/decide`, Correction, { method: 'POST', body: { approve }, schoolId, idempotencyKey: newIdempotencyKey() });
      setItems(await fetchItems());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak bisa menyimpan keputusan. Coba lagi.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>{decider ? 'Koreksi presensi' : 'Koreksi yang saya ajukan'}</h1>
      <div className={ui.segment} role="group" aria-label="Tampilkan">
        <button type="button" aria-pressed={status === 'pending'} onClick={() => setStatus('pending')}>
          Menunggu
        </button>
        <button type="button" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>
          Semua
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!items && !error && <LoadingState />}
      {items?.length === 0 && <p className={styles.notice}>Tidak ada koreksi.</p>}
      <ul className={ui.sessions}>
        {items?.map((c) => (
          <li key={c.id} className={ui.student} aria-label={`Koreksi ${c.student.name}`}>
            <span className={ui.studentName}>
              {c.student.name} · {c.student.className}
            </span>
            <span>
              {c.fromStatus ? STATUS_LABELS[c.fromStatus] : 'Kosong'} → <strong>{STATUS_LABELS[c.toStatus]}</strong>
            </span>
            <span className={styles.muted}>
              {c.session.schoolDate} · {c.session.ownerName}
              {c.session.subject ? ` · ${c.session.subject}` : ''} · oleh {c.requestedBy?.name ?? '-'}
            </span>
            <span>“{c.reason}”</span>
            {c.status === 'pending' && decider ? (
              <div className={styles.rowActions}>
                <Button disabled={busy === c.id} onClick={() => void decide(c, true)}>
                  Setujui
                </Button>
                <Button variant="secondary" disabled={busy === c.id} onClick={() => void decide(c, false)}>
                  Tolak
                </Button>
              </div>
            ) : (
              <span className={c.status === 'approved' ? styles.badgeOk : c.status === 'rejected' ? styles.badgeBad : styles.badgeWarn}>
                {STATE_LABELS[c.status]}
                {c.decidedBy ? ` · ${c.decidedBy.name}` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
