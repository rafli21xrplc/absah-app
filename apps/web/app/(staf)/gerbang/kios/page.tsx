'use client';

import { KIOSK_PAIRING_TTL_MINUTES, KioskDevice, KioskDeviceList, KioskPairing } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { agoLabel, timeIn } from '@/lib/gate';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import ui from '../../presensi.module.css';
import gate from '../gerbang.module.css';

const REFRESH_MS = 30_000;

/** Kiosk devices (GRB-02): one-time pairing code as QR + text, status from heartbeats, revoke. */
export default function KiosPage() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [kiosks, setKiosks] = useState<KioskDevice[] | null>(null);
  const [pairing, setPairing] = useState<(KioskPairing & { qr: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => api('/gate/kiosks', KioskDeviceList, { schoolId }).then((r) => r.items), [schoolId]);
  useEffect(() => {
    if (!schoolId) return;
    const refresh = () =>
      load()
        .then(setKiosks)
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat kios.'));
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [schoolId, load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak tersimpan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  const createPairing = () =>
    run(async () => {
      const p = await api('/gate/kiosks/pairings', KioskPairing, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey() });
      setPairing({ ...p, qr: await QRCode.toDataURL(p.pairingCode, { margin: 1, width: 480 }) });
    });

  const revoke = (k: KioskDevice) =>
    run(async () => {
      if (!window.confirm(`Cabut kios "${k.name}"? Kios itu langsung berhenti menerima scan.`)) return;
      await api(`/gate/kiosks/${k.id}/revoke`, KioskDevice, { method: 'POST', schoolId, idempotencyKey: newIdempotencyKey() });
      setKiosks(await load());
    });

  const active = kiosks?.filter((k) => !k.revokedAt) ?? [];
  return (
    <IfCap name="gate.enabled" fallback={<p className={styles.main}>Presensi gerbang belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/gerbang">
          ← Gerbang
        </Link>
        <h1 className={styles.title}>Kios gerbang</h1>
        <p className={styles.muted}>Buka aplikasi kios di tablet gerbang, lalu pindai QR atau ketik kode pasang di bawah.</p>
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy} onClick={() => void createPairing()}>
          Buat kode pasang
        </Button>
        {pairing && (
          <section className={gate.pairing} aria-label="Kode pasang">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, nothing to optimize */}
            <img className={gate.qr} src={pairing.qr} alt="QR kode pasang kios" />
            <span className={gate.code} data-testid="pairing-code">
              {pairing.pairingCode}
            </span>
            <span className={styles.muted}>
              Sekali pakai, berlaku {KIOSK_PAIRING_TTL_MINUTES} menit (sampai {timeIn(timezone, pairing.expiresAt)}).
            </span>
          </section>
        )}

        <section className={styles.section} aria-labelledby="daftar-kios">
          <h2 id="daftar-kios">Kios terpasang</h2>
          {kiosks && active.length === 0 && <p className={styles.muted}>Belum ada kios.</p>}
          <ul className={ui.sessions}>
            {active.map((k) => (
              <li key={k.id} className={ui.student} aria-label={`Kios ${k.name}`}>
                <span className={ui.studentName}>{k.name}</span>
                <span className={k.online ? styles.badgeOk : styles.badgeBad}>{k.online ? 'Online' : 'Offline'}</span>
                <span className={styles.muted}>
                  Terakhir terhubung {agoLabel(k.lastSeenAt)}
                  {k.lastQueueSize ? ` · antrean ${k.lastQueueSize}` : ''}
                  {k.appVersion ? ` · versi ${k.appVersion}` : ''}
                </span>
                <div className={styles.rowActions}>
                  <Button variant="secondary" disabled={busy} onClick={() => void revoke(k)}>
                    Cabut
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </IfCap>
  );
}
