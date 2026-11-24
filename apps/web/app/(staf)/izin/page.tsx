'use client';

import { LeaveAttachmentLink, LeaveRequest, LeaveRequestList } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { dateRangeLabel, LEAVE_KIND_LABELS, LEAVE_STAFF, LEAVE_STATUS_LABELS } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

const badge = { pending: styles.badgeWarn, approved: styles.badgeOk, rejected: styles.badgeBad, cancelled: styles.badgeBad } as const;

/** Izin siswa: the wali kelas decides parents' requests and can enter one for them (IZN). */
export default function IzinPage() {
  const { schoolId, hasRole, me } = useWorkspace();
  const staff = hasRole(...LEAVE_STAFF);
  const [status, setStatus] = useState<'pending' | 'all'>('pending');
  const [items, setItems] = useState<LeaveRequest[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(() => api(`/leave-requests?status=${status}`, LeaveRequestList, { schoolId }).then((r) => r.items), [schoolId, status]);

  useEffect(() => {
    if (!schoolId) return;
    fetchItems()
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat izin.'));
  }, [schoolId, fetchItems]);

  async function act(leave: LeaveRequest, path: 'decide' | 'cancel', body: object = {}) {
    setBusy(leave.id);
    setError(null);
    try {
      await api(`/leave-requests/${leave.id}/${path}`, LeaveRequest, { method: 'POST', body, schoolId, idempotencyKey: newIdempotencyKey() });
      setItems(await fetchItems());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak tersimpan. Coba lagi.');
    } finally {
      setBusy(null);
    }
  }

  async function openAttachment(leave: LeaveRequest) {
    const tab = window.open('', '_blank');
    try {
      const link = await api(`/leave-requests/${leave.id}/attachment`, LeaveAttachmentLink, { schoolId });
      if (tab) tab.location.href = link.url;
    } catch (err) {
      tab?.close();
      setError(err instanceof ApiError ? err.message : 'Tidak bisa membuka lampiran.');
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Izin siswa</h1>
      <Link className={styles.notice} href="/izin/baru">
        + Catat izin baru
      </Link>
      <div className={ui.segment} role="group" aria-label="Tampilkan">
        <button type="button" aria-pressed={status === 'pending'} onClick={() => setStatus('pending')}>
          Menunggu
        </button>
        <button type="button" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>
          Semua
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!items && !error && <p role="status">Memuat…</p>}
      {items?.length === 0 && <p className={styles.notice}>Tidak ada izin.</p>}
      <ul className={ui.sessions}>
        {items?.map((l) => (
          <li key={l.id} className={ui.student} aria-label={`Izin ${l.student.name}`}>
            <span className={ui.studentName}>
              {l.student.name} · {l.student.className}
            </span>
            <span>
              <strong>{LEAVE_KIND_LABELS[l.kind]}</strong> · {dateRangeLabel(l.startsOn, l.endsOn)}
            </span>
            <span>“{l.reason}”</span>
            <span className={styles.muted}>Diajukan {l.requestedBy?.name ?? '-'}</span>
            {l.hasAttachment && (
              <Button variant="secondary" onClick={() => void openAttachment(l)}>
                Lihat lampiran
              </Button>
            )}
            <span className={badge[l.status]}>
              {LEAVE_STATUS_LABELS[l.status]}
              {l.decidedBy && l.status !== 'pending' ? ` · ${l.decidedBy.name}` : ''}
            </span>
            <div className={styles.rowActions}>
              {l.status === 'pending' && staff && l.requestedBy?.id !== me.user.id && (
                <>
                  <Button disabled={busy === l.id} onClick={() => void act(l, 'decide', { approve: true })}>
                    Setujui
                  </Button>
                  <Button variant="secondary" disabled={busy === l.id} onClick={() => void act(l, 'decide', { approve: false })}>
                    Tolak
                  </Button>
                </>
              )}
              {(l.status === 'pending' || l.status === 'approved') && (
                <Button variant="secondary" disabled={busy === l.id} onClick={() => void act(l, 'cancel')}>
                  Batalkan izin
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
