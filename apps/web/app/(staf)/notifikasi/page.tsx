'use client';

import { LoadingState } from '@absah/ui';
import { NOTIFICATION_STATUSES, NotificationOverview } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { timeIn } from '@/lib/gate';
import { errorLabel, STATUS_LABELS, TEMPLATE_LABELS } from '@/lib/notify';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import ui from '../presensi.module.css';

const dayIn = (timezone: string, iso: string) => new Intl.DateTimeFormat('id-ID', { timeZone: timezone, day: 'numeric', month: 'short' }).format(new Date(iso));

/** WhatsApp delivery for admins (NTF): today's counts and messages that did not arrive. */
export default function NotifikasiPage() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const [overview, setOverview] = useState<NotificationOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/notifications/overview', NotificationOverview, { schoolId })
      .then(setOverview)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat status notifikasi.'));
  }, [schoolId]);

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Notifikasi WhatsApp</h1>
      <p className={styles.muted}>Pesan ke orang tua: alpa dan keputusan izin. Pesan setelah pukul 21.00 dikirim pukul 06.00.</p>
      {error && <p role="alert">{error}</p>}
      {!overview && !error && <LoadingState variant="cards" />}
      {overview && (
        <>
          <div className={styles.counts} aria-label="Hari ini">
            {NOTIFICATION_STATUSES.map((s) => (
              <p key={s} className={styles.count}>
                <strong>{overview.counts[s] ?? 0}</strong> {STATUS_LABELS[s].toLowerCase()}
              </p>
            ))}
          </div>
          <section className={styles.section} aria-labelledby="gagal">
            <h2 id="gagal">Gagal terkirim (7 hari)</h2>
            {overview.failed.length === 0 ? (
              <p className={styles.muted}>Tidak ada pesan gagal.</p>
            ) : (
              <ul className={ui.sessions}>
                {overview.failed.map((f) => (
                  <li key={f.id} className={ui.student}>
                    <span className={ui.studentName}>
                      {TEMPLATE_LABELS[f.templateCode]}
                      {f.studentName ? ` · ${f.studentName}` : ''}
                    </span>
                    <span>
                      {f.recipient} · {dayIn(timezone, f.createdAt)} {timeIn(timezone, f.createdAt)}
                    </span>
                    <span className={styles.badgeBad}>
                      {errorLabel(f.lastError)} · {f.attempts}× dicoba
                    </span>
                    <span className={styles.muted}>Kode: {f.lastError ?? '-'}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.muted}>Hubungi orang tua lewat telepon bila pesannya penting.</p>
          </section>
        </>
      )}
    </main>
  );
}
