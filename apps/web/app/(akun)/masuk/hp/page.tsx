'use client';

import { Button } from '@absah/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthError, normalizePhone, sendPhoneOtp, verifyPhoneOtp } from '@/lib/auth';
import styles from '../../../forms.module.css';

/** Only same-site paths, so ?lanjut= cannot send people elsewhere. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/portal';
}

/** WhatsApp OTP login for siswa (and later orang tua): number -> 6-digit code (ORT-02). */
function PhoneSignIn() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('lanjut'));
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (!phone) {
        const number = normalizePhone(String(data.get('phone')));
        if (!/^\+628\d{7,12}$/.test(number)) throw new AuthError('Tulis nomor WhatsApp, misalnya 0812 3456 7890.');
        await sendPhoneOtp(number);
        setPhone(number);
      } else {
        await verifyPhoneOtp(phone, String(data.get('code')).replace(/\s/g, ''));
        router.replace(next);
      }
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Tidak bisa terhubung. Periksa internet lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1>Masuk dengan WhatsApp</h1>
      <form className={styles.form} onSubmit={(e) => void submit(e)}>
        {!phone ? (
          <label className={styles.field}>
            <span className={styles.label}>Nomor WhatsApp</span>
            <input className={styles.input} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" required />
          </label>
        ) : (
          <>
            <p>Kode 6 angka dikirim ke WhatsApp {phone.slice(0, 6)}****{phone.slice(-4)} bila nomor ini terdaftar di sekolah.</p>
            <label className={styles.field}>
              <span className={styles.label}>Kode dari WhatsApp</span>
              <input className={styles.input} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required />
            </label>
          </>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {phone ? 'Masuk' : 'Kirim kode'}
        </Button>
        {phone && (
          <Button type="button" variant="secondary" onClick={() => setPhone(null)}>
            Ganti nomor
          </Button>
        )}
      </form>
      <p>
        Guru dan staf: <Link href="/masuk">masuk dengan email</Link>.
      </p>
    </main>
  );
}

export default function PhoneSignInPage() {
  return (
    <Suspense fallback={<p role="status">Memuat…</p>}>
      <PhoneSignIn />
    </Suspense>
  );
}
