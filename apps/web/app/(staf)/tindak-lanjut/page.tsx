'use client';

import { FollowupTask, FollowupTaskList, type FollowupStatus } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { FOLLOWUP_CLOSERS, POINT_PROFILE_READERS } from '@/lib/ksw';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

/** Tugas tindak lanjut (KSW-03): made when a student's pelanggaran points cross a threshold; the wali kelas or BK closes it. */
export default function TindakLanjutPage() {
  const { schoolId, hasRole } = useWorkspace();
  const [status, setStatus] = useState<FollowupStatus>('open');
  const [tasks, setTasks] = useState<FollowupTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!schoolId) return;
    api(`/followup-tasks?status=${status}`, FollowupTaskList, { schoolId })
      .then((r) => {
        setTasks(r.items);
        setError(null);
      })
      .catch(() => setError('Tidak bisa memuat tugas tindak lanjut.'));
  }, [schoolId, status]);
  useEffect(load, [load]);

  async function complete(task: FollowupTask) {
    setBusy(true);
    setError(null);
    try {
      await api(`/followup-tasks/${task.id}/complete`, FollowupTask, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: note.trim() ? { note } : {} });
      setClosing(null);
      setNote('');
      load();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? 'Tugas ini sudah selesai.' : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <IfCap name="student.points" fallback={<p className={styles.main}>Poin kesiswaan belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Tugas tindak lanjut</h1>
        <fieldset className={forms.field}>
          <legend>Tampilkan</legend>
          {(['open', 'done'] as const).map((s) => (
            <label key={s}>
              <input type="radio" name="status" checked={status === s} onChange={() => setStatus(s)} /> {s === 'open' ? 'Belum selesai' : 'Selesai'}
            </label>
          ))}
        </fieldset>
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        {tasks && tasks.length === 0 && <p className={styles.empty}>{status === 'open' ? 'Tidak ada tugas yang menunggu.' : 'Belum ada tugas selesai.'}</p>}
        <ul className={ui.sessions}>
          {tasks?.map((t) => (
            <li key={t.id} className={ui.student} aria-label={`${t.student.name} ${t.label}`}>
              <span className={ui.studentName}>
                {hasRole(...POINT_PROFILE_READERS) ? <Link href={`/poin/${t.student.enrollmentId}`}>{t.student.name}</Link> : t.student.name} · {t.student.className}
              </span>
              <span>
                {t.label} ({t.totalPoints} poin, ambang {t.minPoints}) · {t.action}
              </span>
              {t.status === 'done' && (
                <span>
                  Selesai oleh {t.completedBy?.name ?? '—'}
                  {t.note ? ` · ${t.note}` : ''}
                </span>
              )}
              {t.status === 'open' &&
                hasRole(...FOLLOWUP_CLOSERS) &&
                (closing === t.id ? (
                  <span>
                    <label className={forms.field}>
                      Yang sudah dilakukan (boleh dikosongkan)
                      <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                    </label>
                    <Button type="button" disabled={busy} onClick={() => void complete(t)}>
                      {busy ? 'Menyimpan…' : 'Tandai selesai'}
                    </Button>{' '}
                    <Button variant="secondary" type="button" onClick={() => setClosing(null)}>
                      Tidak jadi
                    </Button>
                  </span>
                ) : (
                  <Button variant="secondary" type="button" onClick={() => setClosing(t.id)}>
                    Selesaikan
                  </Button>
                ))}
            </li>
          ))}
        </ul>
      </main>
    </IfCap>
  );
}
