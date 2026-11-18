'use client';

import { PklSupervisionDay } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { todayIn } from '@/lib/leave';
import { clockIn, CONFIRM_LABELS, STATUS_WORDS } from '@/lib/pkl';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../(portal)/portal.module.css';

type Item = PklSupervisionDay['items'][number];

/**
 * The industry supervisor's day (PKL-02): who checked in, one tap confirms everyone pending, a
 * dispute sends one student to the guru pembimbing. Statuses only, never locations.
 */
export default function DudiHome() {
  const { me, schoolId, hasRole, selectSchool } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [date, setDate] = useState(() => todayIn(timezone));
  const [day, setDay] = useState<PklSupervisionDay | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmKey = useRef<string | null>(null);
  const disputeKey = useRef<string | null>(null);
  const allowed = hasRole('pembimbing_industri');

  const load = useCallback(() => {
    if (!schoolId || !allowed) return;
    api(`/pkl/supervision?date=${date}`, PklSupervisionDay, { schoolId })
      .then(setDay)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat. Periksa internet.'));
  }, [schoolId, allowed, date]);
  useEffect(load, [load]);

  async function send(path: string, key: RefObject<string | null>, body: object) {
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      setDay(await api(path, PklSupervisionDay, { method: 'POST', schoolId, idempotencyKey: key.current, body }));
      key.current = null;
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu coba lagi.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function dispute(item: Item) {
    if (!item.checkIn) return;
    if (await send(`/pkl/checkins/${item.checkIn.id}/dispute`, disputeKey, { reason: reason.trim() })) {
      setDisputing(null);
      setReason('');
    }
  }

  if (!schoolId) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Pilih sekolah</h1>
        <div className={styles.actions}>
          {me.schools.map((s) => (
            <Button key={s.id} variant="secondary" onClick={() => selectSchool(s.id)}>
              {s.name}
            </Button>
          ))}
        </div>
      </main>
    );
  }
  if (!allowed) return <main className={styles.main}>Halaman ini untuk pembimbing industri PKL.</main>;

  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>{me.schools.find((s) => s.id === schoolId)?.name} · Pembimbing industri</p>
      <h1 className={styles.title}>Kehadiran siswa PKL</h1>
      <label>
        Tanggal{' '}
        <input type="date" value={date} max={todayIn(timezone)} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      {day && day.pending > 0 && (
        <Button disabled={busy} onClick={() => void send('/pkl/checkins/confirm', confirmKey, { date })}>
          {busy ? 'Mengirim…' : `Konfirmasi ${day.pending} siswa hadir`}
        </Button>
      )}
      {day && day.items.length === 0 && <p>Tidak ada siswa PKL pada tanggal ini.</p>}
      <ul className={styles.list} aria-label="Siswa PKL">
        {day?.items.map((item) => (
          <li key={item.placementId} aria-label={item.student.name}>
            <strong>{item.student.name}</strong> · {item.student.className}
            <br />
            {item.checkIn ? (
              <>
                Datang {clockIn(item.checkIn.recordedAt, timezone)}
                {item.checkIn.late && ' (terlambat)'} · {item.checkIn.status ? STATUS_WORDS[item.checkIn.status] : CONFIRM_LABELS[item.checkIn.confirmStatus]}
                {item.checkOut && ` · pulang ${clockIn(item.checkOut.recordedAt, timezone)}`}
              </>
            ) : (
              'Belum check-in'
            )}
            {item.checkIn?.confirmStatus === 'pending' && disputing !== item.checkIn.id && (
              <div>
                <Button variant="secondary" onClick={() => setDisputing(item.checkIn?.id ?? null)}>
                  Sanggah
                </Button>
              </div>
            )}
            {item.checkIn && disputing === item.checkIn.id && (
              <div>
                <label>
                  Kenapa? (dikirim ke guru pembimbing)
                  <textarea
                    value={reason}
                    minLength={3}
                    maxLength={300}
                    rows={2}
                    onChange={(e) => {
                      disputeKey.current = null;
                      setReason(e.target.value);
                    }}
                  />
                </label>
                <Button disabled={busy || reason.trim().length < 3} onClick={() => void dispute(item)}>
                  Kirim sanggahan
                </Button>{' '}
                <Button variant="secondary" onClick={() => setDisputing(null)}>
                  Batal
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p>Check-in yang tidak disanggah dalam 24 jam dianggap benar.</p>
      <Link href="/dudi/jurnal">Jurnal siswa</Link>
    </main>
  );
}
