'use client';

import { CreateLeaveAttachmentResponse, LEAVE_ATTACHMENT_MAX_BYTES, LEAVE_ATTACHMENT_TYPES, LeaveRequest, LeaveStudentList, type LeaveKind } from '@absah/contracts';
import { Button, DateRangeInput, Select } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { dateRangeLabel, LEAVE_KIND_LABELS, LEAVE_STATUS_LABELS, todayIn } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';

type AttachmentType = (typeof LEAVE_ATTACHMENT_TYPES)[number];
const isAttachmentType = (type: string): type is AttachmentType => (LEAVE_ATTACHMENT_TYPES as readonly string[]).includes(type);

/** Enter izin: the wali kelas after a call or a letter (approved at once), or a parent (pending). */
export default function IzinBaruPage() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const today = todayIn(timezone);
  const [students, setStudents] = useState<LeaveStudentList['items'] | null>(null);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [kind, setKind] = useState<LeaveKind>('sakit');
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(today);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<LeaveRequest | null>(null);
  const actionKey = useRef<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/leave-requests/students', LeaveStudentList, { schoolId })
      .then((r) => setStudents(r.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat daftar siswa.'));
  }, [schoolId]);

  async function uploadAttachment(f: File) {
    if (!isAttachmentType(f.type)) throw new Error('Lampiran harus foto (JPG, PNG, WebP) atau PDF.');
    if (f.size > LEAVE_ATTACHMENT_MAX_BYTES) throw new Error('Lampiran maksimal 5 MB.');
    const created = await api('/leave-requests/attachments', CreateLeaveAttachmentResponse, {
      method: 'POST',
      body: { fileSize: f.size, contentType: f.type },
      schoolId,
      idempotencyKey: newIdempotencyKey(),
    });
    const put = await fetch(created.upload.url, { method: 'PUT', headers: created.upload.headers, body: f });
    if (!put.ok) throw new Error('Lampiran gagal terunggah. Coba lagi.');
    return { id: created.attachmentId, contentType: f.type };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    actionKey.current ??= newIdempotencyKey();
    try {
      const attachment = file ? await uploadAttachment(file) : undefined;
      const body = { enrollmentId, kind, startsOn, endsOn, reason, ...(attachment ? { attachment } : {}) };
      setSaved(await api('/leave-requests', LeaveRequest, { method: 'POST', body, schoolId, idempotencyKey: actionKey.current }));
      actionKey.current = null;
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Tidak tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    actionKey.current = null; // a different answer is a new request
    set(v);
  };

  if (saved) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Izin tercatat</h1>
        <p role="status" className={styles.notice}>
          {saved.student.name}: {LEAVE_KIND_LABELS[saved.kind]}, {dateRangeLabel(saved.startsOn, saved.endsOn)}. Status: {LEAVE_STATUS_LABELS[saved.status]}.
          {saved.status === 'approved' ? ' Presensi siswa ini terisi otomatis.' : ' Menunggu persetujuan wali kelas.'}
        </p>
        <Link className={styles.back} href="/izin">
          ← Daftar izin
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/izin">
        ← Izin siswa
      </Link>
      <h1 className={styles.title}>Catat izin</h1>
      <form className={forms.form} onSubmit={(e) => void submit(e)}>
        <label className={forms.field}>
          <span className={forms.label}>Siswa</span>
          <Select required value={enrollmentId} onChange={(e) => change(setEnrollmentId)(e.target.value)}>
            <option value="">{students ? 'Pilih siswa' : 'Memuat…'}</option>
            {students?.map((s) => (
              <option key={s.enrollmentId} value={s.enrollmentId}>
                {s.name} · {s.className}
              </option>
            ))}
          </Select>
        </label>
        <div className={ui.segment} role="group" aria-label="Jenis">
          {(['sakit', 'izin'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => change(setKind)(k)}>
              {LEAVE_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <div className={forms.field}>
          <span className={forms.label}>Tanggal izin</span>
          <DateRangeInput
            aria-label="Tanggal izin"
            required
            from={startsOn}
            to={endsOn}
            onChange={(from, to) => {
              change(setStartsOn)(from);
              setEndsOn(to);
            }}
          />
        </div>
        <label className={forms.field}>
          <span className={forms.label}>Alasan</span>
          <textarea className={ui.reason} required minLength={3} maxLength={500} value={reason} onChange={(e) => change(setReason)(e.target.value)} />
        </label>
        <label className={forms.field}>
          <span className={forms.label}>Surat atau foto (opsional)</span>
          <input className={forms.input} type="file" accept={LEAVE_ATTACHMENT_TYPES.join(',')} onChange={(e) => change(setFile)(e.target.files?.[0] ?? null)} />
          <span className={forms.hint}>Foto atau PDF, maksimal 5 MB.</span>
        </label>
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !enrollmentId}>
          {busy ? 'Menyimpan…' : 'Simpan izin'}
        </Button>
      </form>
    </main>
  );
}
