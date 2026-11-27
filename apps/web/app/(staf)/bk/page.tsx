'use client';

import { CounselingNote, CounselingNoteList, PointStudentList, type CounselingFollowUp } from '@absah/contracts';
import { Button, DateInput } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { BK_WRITERS, FOLLOW_UP_LABELS } from '@/lib/ksw';
import { todayIn } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';
import { StudentPicker, type PickedStudent } from '../poin/student-picker';

const FILTERS: { value: CounselingFollowUp | 'all'; label: string }[] = [
  { value: 'planned', label: 'Tindak lanjut direncanakan' },
  { value: 'done', label: 'Tindak lanjut selesai' },
  { value: 'all', label: 'Semua' },
];

/** Catatan BK (KSW-05): the guru BK writes and follows up, the admin reads. Notes are the most private data of the school. */
export default function BkPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const writer = hasRole(...BK_WRITERS);
  const [filter, setFilter] = useState<CounselingFollowUp | 'all'>('planned');
  const [notes, setNotes] = useState<CounselingNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!schoolId) return;
    const query = filter === 'all' ? '' : `?followUp=${filter}`;
    api(`/counseling-notes${query}`, CounselingNoteList, { schoolId })
      .then((r) => {
        setNotes(r.items);
        setError(null);
      })
      .catch(() => setError('Tidak bisa memuat catatan BK.'));
  }, [schoolId, filter]);
  useEffect(load, [load]);

  async function complete(note: CounselingNote) {
    setError(null);
    try {
      await api(`/counseling-notes/${note.id}/complete`, CounselingNote, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey(), body: {} });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) setError('Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    }
    load();
  }

  return (
    <IfCap name="student.counseling" fallback={<p className={styles.main}>Catatan BK belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Catatan BK</h1>
        <p>Catatan ini hanya dibuka untuk guru BK dan admin. Isinya tidak pernah dikirim ke orang tua atau muncul di log.</p>
        <div className={writer ? styles.split : undefined}>
          {writer && <NewNote schoolId={schoolId} today={todayIn(timezone)} onDone={load} />}
          <div>
            <fieldset className={forms.field}>
              <legend>Tampilkan</legend>
              {FILTERS.map((f) => (
                <label key={f.value}>
                  <input type="radio" name="filter" checked={filter === f.value} onChange={() => setFilter(f.value)} /> {f.label}
                </label>
              ))}
            </fieldset>
            {error && (
              <p className={forms.error} role="alert">
                {error}
              </p>
            )}
            {notes && notes.length === 0 && <p className={styles.empty}>Tidak ada catatan.</p>}
            <ul className={ui.sessions}>
              {notes?.map((n) => (
                <li key={n.id} className={ui.student} aria-label={`${n.student.name} ${n.date}`}>
                  <span className={ui.studentName}>
                    {n.student.name} · {n.student.className} · {n.date}
                  </span>
                  <span>{n.note}</span>
                  <span className={n.followUp === 'planned' ? styles.badgeWarn : styles.badge}>
                    {FOLLOW_UP_LABELS[n.followUp]}
                    {n.followUpOn ? ` · ${n.followUpOn}` : ''}
                  </span>
                  {writer && n.followUp === 'planned' && (
                    <Button variant="secondary" type="button" onClick={() => void complete(n)}>
                      Tandai tindak lanjut selesai
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </IfCap>
  );
}

function NewNote({ schoolId, today, onDone }: { schoolId: string | null; today: string; onDone: () => void }) {
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [followUp, setFollowUp] = useState<'none' | 'planned'>('none');
  const [followUpOn, setFollowUpOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const changed = () => {
    key.current = null;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!student) return setError('Pilih siswa dulu.');
    if (!note.trim()) return setError('Tulis catatannya.');
    if (followUpOn && followUpOn < date) return setError('Tanggal tindak lanjut tidak boleh sebelum tanggal sesi.');
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const body = { enrollmentId: student.enrollmentId, ...(date !== today ? { date } : {}), note, followUp, ...(followUp === 'planned' && followUpOn ? { followUpOn } : {}) };
      await api('/counseling-notes', CounselingNote, { method: 'POST', schoolId, idempotencyKey: key.current, body });
      key.current = null;
      setSaved(student.name);
      setStudent(null);
      setNote('');
      setDate(today);
      setFollowUp('none');
      setFollowUpOn('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.section} onSubmit={(e) => void submit(e)} aria-labelledby="catatan-baru">
      <h2 id="catatan-baru">Catatan baru</h2>
      {saved && <p role="status">Tersimpan: catatan untuk {saved}.</p>}
      <StudentPicker
        schoolId={schoolId}
        path="/counseling-notes/students"
        schema={PointStudentList}
        student={student}
        onPick={(s) => {
          changed();
          setStudent(s);
        }}
      />
      <label className={forms.field}>
        Tanggal sesi
        <DateInput type="date" value={date} max={today} onChange={(e) => { changed(); setDate(e.target.value); }} />
      </label>
      <label className={forms.field}>
        Catatan
        <textarea value={note} maxLength={2000} rows={5} onChange={(e) => { changed(); setNote(e.target.value); }} />
      </label>
      <fieldset className={forms.field}>
        <legend>Tindak lanjut</legend>
        {(['none', 'planned'] as const).map((f) => (
          <label key={f}>
            <input type="radio" name="followUp" checked={followUp === f} onChange={() => { changed(); setFollowUp(f); }} /> {FOLLOW_UP_LABELS[f]}
          </label>
        ))}
      </fieldset>
      {followUp === 'planned' && (
        <label className={forms.field}>
          Direncanakan pada (boleh dikosongkan)
          <DateInput type="date" value={followUpOn} min={date} onChange={(e) => { changed(); setFollowUpOn(e.target.value); }} />
        </label>
      )}
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan catatan'}
      </Button>
    </form>
  );
}
