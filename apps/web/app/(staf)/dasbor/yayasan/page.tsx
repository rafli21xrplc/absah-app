'use client';

import { EmptyState } from '@absah/ui';
import { CollectionDashboardList, type CollectionDashboard } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { barWidth, schoolsByAttention } from '@/lib/dashboard';
import { percent } from '@/lib/report';
import styles from '../../data.module.css';

/** One yayasan / collection: the totals, the trend of all its schools together, and each school, lowest attendance first. */
function Collection({ c }: { c: CollectionDashboard }) {
  const t = c.totals;
  return (
    <section className={styles.section} aria-labelledby={`y-${c.id}`}>
      <h2 id={`y-${c.id}`}>{c.name}</h2>
      <div className={styles.counts}>
        <div className={styles.count}>
          <span>Kehadiran hari ini</span>
          <strong>{percent(t.attendance.presentRate)}</strong>
          <small>
            {t.attendance.present} dari {t.attendance.days} siswa di {t.schools} sekolah
          </small>
        </div>
        <div className={styles.count}>
          <span>Pengisian sesi</span>
          <strong>{percent(t.sessions.fillRate)}</strong>
          <small>
            {t.sessions.filled} dari {t.sessions.total} sesi
          </small>
        </div>
        {t.atRiskStudents !== null && (
          <div className={styles.count}>
            <span>Siswa berisiko (7 hari)</span>
            <strong>{t.atRiskStudents}</strong>
          </div>
        )}
        {t.mbg && (
          <div className={styles.count}>
            <span>MBG hari ini</span>
            <strong>{t.mbg.present}</strong>
            <small>dari {t.mbg.enrolled} penerima</small>
          </div>
        )}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sekolah</th>
              <th className={styles.num}>Hadir</th>
              <th className={styles.num}>Sesi diisi</th>
              <th className={styles.num}>Berisiko</th>
              <th>Kehadiran</th>
            </tr>
          </thead>
          <tbody>
            {schoolsByAttention(c.schools).map((s) => (
              <tr key={s.schoolId}>
                <td>{s.name}</td>
                <td className={styles.num}>{percent(s.attendance.presentRate)}</td>
                <td className={styles.num}>{percent(s.sessions.fillRate)}</td>
                <td className={styles.num}>{s.atRiskStudents ?? '–'}</td>
                <td>
                  <span className={styles.bar} role="img" aria-label={`Kehadiran ${s.name}: ${percent(s.attendance.presentRate)}`}>
                    <span style={{ width: `${barWidth(s.attendance.presentRate)}%` }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Dasbor yayasan (RKP-06): the schools of a collection where the person leads, each read in its own tenant by the API. */
export default function DasborYayasanPage() {
  const [data, setData] = useState<CollectionDashboardList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api('/dashboard/collections', CollectionDashboardList)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Dasbor yayasan belum bisa dimuat.'));
  }, []);

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/dasbor">
        ← Dasbor sekolah
      </Link>
      <h1 className={styles.title}>Dasbor yayasan</h1>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Memuat…</p>}
      {data && data.items.length === 0 && <EmptyState bare headingLevel="p" kind="empty" title="Anda belum memimpin sekolah yang tergabung dalam yayasan.">Hanya sekolah tempat Anda kepala sekolah, wakil, atau admin yang dihitung.</EmptyState>}
      {data?.items.map((c) => <Collection key={c.id} c={c} />)}
    </main>
  );
}
