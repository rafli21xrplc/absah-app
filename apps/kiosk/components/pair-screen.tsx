'use client';

import { useState, type FormEvent } from 'react';
import { KioskApiError } from '@/lib/kiosk-api';
import styles from '@/app/page.module.css';
import { Camera } from './camera';

type Pair = (input: { pairingCode: string; name: string; idempotencyKey: string }) => Promise<void>;

/** Pairing with the one-time code from the admin page (QR or typed), GRB-02. */
export function PairScreen({ pair, revoked }: { pair: Pair; revoked: boolean }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('Gerbang depan');
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per code: a retry after a lost answer gets the same device token back.
  const [attempt, setAttempt] = useState(() => ({ code: '', key: crypto.randomUUID() }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const key = attempt.code === code ? attempt.key : crypto.randomUUID();
    setAttempt({ code, key });
    setBusy(true);
    setError(null);
    try {
      await pair({ pairingCode: code, name, idempotencyKey: key });
    } catch (err) {
      if (err instanceof KioskApiError) setError(err.status === 404 ? 'Kode tidak berlaku. Minta kode baru ke admin.' : err.message);
      else setError('Tidak ada koneksi. Pemasangan perlu internet.');
    } finally {
      setBusy(false);
    }
  };

  const scanned = (text: string) => {
    setCode(text.trim());
    setCamera(false);
  };

  return (
    <main className={styles.screen}>
      <form className={styles.pair} onSubmit={(e) => void submit(e)}>
        <h1 className={styles.title}>Pasang kios</h1>
        {revoked ? <p className={styles.alert}>Kios ini dicabut oleh admin. Pasang ulang dengan kode baru.</p> : null}
        <p className={styles.hint}>Admin membuka Pengaturan → Kios gerbang lalu membuat kode pasang.</p>
        {camera ? <Camera onCode={scanned} className={styles.pairCamera} /> : null}
        <label className={styles.field}>
          Kode pasang
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} required />
        </label>
        <button type="button" className={styles.secondary} onClick={() => setCamera((v) => !v)}>
          {camera ? 'Tutup kamera' : 'Pindai QR kode pasang'}
        </button>
        <label className={styles.field}>
          Nama kios
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        </label>
        {error ? (
          <p role="alert" className={styles.alert}>
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? 'Memasang…' : 'Pasang'}
        </button>
      </form>
    </main>
  );
}
