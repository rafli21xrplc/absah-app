'use client';

import { ExamCheckIn, RoomAttendance } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { use, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { checkInProblem } from '@/lib/exam';
import { timeIn } from '@/lib/gate';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../../data.module.css';
import ui from '../../../presensi.module.css';

/** Absen ujian per ruang (UJN-03): the pengawas checks each student in, by the card QR read by a scanner or by hand. */
function Room({ roomId }: { roomId: string }) {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [data, setData] = useState<RoomAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const scanKey = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/exam/rooms/${roomId}/attendance`, RoomAttendance, { schoolId })
      .then((r) => {
        setError(null);
        setData(r);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat daftar hadir.'));
  }, [schoolId, roomId]);
  useEffect(load, [load]);

  async function record(path: string, body: object, key: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await api(path, ExamCheckIn, { method: 'POST', schoolId, idempotencyKey: key, body });
      setNotice(r.duplicate ? `${r.student.name} sudah tercatat hadir sebelumnya.` : `${r.student.name} hadir, tempat nomor ${r.seatNo}.`);
      load();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? checkInProblem(err.body.details as Parameters<typeof checkInProblem>[0]) : 'Belum tercatat. Periksa sinyal, lalu coba lagi.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  // A USB or Bluetooth scanner types the card's text and presses Enter into this field.
  async function scan(e: FormEvent) {
    e.preventDefault();
    const text = token.trim();
    if (!text) return;
    scanKey.current ??= newIdempotencyKey();
    await record(`/exam/rooms/${roomId}/scan`, { token: text }, scanKey.current);
    scanKey.current = null; // the next card, or the same one read again after a refusal, is a new attempt
    setToken('');
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/ujian">
        ← Ujian
      </Link>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Memuat…</p>}
      {data && (
        <>
          <h1 className={styles.title}>Ruang {data.room.name}</h1>
          <p role="status">
            {data.counts.present} hadir dari {data.counts.seated} siswa · <strong>{data.counts.absent} belum hadir</strong>
          </p>
          {notice && <p role="status">{notice}</p>}
          <form onSubmit={(e) => void scan(e)} aria-label="Pindai kartu">
            <label>
              Pindai kartu siswa
              <input value={token} autoComplete="off" autoFocus placeholder="Arahkan pemindai ke QR kartu" onChange={(e) => setToken(e.target.value)} />
            </label>{' '}
            <Button type="submit" disabled={busy}>
              Catat
            </Button>
          </form>
          {data.items.length === 0 && <p className={styles.empty}>Belum ada siswa di ruang ini.</p>}
          <ul className={ui.sessions}>
            {data.items.map((i) => (
              <li key={i.enrollmentId} className={ui.student} aria-label={i.student.name}>
                <span className={ui.studentName}>
                  {i.seatNo}. {i.student.name} <span className={styles.muted}>· {i.className}</span>
                </span>
                {i.present ? (
                  <span className={styles.badgeOk}>
                    Hadir {i.checkedInAt ? timeIn(timezone, i.checkedInAt) : ''}
                    {i.method === 'manual' ? ' (dicatat manual)' : ''}
                  </span>
                ) : i.eligible ? (
                  <Button variant="secondary" type="button" disabled={busy} onClick={() => void record(`/exam/rooms/${roomId}/attendance`, { enrollmentId: i.enrollmentId }, newIdempotencyKey())}>
                    Catat hadir
                  </Button>
                ) : (
                  <span className={styles.badgeBad}>Belum boleh ujian</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  return (
    <IfCap name="exam.enabled" fallback={<p className={styles.main}>Ujian belum diaktifkan.</p>}>
      <Room roomId={roomId} />
    </IfCap>
  );
}
