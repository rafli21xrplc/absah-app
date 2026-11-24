'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from '@/app/page.module.css';
import { EMPTY_FORM, newAttempt, validateVisitor, visitorError, type Attempt, type VisitorForm } from '@/lib/visitors';
import { PhotoCapture } from './photo-capture';

export interface Host {
  id: string;
  name: string;
}
type Register = (form: VisitorForm, photo: Blob | null, attempt: Attempt) => Promise<void>;

const THANKS_MS = 5_000;

/** Buku tamu (GRB-11): a guest types who they are and why they came; the person they came for is told. */
export function VisitorScreen({ hosts, register, onClose }: { hosts: Host[]; register: Register; onClose: () => void }) {
  const [form, setForm] = useState<VisitorForm>(EMPTY_FORM);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  // The same ids until the visit went through, so a retry never records two visits.
  const attempt = useRef<Attempt>(newAttempt());

  const edit = (patch: Partial<VisitorForm>) => {
    attempt.current = newAttempt(); // other content = another visit; a resend keeps the form as it was
    setForm((f) => ({ ...f, ...patch }));
  };

  useEffect(() => {
    if (!thanks) return;
    const timer = setTimeout(onClose, THANKS_MS);
    return () => clearTimeout(timer);
  }, [thanks, onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateVisitor(form);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await register(form, photo, attempt.current);
      const host = hosts.find((h) => h.id === form.hostUserId);
      setThanks(host ? `Terima kasih. ${host.name} sudah diberi tahu.` : 'Terima kasih. Silakan lapor ke guru piket.');
    } catch (err) {
      setError(visitorError(err));
    } finally {
      setBusy(false);
    }
  };

  if (thanks) {
    return (
      <main className={styles.screen}>
        <div>
          <h1 className={styles.title}>Selamat datang</h1>
          <p className={styles.hint} role="status">
            {thanks}
          </p>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Selesai
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <form className={styles.pair} onSubmit={(e) => void submit(e)}>
        <h1 className={styles.title}>Buku tamu</h1>
        <label className={styles.field}>
          Nama
          <input value={form.name} onChange={(e) => edit({ name: e.target.value })} maxLength={100} autoComplete="off" />
        </label>
        <label className={styles.field}>
          Instansi (boleh dikosongkan)
          <input value={form.organization} onChange={(e) => edit({ organization: e.target.value })} maxLength={100} autoComplete="off" />
        </label>
        <label className={styles.field}>
          Tujuan kunjungan
          <input value={form.purpose} onChange={(e) => edit({ purpose: e.target.value })} maxLength={200} autoComplete="off" />
        </label>
        <label className={styles.field}>
          Bertemu dengan (boleh dikosongkan)
          <select value={form.hostUserId} onChange={(e) => edit({ hostUserId: e.target.value })}>
            <option value="">Tidak menyebut nama</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <PhotoCapture photo={photo} onPhoto={setPhoto} />
        {error ? (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? 'Mengirim…' : 'Kirim'}
        </button>
        <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>
          Batal
        </button>
      </form>
    </main>
  );
}
