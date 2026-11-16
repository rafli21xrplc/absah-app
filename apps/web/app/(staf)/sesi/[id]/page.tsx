'use client';

import { CorrectionList, SessionDetail, type AttendanceStatus } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { use, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { SOURCE_LABELS, STATUS_LABELS } from '@/lib/attendance';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';

const CHOICES: AttendanceStatus[] = ['H', 'S', 'I', 'A', 'T'];
type Marks = Record<string, AttendanceStatus>;

/** What the teacher sees selected: the recorded status, or H for anyone not recorded yet. */
const initialMarks = (d: SessionDetail): Marks => Object.fromEntries(d.students.map((s) => [s.enrollmentId, s.status ?? 'H']));

/** Fill one session with one thumb: everyone starts Hadir, tap the exceptions, send (PRS-03). */
export default function SesiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { schoolId } = useWorkspace();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [marks, setMarks] = useState<Marks>({});
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const actionKey = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api(`/sessions/${id}`, SessionDetail, { schoolId })
      .then((d) => {
        setDetail(d);
        setMarks(initialMarks(d));
      })
      .catch((err: unknown) => setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Tidak bisa memuat sesi.' }));
  }, [schoolId, id]);

  const locked = detail ? detail.status === 'locked' || detail.status === 'missed' : false;
  const editable = detail ? (detail.canFill && !locked) || correcting : false;
  const changed = useMemo(
    () => (detail ? detail.students.filter((s) => !s.fixed && marks[s.enrollmentId] !== (s.status ?? 'H')) : []),
    [detail, marks],
  );
  const absent = detail ? detail.students.filter((s) => marks[s.enrollmentId] !== 'H' && marks[s.enrollmentId] !== 'T').length : 0;

  function mark(enrollmentId: string, status: AttendanceStatus) {
    actionKey.current = null; // a different answer is a new action
    setMessage(null);
    setMarks((prev) => ({ ...prev, [enrollmentId]: status }));
  }

  async function run(action: (key: string) => Promise<void>) {
    actionKey.current ??= newIdempotencyKey();
    setBusy(true);
    setMessage(null);
    try {
      await action(actionKey.current);
      actionKey.current = null;
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Tidak terkirim. Periksa sinyal, lalu kirim lagi.' });
    } finally {
      setBusy(false);
    }
  }

  const submit = () =>
    run(async (idempotencyKey) => {
      if (!detail) return;
      const exceptions = detail.students
        .filter((s) => !s.fixed && marks[s.enrollmentId] !== 'H')
        .map((s) => ({ enrollmentId: s.enrollmentId, status: marks[s.enrollmentId] }));
      const saved = await api(`/sessions/${id}/submit`, SessionDetail, { method: 'POST', body: { exceptions }, schoolId, idempotencyKey });
      setDetail(saved);
      setMarks(initialMarks(saved));
      setMessage({ ok: true, text: 'Presensi tersimpan.' });
    });

  const requestCorrection = () =>
    run(async (idempotencyKey) => {
      const body = { changes: changed.map((s) => ({ enrollmentId: s.enrollmentId, status: marks[s.enrollmentId] })), reason };
      const created = await api(`/sessions/${id}/corrections`, CorrectionList, { method: 'POST', body, schoolId, idempotencyKey });
      setCorrecting(false);
      setReason('');
      if (detail) setMarks(initialMarks(detail));
      setMessage({ ok: true, text: `${created.items.length} koreksi diajukan. Menunggu persetujuan wakasek.` });
    });

  if (!detail) {
    return (
      <main className={styles.main}>
        <Link className={styles.back} href="/hari-ini">
          ← Hari ini
        </Link>
        {message ? <p role="alert">{message.text}</p> : <p role="status">Memuat…</p>}
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/hari-ini">
        ← Hari ini
      </Link>
      <h1 className={styles.title}>
        {detail.owner.name}
        {detail.subject ? ` · ${detail.subject.name}` : ''}
      </h1>
      <p className={styles.muted}>
        {detail.period ? `Jam ke-${detail.period.number}, ${detail.period.startsAt}–${detail.period.endsAt}` : 'Presensi harian'} · {detail.students.length} siswa
      </p>
      {locked && !correcting && (
        <div className={styles.notice}>
          <p>Sesi ini sudah dikunci. Perubahan diajukan sebagai koreksi dan disetujui wakasek.</p>
          <Button variant="secondary" onClick={() => setCorrecting(true)}>
            Ajukan koreksi
          </Button>
        </div>
      )}
      {!locked && editable && <p className={forms.hint}>Semua hadir kecuali yang Anda tandai.</p>}

      <ul className={ui.students}>
        {detail.students.map((s) => (
          <li key={s.enrollmentId} className={ui.student}>
            <span className={ui.studentName}>{s.name}</span>
            {s.fixed && s.status ? (
              <span className={styles.muted}>
                {STATUS_LABELS[s.status]} · {s.source ? SOURCE_LABELS[s.source] : ''}
              </span>
            ) : (
              <div className={ui.choices} role="group" aria-label={`Status ${s.name}`}>
                {CHOICES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={ui.choice}
                    data-status={c}
                    aria-pressed={marks[s.enrollmentId] === c}
                    aria-label={`${s.name}: ${STATUS_LABELS[c]}`}
                    disabled={!editable || busy}
                    onClick={() => mark(s.enrollmentId, c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {(editable || message) && (
        <div className={ui.sendBar}>
          {message && (
            <p className={message.ok ? undefined : forms.error} role={message.ok ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}
          {editable && !correcting && (
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? 'Mengirim…' : `Kirim: ${detail.students.length - absent} hadir, ${absent} tidak hadir`}
            </Button>
          )}
          {correcting && (
            <>
              <textarea
                className={ui.reason}
                aria-label="Alasan koreksi"
                placeholder="Alasan koreksi, mis. surat dokter menyusul"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button disabled={busy || changed.length === 0 || reason.trim().length < 5} onClick={() => void requestCorrection()}>
                Ajukan koreksi ({changed.length} siswa)
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => {
                  setCorrecting(false);
                  setMarks(initialMarks(detail));
                }}>
                Batal
              </Button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
