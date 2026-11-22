'use client';

import { TeacherAttendance, TeacherToday } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { checkInSummary, startLabel, TEACHER_CHECKIN } from '@/lib/teacher';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';

/** Absen guru (GRU-01): the teacher checks in and out from the staff app; the API decides whether it is late. */
export default function AbsenGuruPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [today, setToday] = useState<TeacherToday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per tap until it went through, so a retry after a bad signal is the same request.
  const key = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    api('/teacher-attendance/today', TeacherToday, { schoolId })
      .then((t) => {
        setToday(t);
        setError(null);
      })
      .catch(() => setError('Tidak bisa memuat absen hari ini.'));
  }, [schoolId]);
  useEffect(load, [load]);

  async function act(path: 'check-in' | 'check-out') {
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const attendance = await api(`/teacher-attendance/${path}`, TeacherAttendance, { method: 'POST', schoolId, idempotencyKey: key.current, body: {} });
      key.current = null;
      setToday((t) => (t ? { ...t, attendance } : t));
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) key.current = null;
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu ketuk lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <IfCap name="teacher.attendance" fallback={<p className={styles.main}>Absen guru belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Absen guru</h1>
        {!hasRole(...TEACHER_CHECKIN) && <p className={styles.empty}>Peran Anda tidak mengisi absen guru.</p>}
        {hasRole(...TEACHER_CHECKIN) && (
          <>
            {error && (
              <p className={forms.error} role="alert">
                {error}
              </p>
            )}
            {!today && !error && <p role="status">Memuat…</p>}
            {today && (
              <section className={styles.section} aria-labelledby="hari-ini">
                <h2 id="hari-ini">Hari ini, {today.schoolDate}</h2>
                {!today.schoolDay && !today.attendance && <p className={styles.empty}>Hari ini bukan hari sekolah.</p>}
                {today.attendance ? (
                  <p role="status">{checkInSummary(today.attendance, today.schoolStart, timezone)}</p>
                ) : (
                  today.schoolDay && <p>Sekolah mulai pukul {startLabel(today.schoolStart)}.</p>
                )}
                {today.schoolDay && !today.attendance && (
                  <Button type="button" disabled={busy} onClick={() => void act('check-in')}>
                    {busy ? 'Menyimpan…' : 'Absen masuk'}
                  </Button>
                )}
                {today.attendance && (
                  <Button type="button" variant={today.attendance.checkedOutAt ? 'secondary' : 'primary'} disabled={busy} onClick={() => void act('check-out')}>
                    {busy ? 'Menyimpan…' : today.attendance.checkedOutAt ? 'Perbarui jam pulang' : 'Absen pulang'}
                  </Button>
                )}
              </section>
            )}
            <p>
              <Link href="/izin-guru">Izin guru</Link>
            </p>
          </>
        )}
      </main>
    </IfCap>
  );
}
