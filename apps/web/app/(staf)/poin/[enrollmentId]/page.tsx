'use client';

import { PointEntry, PointEvidenceLink, StudentPoints } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { POINT_KIND_LABELS, POINT_MANAGERS, POINT_PROFILE_READERS, signedPoints, totalsLine } from '@/lib/ksw';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';

/** A student's points this academic year (KSW-02): net totals, every entry, evidence on request, and reversal for admin and wakasek. */
export default function PoinSiswaPage({ params }: { params: Promise<{ enrollmentId: string }> }) {
  const { enrollmentId } = use(params);
  const { schoolId, hasRole } = useWorkspace();
  const [data, setData] = useState<StudentPoints | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/students/${enrollmentId}/points`, StudentPoints, { schoolId })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError && err.status === 404 ? 'Siswa tidak ditemukan atau bukan kelas Anda.' : 'Tidak bisa memuat poin siswa.'));
  }, [schoolId, enrollmentId]);
  useEffect(load, [load]);

  async function showEvidence(entry: PointEntry) {
    try {
      const link = await api(`/point-entries/${entry.id}/evidence`, PointEvidenceLink, { schoolId });
      setLinks((l) => ({ ...l, [entry.id]: link.url }));
    } catch {
      setError('Bukti tidak bisa dibuka.');
    }
  }

  async function reverse(entry: PointEntry) {
    if (reason.trim().length < 3) return setError('Tulis alasan pembatalan.');
    setBusy(true);
    setError(null);
    try {
      await api(`/point-entries/${entry.id}/reverse`, PointEntry, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: { reason } });
      setReversing(null);
      setReason('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Pembatalan belum tersimpan.');
    } finally {
      setBusy(false);
    }
  }

  if (!hasRole(...POINT_PROFILE_READERS)) return <p className={styles.main}>Peran Anda tidak membuka poin siswa.</p>;

  return (
    <IfCap name="student.points" fallback={<p className={styles.main}>Poin kesiswaan belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/poin">
          ← Poin kesiswaan
        </Link>
        <h1 className={styles.title}>{data ? data.student.name : 'Poin siswa'}</h1>
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        {data && (
          <>
            <p>
              {data.student.className} · <strong>{data.total >= 0 ? '+' : ''}{data.total} poin</strong> ({totalsLine(data.violationPoints, data.achievementPoints)})
            </p>
            {data.items.length === 0 && <p className={styles.empty}>Belum ada catatan poin.</p>}
            <ul className={ui.sessions}>
              {data.items.map((e) => (
                <li key={e.id} className={ui.student} aria-label={`${e.rule} ${signedPoints(e.points)}`}>
                  <span className={ui.studentName}>
                    {e.date} · {e.rule} ({signedPoints(e.points)})
                  </span>
                  <span>
                    {POINT_KIND_LABELS[e.kind]} · {e.category}
                    {e.recordedBy ? ` · ${e.recordedBy.name}` : ''}
                    {e.note ? ` · ${e.note}` : ''}
                  </span>
                  {e.reversesEntryId && <span className={styles.badge}>Pembatalan</span>}
                  {e.reversed && <span className={styles.badgeWarn}>Dibatalkan</span>}
                  {e.hasEvidence &&
                    (links[e.id] ? (
                      <a href={links[e.id]} target="_blank" rel="noopener noreferrer">
                        Buka bukti
                      </a>
                    ) : (
                      <Button variant="secondary" type="button" onClick={() => void showEvidence(e)}>
                        Lihat bukti
                      </Button>
                    ))}
                  {hasRole(...POINT_MANAGERS) && !e.reversed && !e.reversesEntryId && (
                    reversing === e.id ? (
                      <span>
                        <label className={forms.field}>
                          Alasan pembatalan
                          <input value={reason} maxLength={300} onChange={(ev) => setReason(ev.target.value)} />
                        </label>
                        <Button type="button" disabled={busy} onClick={() => void reverse(e)}>
                          {busy ? 'Membatalkan…' : 'Batalkan catatan'}
                        </Button>{' '}
                        <Button variant="secondary" type="button" onClick={() => setReversing(null)}>
                          Tidak jadi
                        </Button>
                      </span>
                    ) : (
                      <Button variant="secondary" type="button" onClick={() => setReversing(e.id)}>
                        Batalkan
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </IfCap>
  );
}
