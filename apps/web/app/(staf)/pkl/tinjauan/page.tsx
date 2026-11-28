'use client';

import { PklDayDecision, PklReviewList, type AttendanceStatus, type PklReviewItem } from '@absah/contracts';
import { Button, EmptyState } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { dateRangeLabel } from '@/lib/leave';
import { clockIn, CONFIRM_LABELS, REASON_LABELS, STATUS_WORDS } from '@/lib/pkl';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';

const STATUSES: AttendanceStatus[] = ['H', 'T', 'S', 'I', 'A'];

/**
 * Guru pembimbing review (PKL-02): check-ins outside the radius or hours, disputed by the industry
 * supervisor, and past work days without a check-in. One tap decides the day's status.
 */
export default function PklReviewPage() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [items, setItems] = useState<PklReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // One key per (day, status) until it went through, so a retried tap is not a second decision.
  const keys = useRef(new Map<string, string>());

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/pkl/reviews', PklReviewList, { schoolId })
      .then((r) => setItems(r.items))
      .catch(() => setError('Antrean belum termuat. Muat ulang halaman.'));
  }, [schoolId]);
  useEffect(load, [load]);

  async function decide(item: PklReviewItem, status: AttendanceStatus) {
    const k = `${item.sessionId}:${status}`;
    const key = keys.current.get(k) ?? newIdempotencyKey();
    keys.current.set(k, key);
    setBusy(item.sessionId);
    setError(null);
    try {
      await api(`/pkl/days/${item.sessionId}/decide`, PklDayDecision, { method: 'POST', schoolId, idempotencyKey: key, body: { status } });
      keys.current.delete(k);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu coba lagi.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <IfCap name="pkl.enabled" fallback={<p className={styles.main}>PKL belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/pkl">
          ← PKL
        </Link>
        <h1 className={styles.title}>Tinjauan kehadiran PKL</h1>
        {error && <p role="alert">{error}</p>}
        {items && items.length === 0 && <EmptyState bare headingLevel="p" kind="done" title="Tidak ada yang perlu ditinjau." />}
        <ul className={ui.students} aria-label="Antrean tinjauan">
          {items?.map((item) => (
            <li key={item.sessionId} className={ui.student} aria-label={`${item.student.name} ${item.date}`}>
              <p className={ui.studentName}>
                {item.student.name} · {item.student.className}
              </p>
              <p>
                {dateRangeLabel(item.date, item.date)} · {item.partner.name}
              </p>
              {item.checkIn ? (
                <p>
                  Check-in {clockIn(item.checkIn.recordedAt, timezone)}
                  {item.checkIn.late && ' (terlambat)'} · {item.checkIn.distanceM} m dari titik DUDI
                  {item.checkIn.accuracyM !== null && ` (akurasi GPS ±${item.checkIn.accuracyM} m)`} · {CONFIRM_LABELS[item.checkIn.confirmStatus]}
                  {item.checkIn.reviewReasons.length > 0 && `: ${item.checkIn.reviewReasons.map((r) => REASON_LABELS[r]).join(', ')}`}
                  {item.checkIn.disputeReason && (
                    <>
                      <br />
                      Sanggahan pembimbing industri: {item.checkIn.disputeReason}
                    </>
                  )}
                </p>
              ) : (
                <p>Tidak ada check-in.{item.status && ` Status sekarang: ${STATUS_WORDS[item.status]}.`}</p>
              )}
              <div className={ui.choices} role="group" aria-label="Putuskan status">
                {STATUSES.map((s) => (
                  <Button key={s} variant="secondary" disabled={busy === item.sessionId} onClick={() => void decide(item, s)} aria-label={STATUS_WORDS[s]}>
                    {s}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </IfCap>
  );
}
