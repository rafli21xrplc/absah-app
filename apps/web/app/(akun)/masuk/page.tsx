'use client';

import { Button } from '@absah/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthError, signInWithPassword, verifyTotp } from '@/lib/auth';
import styles from '../../forms.module.css';

/** Only same-site paths, so ?lanjut= cannot send people elsewhere. */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function SignIn() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('lanjut'));
  const [step, setStep] = useState<'password' | 'totp'>('password');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      if (step === 'password') {
        const result = await signInWithPassword(String(data.get('email')), String(data.get('password')));
        if (result === 'two_factor') {
          setStep('totp');
          return;
        }
      } else {
        await verifyTotp(String(data.get('code')).replace(/\s/g, ''));
      }
      router.replace(next);
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Tidak bisa terhubung. Periksa internet lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1>Masuk</h1>
      <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate={false}>
        {step === 'password' ? (
          <>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input className={styles.input} name="email" type="email" autoComplete="username" required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Kata sandi</span>
              <input className={styles.input} name="password" type="password" autoComplete="current-password" required />
            </label>
          </>
        ) : (
          <label className={styles.field}>
            <span className={styles.label}>Kode dari aplikasi autentikator</span>
            <input
              className={styles.input}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              required
              autoFocus
            />
          </label>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {step === 'password' ? 'Masuk' : 'Verifikasi'}
        </Button>
      </form>
      <p>
        Siswa: <Link href="/masuk/hp">masuk dengan WhatsApp</Link>.
      </p>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
