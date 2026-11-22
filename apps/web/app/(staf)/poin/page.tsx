'use client';

import { CreatePointEvidenceResponse, PointEntry, PointRuleList, PointStudentList, type PointRule } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { todayIn } from '@/lib/leave';
import { checkEvidence, earliestEntryDate, POINT_KIND_LABELS, POINT_RECORDERS, signedPoints } from '@/lib/ksw';
import { putPhoto } from '@/lib/pickup';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import { StudentPicker, type PickedStudent } from './student-picker';

/**
 * Poin kesiswaan (KSW-02): a teacher picks the student and the rule, may add a date, a note and a photo or PDF as
 * evidence, and saves. The rule's points are copied by the API, so nothing is typed by hand here.
 */
export default function PoinPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [notice, setNotice] = useState<{ entry: PointEntry; student: string } | null>(null);

  return (
    <IfCap name="student.points" fallback={<p className={styles.main}>Poin kesiswaan belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Poin kesiswaan</h1>
        <p>
          <Link href="/poin/aturan">Aturan poin dan ambang</Link>
        </p>
        {notice && (
          <p role="status">
            Tersimpan: {notice.student}, {notice.entry.rule} ({signedPoints(notice.entry.points)}).{' '}
            {hasRole('admin', 'wakasek', 'wali_kelas', 'kepsek') && (
              <Link href={`/poin/${notice.entry.enrollmentId}`}>Lihat poin siswa</Link>
            )}
          </p>
        )}
        {hasRole(...POINT_RECORDERS) ? (
          <NewEntry schoolId={schoolId} timezone={timezone} onDone={(entry, student) => setNotice({ entry, student })} />
        ) : (
          <p className={styles.empty}>Peran Anda tidak mencatat poin. Poin siswa dibuka dari daftar tugas tindak lanjut.</p>
        )}
      </main>
    </IfCap>
  );
}

function NewEntry({ schoolId, timezone, onDone }: { schoolId: string | null; timezone: string; onDone: (e: PointEntry, student: string) => void }) {
  const today = todayIn(timezone);
  const [rules, setRules] = useState<PointRule[]>([]);
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [ruleId, setRuleId] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // One key per entry until it went through; any change makes it another entry.
  const key = useRef<string | null>(null);
  const changed = () => {
    key.current = null;
  };

  useEffect(() => {
    if (!schoolId) return;
    api('/point-rules', PointRuleList, { schoolId })
      .then((r) => setRules(r.items))
      .catch(() => setError('Tidak bisa memuat aturan poin.'));
  }, [schoolId]);

  const rule = rules.find((r) => r.id === ruleId);

  async function uploadEvidence(f: File) {
    const check = checkEvidence(f);
    if (!check.ok) throw new Error(check.message);
    const created = await api('/point-entries/evidence', CreatePointEvidenceResponse, {
      method: 'POST',
      schoolId,
      idempotencyKey: newIdempotencyKey(),
      body: { fileSize: f.size, contentType: check.contentType },
    });
    await putPhoto(created.upload, f);
    return { id: created.evidenceId, contentType: check.contentType };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!student) return setError('Pilih siswa dulu.');
    if (!rule) return setError('Pilih aturannya.');
    if (rule.kind === 'violation' && !window.confirm(`Catat ${rule.name} (${signedPoints(rule.points)}) untuk ${student.name}?`)) return;
    key.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    try {
      const evidence = file ? await uploadEvidence(file) : undefined;
      const body = { enrollmentId: student.enrollmentId, ruleId: rule.id, ...(date !== today ? { date } : {}), ...(note.trim() ? { note } : {}), ...(evidence ? { evidence } : {}) };
      const entry = await api('/point-entries', PointEntry, { method: 'POST', schoolId, idempotencyKey: key.current, body });
      key.current = null;
      onDone(entry, student.name);
      setStudent(null);
      setRuleId('');
      setDate(today);
      setNote('');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error && err.message.startsWith('Bukti') ? err.message : 'Belum tersimpan. Periksa sinyal, lalu kirim lagi.');
    } finally {
      setBusy(false);
    }
  }

  const byKind = (kind: PointRule['kind']) => rules.filter((r) => r.kind === kind);

  return (
    <form className={styles.section} onSubmit={(e) => void submit(e)} aria-labelledby="catat">
      <h2 id="catat">Catat poin</h2>
      <StudentPicker
        schoolId={schoolId}
        path="/point-entries/students"
        schema={PointStudentList}
        student={student}
        onPick={(s) => {
          changed();
          setStudent(s);
        }}
      />
      <label className={forms.field}>
        Aturan
        <select
          value={ruleId}
          onChange={(e) => {
            changed();
            setRuleId(e.target.value);
          }}
        >
          <option value="">Pilih aturan</option>
          {(['violation', 'achievement'] as const).map((kind) => (
            <optgroup key={kind} label={POINT_KIND_LABELS[kind]}>
              {byKind(kind).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.category} · {r.name} ({signedPoints(r.points)})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {rules.length === 0 && <p className={styles.empty}>Belum ada aturan poin. Wakasek atau admin menambahkannya di halaman aturan.</p>}
      <label className={forms.field}>
        Tanggal kejadian
        <input
          type="date"
          value={date}
          min={earliestEntryDate(today)}
          max={today}
          onChange={(e) => {
            changed();
            setDate(e.target.value);
          }}
        />
      </label>
      <label className={forms.field}>
        Catatan (boleh dikosongkan)
        <textarea
          value={note}
          maxLength={500}
          rows={3}
          onChange={(e) => {
            changed();
            setNote(e.target.value);
          }}
        />
      </label>
      <label className={forms.field}>
        Bukti foto atau PDF, maksimal 5 MB (boleh dikosongkan)
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => {
            changed();
            setFile(e.target.files?.[0] ?? null);
          }}
        />
      </label>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  );
}
