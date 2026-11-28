'use client';

import { StudentContacts, type GuardianRelation } from '@absah/contracts';
import { Button, Input, LoadingState } from '@absah/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { normalizePhone } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';

const RELATION_LABELS: Record<GuardianRelation, string> = { ayah: 'Ayah', ibu: 'Ibu', wali: 'Wali' };

/**
 * WhatsApp numbers of one student (ORT-02, NTF): guardians receive messages and action links, and
 * with portal access log in to the Absah app as orang tua; the student's own number is their login. Numbers are shown masked; typing a new one
 * replaces it, an empty field leaves it unchanged. The student id is in the query, never a name.
 */
function ContactsView() {
  const studentId = useSearchParams().get('id') ?? '';
  const { schoolId } = useWorkspace();
  const [contacts, setContacts] = useState<StudentContacts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);

  useEffect(() => {
    if (!schoolId || !studentId) return;
    api(`/students/${studentId}/contacts`, StudentContacts, { schoolId })
      .then(setContacts)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat kontak.'));
  }, [schoolId, studentId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!schoolId || !contacts) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const typed = (name: string) => normalizePhone(String(data.get(name) ?? ''));
    type GuardianChange = { guardianId: string; phone?: string | null; portal?: boolean };
    const body: { studentPhone?: string | null; guardians?: GuardianChange[] } = {};
    if (typed('student')) body.studentPhone = typed('student');
    if (data.get('endStudent') === 'on') body.studentPhone = null;
    const guardians = contacts.guardians.flatMap((g): GuardianChange[] => {
      if (data.get(`clear-${g.id}`) === 'on') return [{ guardianId: g.id, phone: null }];
      const change: GuardianChange = { guardianId: g.id };
      const phone = typed(`guardian-${g.id}`);
      if (phone) change.phone = phone;
      const portal = data.get(`portal-${g.id}`) === 'on';
      if (portal !== g.portal) change.portal = portal;
      return Object.keys(change).length > 1 ? [change] : [];
    });
    if (guardians.length) body.guardians = guardians;
    if (Object.keys(body).length === 0) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      setContacts(await api(`/students/${studentId}/contacts`, StudentContacts, { method: 'PUT', body, schoolId, idempotencyKey: key }));
      setSaved(true);
      setKey(newIdempotencyKey());
      form.reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') setError('Periksa nomor WhatsApp: harus diawali 08 atau +628. Akses portal butuh nomor wali.');
      else setError(err instanceof ApiError ? err.message : 'Tidak tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/siswa">
        ← Data siswa
      </Link>
      <h1 className={styles.title}>Kontak WhatsApp</h1>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {!contacts && !error && <LoadingState />}
      {contacts && (
        <form className={forms.form} onSubmit={(e) => void save(e)} onChange={() => setKey(newIdempotencyKey())}>
          <p>
            <strong>{contacts.name}</strong> · {contacts.className ?? 'tanpa rombel'}
          </p>
          <fieldset className={styles.section}>
            <legend>Orang tua dan wali (menerima pesan dan tautan)</legend>
            {contacts.guardians.length === 0 && <p className={styles.muted}>Belum ada data wali. Wali ikut terisi dari import Dapodik.</p>}
            {contacts.guardians.map((g) => (
              // Keyed on the saved state: form.reset() must not bring back the previous portal tick.
              <div key={`${g.id}:${String(g.portal)}`}>
                <label className={forms.field}>
                  <span className={forms.label}>
                    {RELATION_LABELS[g.relation]}: {g.name} {g.phone ? `(sekarang ${g.phone})` : '(belum ada nomor)'}
                  </span>
                  <Input name={`guardian-${g.id}`} type="tel" inputMode="tel" placeholder="0812 3456 7890" autoComplete="off" />
                </label>
                <label>
                  <input type="checkbox" name={`portal-${g.id}`} defaultChecked={g.portal} /> Akses portal: {g.name} masuk ke aplikasi Absah dengan nomor ini
                </label>
                {g.phone && (
                  <label>
                    <input type="checkbox" name={`clear-${g.id}`} /> Hapus nomor {g.name}
                  </label>
                )}
              </div>
            ))}
          </fieldset>
          <fieldset className={styles.section}>
            <legend>Nomor siswa (masuk ke aplikasi Absah)</legend>
            <label className={forms.field}>
              <span className={forms.label}>
                WhatsApp siswa {contacts.account.phone ? `(sekarang ${contacts.account.phone}${contacts.account.active ? '' : ', tidak aktif'})` : '(belum ada)'}
              </span>
              <Input name="student" type="tel" inputMode="tel" placeholder="0812 3456 7890" autoComplete="off" />
            </label>
            {contacts.account.active && (
              <label>
                <input type="checkbox" name="endStudent" /> Hentikan akses siswa ke aplikasi
              </label>
            )}
          </fieldset>
          {saved && <p role="status">Kontak tersimpan.</p>}
          <Button type="submit" disabled={busy}>
            Simpan kontak
          </Button>
        </form>
      )}
    </main>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ContactsView />
    </Suspense>
  );
}
