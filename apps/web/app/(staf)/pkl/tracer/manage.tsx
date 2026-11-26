'use client';

import { AlumniFromClassResult, InviteTracerResult, TracerAlumnus, type TracerClassList } from '@absah/contracts';
import { Button, Input, Select } from '@absah/ui';
import { useRef, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { normalizePhone } from '@/lib/auth';
import { answerRequest, inviteSummary, ORGANIZATION_LABELS, POSITION_LABELS, STREAM_OPTIONS, TRACER_STATUS_LABELS, TRACER_STATUSES } from '@/lib/tracer';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';

const failure = (err: unknown) => (err instanceof ApiError ? err.message : 'Belum terkirim. Periksa sinyal, lalu coba lagi.');

/** One Idempotency-Key per action: kept after a lost reply, dropped once the API answered. */
function useActionKey() {
  const key = useRef<string | null>(null);
  return {
    take: () => (key.current ??= newIdempotencyKey()),
    done: (err?: unknown) => {
      if (!err || err instanceof ApiError) key.current = null;
    },
  };
}

const thisYear = new Date().getFullYear();

/** Adds alumni (by hand, or a whole rombel) and sends the WhatsApp invitations. Managers only. */
export function ManagePanel({ schoolId, classes, years, onChanged }: { schoolId: string; classes: TracerClassList['items']; years: number[]; onChanged: () => void }) {
  return (
    <section className={styles.section} aria-labelledby="kelola">
      <h2 id="kelola">Kelola alumni</h2>
      <AddAlumnus schoolId={schoolId} onChanged={onChanged} />
      <CopyClass schoolId={schoolId} classes={classes} onChanged={onChanged} />
      <InviteYear schoolId={schoolId} years={years} onChanged={onChanged} />
    </section>
  );
}

function AddAlumnus({ schoolId, onChanged }: { schoolId: string; onChanged: () => void }) {
  const action = useActionKey();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const phone = String(data.get('phone') ?? '').trim();
    const nisn = String(data.get('nisn') ?? '').trim();
    const stream = String(data.get('stream') ?? '');
    setBusy(true);
    setMessage(null);
    try {
      await api('/tracer/alumni', TracerAlumnus, {
        method: 'POST',
        schoolId,
        idempotencyKey: action.take(),
        body: { name: String(data.get('name')), graduationYear: Number(data.get('year')), ...(nisn ? { nisn } : {}), ...(stream ? { stream } : {}), ...(phone ? { phoneNumber: normalizePhone(phone) } : {}) },
      });
      action.done();
      form.reset();
      setMessage({ ok: true, text: 'Alumni ditambahkan.' });
      onChanged();
    } catch (err) {
      action.done(err);
      setMessage({ ok: false, text: err instanceof ApiError ? (fieldError(err, 'name') ?? fieldError(err, 'nisn') ?? fieldError(err, 'phoneNumber') ?? err.message) : failure(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={forms.form} onSubmit={(e) => void submit(e)} aria-label="Tambah alumni">
      <h3>Tambah satu alumni</h3>
      <label className={forms.field}>
        <span className={forms.label}>Nama</span>
        <Input name="name" required minLength={2} maxLength={100} />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Angkatan (tahun lulus)</span>
        <Input name="year" type="number" min={1990} max={2100} defaultValue={thisYear} required />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Jurusan (boleh kosong)</span>
        <Select name="stream" defaultValue="">
          <option value="">Tidak ada</option>
          {STREAM_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </label>
      <label className={forms.field}>
        <span className={forms.label}>NISN (boleh kosong)</span>
        <Input name="nisn" inputMode="numeric" maxLength={10} />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Nomor WhatsApp (untuk undangan)</span>
        <Input name="phone" type="tel" inputMode="tel" placeholder="0812…" />
      </label>
      <Message message={message} />
      <Button type="submit" disabled={busy}>
        {busy ? 'Menyimpan…' : 'Tambah alumni'}
      </Button>
    </form>
  );
}

function CopyClass({ schoolId, classes, onChanged }: { schoolId: string; classes: TracerClassList['items']; onChanged: () => void }) {
  const action = useActionKey();
  const [classId, setClassId] = useState('');
  const [year, setYear] = useState(thisYear);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await api('/tracer/alumni/from-class', AlumniFromClassResult, { method: 'POST', schoolId, idempotencyKey: action.take(), body: { classId, graduationYear: year } });
      action.done();
      setMessage({ ok: true, text: `${r.added} alumni ditambahkan${r.skipped > 0 ? `, ${r.skipped} sudah ada` : ''}.` });
      onChanged();
    } catch (err) {
      action.done(err);
      setMessage({ ok: false, text: failure(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={forms.form} onSubmit={(e) => void submit(e)} aria-label="Salin dari rombel">
      <h3>Salin dari rombel</h3>
      <label className={forms.field}>
        <span className={forms.label}>Rombel</span>
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} required>
          <option value="">Pilih rombel…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.activeStudents} siswa)
            </option>
          ))}
        </Select>
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Angkatan (tahun lulus)</span>
        <Input type="number" min={1990} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} required />
      </label>
      <Message message={message} />
      <Button type="submit" disabled={busy || !classId}>
        {busy ? 'Menyalin…' : 'Salin siswa aktif'}
      </Button>
    </form>
  );
}

function InviteYear({ schoolId, years, onChanged }: { schoolId: string; years: number[]; onChanged: () => void }) {
  const action = useActionKey();
  const [year, setYear] = useState<number | ''>('');
  const [resend, setResend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (year === '') return;
    setBusy(true);
    setMessage(null);
    try {
      const r = await api('/tracer/invitations', InviteTracerResult, { method: 'POST', schoolId, idempotencyKey: action.take(), body: { graduationYear: year, resend } });
      action.done();
      setMessage({ ok: true, text: inviteSummary(r) });
      onChanged();
    } catch (err) {
      action.done(err);
      setMessage({ ok: false, text: failure(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={forms.form} onSubmit={(e) => void send(e)} aria-label="Kirim undangan">
      <h3>Kirim undangan lewat WhatsApp</h3>
      <p className={styles.muted}>Hanya alumni yang punya nomor WhatsApp. Satu alumni menerima satu undangan per hari.</p>
      <label className={forms.field}>
        <span className={forms.label}>Angkatan</span>
        <Select value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')} required>
          <option value="">Pilih angkatan…</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </label>
      <label>
        <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} /> Kirim juga ke yang sudah mengisi
      </label>
      <Message message={message} />
      <Button type="submit" disabled={busy || year === ''}>
        {busy ? 'Mengirim…' : 'Kirim undangan'}
      </Button>
    </form>
  );
}

/** The BKK enters or changes one alumnus's answer by hand, or invites just this person. */
export function AlumnusActions({ schoolId, alumnus, onChanged }: { schoolId: string; alumnus: TracerAlumnus; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string>(alumnus.response?.status ?? '');
  const [organization, setOrganization] = useState(alumnus.response?.organization ?? '');
  const [position, setPosition] = useState(alumnus.response?.position ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = useActionKey();
  const invite = useActionKey();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const request = answerRequest(status, organization, position);
    if ('error' in request) {
      setMessage({ ok: false, text: request.error });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api(`/tracer/alumni/${alumnus.id}/response`, TracerAlumnus, { method: 'PUT', schoolId, idempotencyKey: save.take(), body: request.body });
      save.done();
      setOpen(false);
      onChanged();
    } catch (err) {
      save.done(err);
      setMessage({ ok: false, text: err instanceof ApiError ? (fieldError(err, 'organization') ?? err.message) : failure(err) });
    } finally {
      setBusy(false);
    }
  }

  async function inviteOne() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api('/tracer/invitations', InviteTracerResult, { method: 'POST', schoolId, idempotencyKey: invite.take(), body: { alumnusIds: [alumnus.id], resend: true } });
      invite.done();
      setMessage({ ok: true, text: r.queued > 0 ? 'Undangan dikirim.' : 'Alumni ini belum punya nomor WhatsApp.' });
    } catch (err) {
      invite.done(err);
      setMessage({ ok: false, text: failure(err) });
    } finally {
      setBusy(false);
    }
  }

  const named = status === 'bekerja' || status === 'melanjutkan' || status === 'wirausaha' ? status : null;
  return (
    <div>
      <div className={styles.rowActions}>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {alumnus.response ? 'Ubah jawaban' : 'Isi jawaban'}
        </Button>
        {alumnus.phone && (
          <Button variant="secondary" disabled={busy} onClick={() => void inviteOne()}>
            Undang
          </Button>
        )}
      </div>
      {open && (
        <form className={forms.form} onSubmit={(e) => void submit(e)} aria-label={`Jawaban ${alumnus.name}`}>
          <label className={forms.field}>
            <span className={forms.label}>Status</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} required>
              <option value="">Pilih status…</option>
              {TRACER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TRACER_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </label>
          {named && (
            <>
              <label className={forms.field}>
                <span className={forms.label}>{ORGANIZATION_LABELS[named]}</span>
                <Input value={organization} maxLength={120} onChange={(e) => setOrganization(e.target.value)} />
              </label>
              <label className={forms.field}>
                <span className={forms.label}>{POSITION_LABELS[named]}</span>
                <Input value={position} maxLength={120} onChange={(e) => setPosition(e.target.value)} />
              </label>
            </>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan jawaban'}
          </Button>
        </form>
      )}
      <Message message={message} />
    </div>
  );
}

function Message({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return message.ok ? <p role="status">{message.text}</p> : <p className={forms.error} role="alert">{message.text}</p>;
}
