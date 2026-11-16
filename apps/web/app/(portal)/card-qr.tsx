'use client';

import type { CardDeviceKeys } from '@absah/contracts';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { cardTokenAt, lastKeyDate, secondsLeft } from '@/lib/card';
import styles from './portal.module.css';

/**
 * The card QR, redrawn each 30-second window from the day keys on the phone (works offline).
 * A one-second tick only updates the countdown; the QR image changes once per window.
 */
export function CardQr({ keys, name }: { keys: CardDeviceKeys; name: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [qr, setQr] = useState<{ window: number; src: string | null } | null>(null);
  const window = Math.floor(now / 30_000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await cardTokenAt(keys, Date.now());
      const src = token ? await QRCode.toDataURL(token, { margin: 2, width: 320, errorCorrectionLevel: 'M' }) : null;
      if (!cancelled) setQr({ window, src });
    })();
    return () => {
      cancelled = true;
    };
  }, [keys, window]);

  if (qr && !qr.src) {
    return (
      <p role="alert">
        Kartu perlu diperbarui. Sambungkan HP ke internet lalu buka halaman ini lagi.
      </p>
    );
  }
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimize */}
      {qr?.src ? <img className={styles.qr} src={qr.src} alt={`Kartu ${name}`} data-testid="card-qr" /> : <p role="status">Menyiapkan kartu…</p>}
      <p className={styles.muted}>
        Tunjukkan ke kios gerbang. Kode berganti dalam {secondsLeft(now)} detik. Berlaku tanpa internet sampai {lastKeyDate(keys) ?? '-'}.
      </p>
    </div>
  );
}
