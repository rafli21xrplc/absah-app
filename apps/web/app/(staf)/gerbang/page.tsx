'use client';

import { Arrival, GateToday } from '@absah/contracts';
import { Button, LoadingState } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { ARRIVAL_RECORDERS, KIOSK_MANAGERS, timeIn } from '@/lib/gate';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import ui from '../presensi.module.css';
import gate from './gerbang.module.css';

type Student = GateToday['notArrived'][number];
const LEAVE_LABELS = { S: 'Sakit', I: 'Izin' } as const;

/** Piket at the gate: who is late, who is not in yet, and manual arrivals with a reason (GRB-05/06). */
export default function GerbangPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [today, setToday] = useState<GateToday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Student | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => api('/gate/today', GateToday, { schoolId }), [schoolId]);
  useEffect(() => {
    if (!schoolId) return;
    load()
      .then(setToday)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat data gerbang.'));
  }, [schoolId, load]);

  const recorded = async (arrival: Arrival) => {
    setOpen(null);
    setNotice(`${arrival.name} tercatat datang pukul ${timeIn(timezone, arrival.arrivedAt)}${arrival.outcome === 'late' ? ' (terlambat)' : ''}.`);
    setToday(await load());
  };

  return (
    <IfCap name="gate.enabled" fallback={<p className={styles.main}>Presensi gerbang belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Gerbang hari ini</h1>
        <Link className={styles.notice} href="/gerbang/papan">
          Papan kedatangan per rombel (diperbarui tiap 5 detik)
        </Link>
        {hasRole(...KIOSK_MANAGERS) && (
          <Link className={styles.notice} href="/gerbang/kios">
            Kelola kios gerbang
          </Link>
        )}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {!today && !error && <LoadingState variant="cards" />}
        {today && (
          <>
            <div className={styles.counts} aria-label="Ringkasan">
              <p className={styles.count}>
                <strong>{today.counts.arrived}</strong> sudah datang
              </p>
              <p className={styles.count}>
                <strong>{today.counts.late}</strong> terlambat
              </p>
              <p className={styles.count}>
                <strong>{today.counts.notArrived}</strong> belum datang
              </p>
            </div>
            <p className={styles.muted}>Terlambat bila datang setelah pukul {today.lateAfter.replace(':', '.')}.</p>

            <section className={styles.section} aria-labelledby="terlambat">
              <h2 id="terlambat">Terlambat</h2>
              {today.late.length === 0 ? (
                <p className={styles.muted}>Belum ada.</p>
              ) : (
                <ul className={ui.sessions}>
                  {today.late.map((a) => (
                    <li key={a.enrollmentId} className={ui.student}>
                      <span className={ui.studentName}>
                        {a.name} · {a.className}
                      </span>
                      <span>
                        {timeIn(timezone, a.arrivedAt)} · {a.method === 'manual' ? `dicatat piket: ${a.reason ?? ''}` : 'kartu'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.section} aria-labelledby="belum">
              <h2 id="belum">Belum datang</h2>
              {today.notArrived.length === 0 && <p className={styles.muted}>Semua sudah datang.</p>}
              <ul className={ui.sessions}>
                {today.notArrived.map((s) => (
                  <li key={s.enrollmentId} className={ui.student} aria-label={`Belum datang ${s.name}`}>
                    <span className={ui.studentName}>
                      {s.name} · {s.className}
                    </span>
                    {s.leave && <span className={styles.badgeOk}>{LEAVE_LABELS[s.leave]} · izin disetujui</span>}
                    {hasRole(...ARRIVAL_RECORDERS) &&
                      (open?.enrollmentId === s.enrollmentId ? (
                        <ManualArrival schoolId={schoolId} student={s} onDone={(a) => void recorded(a)} onCancel={() => setOpen(null)} />
                      ) : (
                        <div className={styles.rowActions}>
                          <Button variant="secondary" onClick={() => setOpen(s)}>
                            Catat datang
                          </Button>
                        </div>
                      ))}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </IfCap>
  );
}

function ManualArrival({ schoolId, student, onDone, onCancel }: { schoolId: string | null; student: Student; onDone: (a: Arrival) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // One key per form: a retry after a lost answer does not record twice.
  const [key] = useState(newIdempotencyKey);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await api('/gate/arrivals', Arrival, { method: 'POST', schoolId, idempotencyKey: key, body: { enrollmentId: student.enrollmentId, reason } }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const message = fieldError(error, 'reason') ?? (error instanceof ApiError ? error.message : error ? 'Tidak tersimpan. Coba lagi.' : null);
  return (
    <form className={gate.form} onSubmit={(e) => void submit(e)}>
      <label>
        Alasan tanpa kartu
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Mis. HP orang tua tertinggal" maxLength={200} required />
      </label>
      {message && <p role="alert">{message}</p>}
      <div className={styles.rowActions}>
        <Button type="submit" disabled={busy}>
          Simpan kedatangan
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}
