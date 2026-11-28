'use client';

import { AcceptInvitationResponse, InvitationPreviewResponse } from '@absah/contracts';
import { Button, Input, LoadingState } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, fieldError } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/roles';
import styles from '../../forms.module.css';

type Preview = InvitationPreviewResponse;

/** Invitation link /undangan#<token>: the token stays in the fragment and goes out in a POST body. */
export default function InvitationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [accepted, setAccepted] = useState<AcceptInvitationResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const value = window.location.hash.slice(1);
    // Drop the token from the address bar and history once read.
    window.history.replaceState(null, '', window.location.pathname);
    const load = value
      ? api('/invitations/preview', InvitationPreviewResponse, { method: 'POST', body: { token: value } })
      : Promise.reject(new Error('Tautan undangan tidak lengkap. Buka lagi tautan dari admin sekolah.'));
    load
      .then((result) => {
        setToken(value);
        setPreview(result);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Tidak bisa memuat undangan.'));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !preview) return;
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    setBusy(true);
    setPasswordError(undefined);
    try {
      const body = preview.needsPassword ? { token, password } : { token };
      setAccepted(await api('/invitations/accept', AcceptInvitationResponse, { method: 'POST', body }));
    } catch (err) {
      const message = fieldError(err, 'password');
      if (message) setPasswordError(message);
      else setError(err instanceof ApiError ? err.message : 'Tidak bisa terhubung. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  if (accepted) {
    return (
      <main className={styles.page}>
        <h1>Selamat bergabung</h1>
        <p>Anda sekarang anggota {accepted.schoolName}.</p>
        {accepted.loginMethod === 'password' ? (
          <Link href="/masuk">Masuk sekarang</Link>
        ) : (
          <p className={styles.hint}>Masuk lewat aplikasi Absah dengan kode WhatsApp ke nomor Anda.</p>
        )}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1>Undangan</h1>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!error && !preview && <LoadingState variant="detail" label="Memuat undangan" />}
      {preview && (
        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          <p>
            Halo {preview.name}, Anda diundang ke <strong>{preview.schoolName}</strong> sebagai{' '}
            <strong>{ROLE_LABELS[preview.role]}</strong>.
          </p>
          {preview.needsPassword && (
            <label className={styles.field}>
              <span className={styles.label}>Buat kata sandi</span>
              <Input name="password" type="password" autoComplete="new-password" minLength={10} required />
              <span className={styles.hint}>Minimal 10 karakter.</span>
              {passwordError && <span className={styles.error}>{passwordError}</span>}
            </label>
          )}
          <Button type="submit" disabled={busy}>
            Terima undangan
          </Button>
        </form>
      )}
    </main>
  );
}
