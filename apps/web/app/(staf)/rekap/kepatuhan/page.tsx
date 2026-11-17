'use client';

import { SessionCompliance } from '@absah/contracts';
import Link from 'next/link';
import { Suspense } from 'react';
import { COMPLIANCE_READERS, percent, periodQuery } from '@/lib/report';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../data.module.css';
import { PeriodPicker, usePeriod, useReport } from '../period';

/** Session filling per teacher (RKP-04): who fills, who fills late, who misses. */
function Kepatuhan() {
  const { hasRole } = useWorkspace();
  const allowed = hasRole(...COMPLIANCE_READERS);
  const { period, semesters } = usePeriod();
  const { data, error } = useReport(period && allowed ? `/reports/session-compliance?from=${period.from}&to=${period.to}` : null, SessionCompliance);

  return (
    <main className={styles.main}>
      <Link className={styles.back} href={`/rekap${period ? `?${periodQuery(period)}` : ''}`}>
        ← Rekap kehadiran
      </Link>
      <h1 className={styles.title}>Pengisian sesi</h1>
      {!allowed && <p>Halaman ini untuk wakasek, kepala sekolah, dan admin.</p>}
      {allowed && period && <PeriodPicker period={period} semesters={semesters} />}
      {error && <p role="alert">{error}</p>}
      {allowed && !data && !error && <p role="status">Memuat…</p>}
      {data && (
        <>
          <div className={styles.counts} aria-label="Ringkasan">
            <p className={styles.count}>
              <strong>{percent(data.totals.fillRate)}</strong> terisi
            </p>
            <p className={styles.count}>
              <strong>{data.totals.filledLate}</strong> diisi setelah pengingat
            </p>
            <p className={styles.count}>
              <strong>{data.totals.missed}</strong> tidak diisi
            </p>
            <p className={styles.count}>
              <strong>{data.totals.open}</strong> belum diisi hari ini
            </p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Guru</th>
                  <th className={styles.num}>Sesi</th>
                  <th className={styles.num}>Terisi</th>
                  <th className={styles.num}>Telat isi</th>
                  <th className={styles.num}>Tidak diisi</th>
                  <th className={styles.num}>Terisi %</th>
                </tr>
              </thead>
              <tbody>
                {data.teachers.map((t) => (
                  <tr key={t.teacher?.id ?? 'none'}>
                    <td>{t.teacher?.name ?? <span className={styles.muted}>Tanpa guru (wali kelas belum diatur)</span>}</td>
                    <td className={styles.num}>{t.sessions}</td>
                    <td className={styles.num}>{t.filled}</td>
                    <td className={styles.num}>{t.filledLate}</td>
                    <td className={styles.num}>{t.missed > 0 ? <span className={styles.badgeBad}>{t.missed}</span> : 0}</td>
                    <td className={styles.num}>{percent(t.fillRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.teachers.length === 0 && <p className={styles.empty}>Belum ada sesi pada periode ini.</p>}
          </div>
          <p className={styles.muted}>Telat isi: diisi setelah pengingat &quot;belum diisi&quot; terkirim. Sesi yang belum lewat tidak dihitung.</p>
        </>
      )}
    </main>
  );
}

export default function KepatuhanPage() {
  return (
    <Suspense>
      <Kepatuhan />
    </Suspense>
  );
}
