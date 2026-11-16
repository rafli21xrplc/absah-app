'use client';

import { Button } from '@absah/ui';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AuthError, enableTwoFactor, verifyTotp } from '@/lib/auth';
import styles from '../../../forms.module.css';

type Enrollment = Awaited<ReturnType<typeof enableTwoFactor>>;

/** TOTP enrollment, required for admin and operator before they can act in a school (PLT-01). */
export default function TwoFactorPage() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<void>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action(new FormData(event.currentTarget));
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Tidak bisa terhubung. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1>Verifikasi dua langkah</h1>
      {!enrollment ? (
        <form
          className={styles.form}
          onSubmit={(e) => void run(e, async (d) => setEnrollment(await enableTwoFactor(String(d.get('password')))))}
        >
          <p className={styles.hint}>
            Admin dan operator wajib memakai kode dari aplikasi autentikator (Google Authenticator, Authy, atau sejenisnya).
          </p>
          <label className={styles.field}>
            <span className={styles.label}>Kata sandi Anda</span>
            <input className={styles.input} name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" disabled={busy}>
            Lanjut
          </Button>
        </form>
      ) : (
        <form
          className={styles.form}
          onSubmit={(e) =>
            void run(e, async (d) => {
              await verifyTotp(String(d.get('code')).replace(/\s/g, ''));
              router.replace('/');
            })
          }
        >
          <p>Tambahkan akun di aplikasi autentikator dengan kunci ini:</p>
          <code className={styles.code} data-testid="totp-secret">
            {enrollment.secret}
          </code>
          <a href={enrollment.uri}>Buka di aplikasi autentikator (di HP ini)</a>
          {enrollment.backupCodes.length > 0 && (
            <>
              <p className={styles.hint}>Simpan kode cadangan ini di tempat aman. Tiap kode hanya bisa dipakai sekali.</p>
              <ul className={styles.backup}>
                {enrollment.backupCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
          <label className={styles.field}>
            <span className={styles.label}>Kode 6 angka dari aplikasi</span>
            <input className={styles.input} name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <Button type="submit" disabled={busy}>
            Aktifkan
          </Button>
        </form>
      )}
    </main>
  );
}
