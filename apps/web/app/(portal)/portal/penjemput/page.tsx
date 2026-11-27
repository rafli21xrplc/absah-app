'use client';

import { CreatePickupPhotoResponse, PickupGuardian, PickupGuardianList, PortalAttendance, type PickupRelation } from '@absah/contracts';
import { Button, DateInput, Input, Select } from '@absah/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError, newIdempotencyKey } from '@/lib/api';
import { normalizePhone } from '@/lib/auth';
import { IfCap } from '@/lib/capabilities';
import { GUARDIAN_STATUS_LABELS, putPhoto, RELATION_LABELS, RELATIONS, toJpeg } from '@/lib/pickup';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../portal.module.css';

/**
 * GRB-09: parents name who may take their child home. Each penjemput needs a photo (the kiosk shows
 * it at the gate) and waits for the wali kelas to approve.
 */
export default function PortalPenjemput() {
  const { schoolId, hasRole } = useWorkspace();
  const isParent = hasRole('orang_tua');
  const [children, setChildren] = useState<PortalAttendance['items'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !isParent) return;
    api('/portal/attendance', PortalAttendance, { schoolId })
      .then((d) => setChildren(d.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat data anak.'));
  }, [schoolId, isParent]);

  return (
    <main className={styles.main}>
      <Link href="/portal">← Portal</Link>
      <h1 className={styles.title}>Penjemput anak</h1>
      <IfCap name="gate.pickup" fallback={<p>Sekolah belum memakai penjemputan resmi.</p>}>
        {!isParent && <p>Halaman ini untuk orang tua.</p>}
        {error && <p role="alert">{error}</p>}
        {isParent && !children && !error && <p role="status">Memuat…</p>}
        {children?.length === 0 && <p>Belum ada anak yang terdaftar.</p>}
        {schoolId && children?.map((c) => <ChildPickups key={c.studentId} schoolId={schoolId} studentId={c.studentId} name={c.name} />)}
      </IfCap>
    </main>
  );
}

function ChildPickups({ schoolId, studentId, name }: { schoolId: string; studentId: string; name: string }) {
  const [items, setItems] = useState<PickupGuardian[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api(`/students/${studentId}/pickup-guardians`, PickupGuardianList, { schoolId })
      .then((l) => setItems(l.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat penjemput.'));
  }, [schoolId, studentId]);
  useEffect(load, [load]);

  async function deactivate(id: string) {
    setError(null);
    try {
      await api(`/pickup-guardians/${id}/deactivate`, PickupGuardian, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey() });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak tersimpan. Coba lagi.');
    }
  }

  const open = items?.filter((g) => g.status === 'pending' || g.status === 'approved') ?? [];
  return (
    <section className={styles.card} aria-label={`Penjemput ${name}`}>
      <h2>{name}</h2>
      {error && <p role="alert">{error}</p>}
      {items && open.length === 0 && <p className={styles.muted}>Belum ada penjemput terdaftar.</p>}
      {open.length > 0 && (
        <ul className={styles.list} aria-label="Daftar penjemput">
          {open.map((g) => (
            <li key={g.id}>
              <span>
                {g.name} · {RELATION_LABELS[g.relation]}
                <br />
                <small className={styles.muted}>{GUARDIAN_STATUS_LABELS[g.status]}</small>
              </span>
              <Button variant="secondary" onClick={() => void deactivate(g.id)}>
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddPickup
          schoolId={schoolId}
          studentId={studentId}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      ) : (
        <div className={styles.actions}>
          <Button onClick={() => setAdding(true)}>Tambah penjemput</Button>
        </div>
      )}
    </section>
  );
}

function AddPickup({ schoolId, studentId, onDone }: { schoolId: string; studentId: string; onDone: () => void }) {
  const [relation, setRelation] = useState<PickupRelation>('ayah');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [key] = useState(newIdempotencyKey);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('photo');
    if (!(file instanceof Blob) || file.size === 0) {
      setError(new Error('Ambil atau pilih foto penjemput.'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const photo = await toJpeg(file);
      const upload = await api('/pickup-guardian-photos', CreatePickupPhotoResponse, {
        method: 'POST',
        schoolId,
        idempotencyKey: newIdempotencyKey(),
        body: { studentId, fileSize: photo.size, contentType: 'image/jpeg' },
      });
      await putPhoto(upload.upload, photo);
      const validUntil = String(data.get('validUntil') ?? '');
      await api(`/students/${studentId}/pickup-guardians`, PickupGuardian, {
        method: 'POST',
        schoolId,
        idempotencyKey: key,
        body: { name: String(data.get('name') ?? ''), relation, phone: normalizePhone(String(data.get('phone') ?? '')), photoId: upload.photoId, ...(validUntil ? { validUntil } : {}) },
      });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const message = error instanceof ApiError ? (fieldError(error, 'phone') ? 'Nomor WhatsApp harus diawali 08 atau +628.' : (fieldError(error, 'name') ?? error.message)) : error instanceof Error ? (error.message.startsWith('upload_') || error.message === 'jpeg_failed' ? 'Foto tidak terunggah. Coba ambil ulang.' : error.message) : null;
  return (
    <form className={forms.form} onSubmit={(e) => void submit(e)}>
      <label className={forms.field}>
        <span className={forms.label}>Nama penjemput</span>
        <Input name="name" required maxLength={100} autoComplete="off" />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Hubungan</span>
        <Select value={relation} onChange={(e) => setRelation(e.target.value as PickupRelation)}>
          {RELATIONS.map((r) => (
            <option key={r} value={r}>
              {RELATION_LABELS[r]}
            </option>
          ))}
        </Select>
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Nomor WhatsApp penjemput</span>
        <Input name="phone" type="tel" inputMode="tel" required placeholder="0812 3456 7890" autoComplete="off" />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Foto wajah penjemput</span>
        <input className={forms.input} name="photo" type="file" accept="image/*" capture="user" required />
      </label>
      <label className={forms.field}>
        <span className={forms.label}>Berlaku sampai (kosongkan bila tetap)</span>
        <DateInput name="validUntil" type="date" />
      </label>
      {message && (
        <p className={forms.error} role="alert">
          {message}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'Mengirim…' : 'Kirim untuk disetujui'}
      </Button>
    </form>
  );
}
