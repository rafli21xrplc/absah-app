'use client';

import { CollectionDashboardList, PrincipalDashboard } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { barWidth, DASHBOARD_READERS, kindsLine, mbgLine, sessionsLine } from '@/lib/dashboard';
import { percent } from '@/lib/report';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';

const shortDate = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

/** Dasbor kepala sekolah (RKP-05): the school at a glance, today. Each part links to the report it summarises. */
export default function DasborPage() {
  const { schoolId, hasRole } = useWorkspace();
  const allowed = hasRole(...DASHBOARD_READERS);
  const [data, setData] = useState<PrincipalDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foundation, setFoundation] = useState(false);

  useEffect(() => {
    if (!schoolId || !allowed) return;
    api('/dashboard/principal', PrincipalDashboard, { schoolId })
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Dasbor belum bisa dimuat.'));
    // The yayasan link only shows for people who lead schools of a collection.
    api('/dashboard/collections', CollectionDashboardList)
      .then((r) => setFoundation(r.items.length > 0))
      .catch(() => undefined);
  }, [schoolId, allowed]);

  if (!allowed) {
    return (
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Dasbor</h1>
        <p role="alert">Dasbor ini untuk kepala sekolah, wakil kepala sekolah, dan admin.</p>
      </main>
    );
  }

  const today = data?.attendance.today;
  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Dasbor kepala sekolah</h1>
      {foundation && (
        <p>
          <Link href="/dasbor/yayasan">Lihat dasbor yayasan (semua sekolah) →</Link>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Memuat…</p>}
      {data && today && (
        <>
          <div className={styles.counts}>
            <Link className={styles.count} href="/rekap">
              <span>Kehadiran hari ini</span>
              <strong>{percent(today.presentRate)}</strong>
              <small>{today.days === 0 ? 'Belum ada presensi' : `${today.counts.H + today.counts.T} dari ${today.days} siswa`}</small>
            </Link>
            <Link className={styles.count} href="/rekap/kepatuhan">
              <span>Pengisian sesi</span>
              <strong>{percent(data.sessions.fillRate)}</strong>
              <small>{sessionsLine(data.sessions)}</small>
            </Link>
            {data.atRisk && (
              <Link className={styles.count} href="/peringatan-dini">
                <span>Siswa berisiko (7 hari)</span>
                <strong>{data.atRisk.students}</strong>
                <small>peringatan dini</small>
              </Link>
            )}
            {data.mbg && (
              <Link className={styles.count} href="/mbg">
                <span>MBG hari ini</span>
                <strong>{data.mbg.status === 'not_school_day' ? '–' : data.mbg.present}</strong>
                <small>{mbgLine(data.mbg)}</small>
              </Link>
            )}
          </div>

          <section className={styles.section} aria-labelledby="tren">
            <h2 id="tren">Kehadiran {data.attendance.trend.length} hari sekolah terakhir</h2>
            {data.attendance.trend.length === 0 ? (
              <p className={styles.empty}>Belum ada rekap kehadiran.</p>
            ) : (
              <ul className={styles.trend}>
                {data.attendance.trend.map((p) => (
                  <li key={p.date}>
                    <span>{shortDate(p.date)}</span>
                    <span className={styles.bar} role="img" aria-label={`Kehadiran ${shortDate(p.date)}: ${percent(p.presentRate)}`}>
                      <span style={{ width: `${barWidth(p.presentRate)}%` }} />
                    </span>
                    <span className={styles.num}>{percent(p.presentRate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.atRisk && (
            <section className={styles.section} aria-labelledby="berisiko">
              <h2 id="berisiko">Siswa yang perlu perhatian</h2>
              {data.atRisk.items.length === 0 ? (
                <p className={styles.empty}>Tidak ada peringatan dini dalam 7 hari terakhir.</p>
              ) : (
                <ul className={styles.risk}>
                  {data.atRisk.items.map((s) => (
                    <li key={s.enrollmentId}>
                      <strong>{s.name}</strong> · {s.className}
                      <br />
                      <small className={styles.muted}>
                        {kindsLine(s.kinds)} · terakhir {shortDate(s.lastDate)}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
              {data.atRisk.students > data.atRisk.items.length && (
                <p>
                  <Link href="/peringatan-dini">Lihat semua {data.atRisk.students} siswa →</Link>
                </p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
