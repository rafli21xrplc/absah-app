'use client';

import { TeacherLeave, TeacherLeaveList, type TeacherLeaveKind } from '@absah/contracts';
import { TEACHER_LEAVE_KINDS } from '@absah/contracts';
import { Button, DateInput } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { dateRangeLabel, LEAVE_STATUS_LABELS, todayIn } from '@/lib/leave';
import { mayCancelTeacherLeave, TEACHER_CHECKIN, TEACHER_LEAVE_DECIDING, TEACHER_LEAVE_KIND_LABELS, teacherLeaveProblem } from '@/lib/teacher';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

const badge = { pending: styles.badgeWarn, approved: styles.badgeOk, rejected: styles.badgeBad, cancelled: styles.badgeBad } as const;
const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');

/** Izin guru (GRU-02): a teacher asks and withdraws; the wakasek (or kepsek, admin) decides, never on their own izin. */
export default function IzinGuruPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const today = todayIn(timezone);
  const teaches = hasRole(...TEACHER_CHECKIN);
  const decides = hasRole(...TEACHER_LEAVE_DECIDING);
  const [mine, setMine] = useState<TeacherLeave[] | null>(null);
  const [waiting, setWaiting] = useState<TeacherLeave[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    if (teaches) {
      api('/teacher-leaves?status=all&mine=true', TeacherLeaveList, { schoolId })
        .then((r) => setMine(r.items))
        .catch(() => setError('Tidak bisa memuat izin Anda.'));
    }
    if (decides) {
      api('/teacher-leaves?status=pending', TeacherLeaveList, { schoolId })
        .then((r) => setWaiting(r.items.filter((l) => l.teacher.id !== me.user.id)))
        .catch(() => setError('Tidak bisa memuat izin yang menunggu.'));
    }
  }, [schoolId, teaches, decides, me.user.id]);
  useEffect(load, [load]);

  async function act(leave: TeacherLeave, path: 'decide' | 'cancel', body: object = {}) {
    setError(null);
    try {
      await api(`/teacher-leaves/${leave.id}/${path}`, TeacherLeave, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body });
    } catch (err) {
      setError(messageOf(err));
    }
    load();
  }

  return (
    <IfCap name="teacher.attendance" fallback={<p className={styles.main}>Izin guru belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Izin guru</h1>
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        {decides && (
          <section className={styles.section} aria-labelledby="menunggu">
            <h2 id="menunggu">Menunggu keputusan</h2>
            {waiting.length === 0 && <p className={styles.empty}>Tidak ada izin guru yang menunggu.</p>}
            <ul className={ui.sessions}>
              {waiting.map((l) => (
                <Decision key={l.id} leave={l} onDecide={(approve, note) => act(l, 'decide', { approve, ...(note ? { note } : {}) })} />
              ))}
            </ul>
          </section>
        )}
        {teaches && (
          <>
            <NewLeave schoolId={schoolId} today={today} onDone={load} />
            <section className={styles.section} aria-labelledby="saya">
              <h2 id="saya">Izin saya</h2>
              {mine?.length === 0 && <p className={styles.empty}>Belum ada izin.</p>}
              <ul className={ui.sessions}>
                {mine?.map((l) => (
                  <li key={l.id} className={ui.student} aria-label={`Izin ${l.startsOn}`}>
                    <span className={ui.studentName}>
                      {TEACHER_LEAVE_KIND_LABELS[l.kind]} · {dateRangeLabel(l.startsOn, l.endsOn)}
                    </span>
                    <span>“{l.reason}”</span>
                    <span className={badge[l.status]}>
                      {LEAVE_STATUS_LABELS[l.status]}
                      {l.decidedBy && l.status !== 'pending' ? ` · ${l.decidedBy.name}` : ''}
                    </span>
                    {l.decisionNote && <span>Catatan: {l.decisionNote}</span>}
                    {mayCancelTeacherLeave(l, today) && (
                      <Button variant="secondary" type="button" onClick={() => void act(l, 'cancel')}>
                        Batalkan izin
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
        {!teaches && !decides && <p className={styles.empty}>Peran Anda tidak memakai izin guru.</p>}
      </main>
    </IfCap>
  );
}

function Decision({ leave, onDecide }: { leave: TeacherLeave; onDecide: (approve: boolean, note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (approve: boolean) => {
    setBusy(true);
    await onDecide(approve, note.trim());
    setBusy(false);
  };
  return (
    <li className={ui.student} aria-label={`Izin ${leave.teacher.name}`}>
      <span className={ui.studentName}>{leave.teacher.name}</span>
      <span>
        <strong>{TEACHER_LEAVE_KIND_LABELS[leave.kind]}</strong> · {dateRangeLabel(leave.startsOn, leave.endsOn)}
      </span>
      <span>“{leave.reason}”</span>
      <label className={forms.field}>
        Catatan keputusan (boleh dikosongkan)
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      </label>
      <span className={styles.rowActions}>
        <Button type="button" disabled={busy} onClick={() => void decide(true)}>
          Setujui
        </Button>
        <Button variant="secondary" type="button" disabled={busy} onClick={() => void decide(false)}>
          Tolak
        </Button>
      </span>
    </li>
  );
}

function NewLeave({ schoolId, today, onDone }: { schoolId: string | null; today: string; onDone: () => void }) {
  const [kind, setKind] = useState<TeacherLeaveKind>('sakit');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const key = useRef<string | null>(null);
  const changed = () => {
    key.current = null;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = teacherLeaveProblem({ startsOn, endsOn, reason });
    if (problem) return setError(problem);
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      await api('/teacher-leaves', TeacherLeave, { method: 'POST', schoolId, idempotencyKey: key.current, body: { kind, startsOn, endsOn, reason } });
      key.current = null;
      setSaved(true);
      setReason('');
      onDone();
    } catch (err) {
      setSaved(false);
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.section} onSubmit={(e) => void submit(e)} aria-labelledby="ajukan">
      <h2 id="ajukan">Ajukan izin</h2>
      {saved && <p role="status">Izin terkirim. Wakasek akan memutuskan.</p>}
      <fieldset className={forms.field}>
        <legend>Jenis</legend>
        {TEACHER_LEAVE_KINDS.map((k) => (
          <label key={k}>
            <input type="radio" name="kind" checked={kind === k} onChange={() => { changed(); setKind(k); }} /> {TEACHER_LEAVE_KIND_LABELS[k]}
          </label>
        ))}
      </fieldset>
      <label className={forms.field}>
        Mulai
        <DateInput type="date" value={startsOn} onChange={(e) => { changed(); setStartsOn(e.target.value); if (endsOn < e.target.value) setEndsOn(e.target.value); }} />
      </label>
      <label className={forms.field}>
        Selesai
        <DateInput type="date" value={endsOn} min={startsOn} onChange={(e) => { changed(); setEndsOn(e.target.value); }} />
      </label>
      <label className={forms.field}>
        Alasan
        <textarea value={reason} rows={3} maxLength={500} onChange={(e) => { changed(); setReason(e.target.value); }} />
      </label>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Mengirim…' : 'Kirim izin'}
      </Button>
    </form>
  );
}
