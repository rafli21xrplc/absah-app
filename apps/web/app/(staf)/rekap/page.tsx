'use client';

import { ClassRecapList } from '@absah/contracts';
import Link from 'next/link';
import { Suspense } from 'react';
import { COMPLIANCE_READERS, percent, periodQuery, RECAP_MANAGERS } from '@/lib/report';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import { ExportButtons } from './export-buttons';
import { PeriodPicker, usePeriod, useReport } from './period';

/** Rekap S/I/A per rombel (RKP-01): every rombel for pimpinan, their own for a wali kelas. */
function RekapList() {
  const { hasRole } = useWorkspace();
  const { period, semesters } = usePeriod();
  const { data, error } = useReport(period ? `/reports/attendance/classes?from=${period.from}&to=${period.to}` : null, ClassRecapList);

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Rekap kehadiran</h1>
      {hasRole(...COMPLIANCE_READERS) && (
        <p>
          <Link href={`/rekap/kepatuhan${period ? `?${periodQuery(period)}` : ''}`}>Lihat pengisian sesi oleh guru →</Link>
        </p>
      )}
      {period && <PeriodPicker period={period} semesters={semesters} />}
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Memuat…</p>}
      {data && period && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Rombel</th>
                <th>Wali kelas</th>
                <th className={styles.num}>Siswa</th>
                <th className={styles.num}>Hadir</th>
                <th className={styles.num}>S</th>
                <th className={styles.num}>I</th>
                <th className={styles.num}>A</th>
                <th className={styles.num}>T</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/rekap/${c.id}?${periodQuery(period)}`}>{c.name}</Link>
                  </td>
                  <td>{c.homeroom?.name ?? <span className={styles.muted}>Belum ada</span>}</td>
                  <td className={styles.num}>{c.students}</td>
                  <td className={styles.num}>{percent(c.presentRate)}</td>
                  <td className={styles.num}>{c.counts.S}</td>
                  <td className={styles.num}>{c.counts.I}</td>
                  <td className={styles.num}>{c.counts.A}</td>
                  <td className={styles.num}>{c.counts.T}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && <p className={styles.empty}>Belum ada rombel pada tahun ajaran aktif.</p>}
        </div>
      )}
      <p className={styles.muted}>Angka dalam hari sekolah. Hadir = hadir + terlambat dibagi semua hari tercatat.</p>
      {data && period?.semesterId && hasRole(...RECAP_MANAGERS) && <ExportButtons semesterId={period.semesterId} />}
    </main>
  );
}

export default function RekapPage() {
  return (
    <Suspense>
      <RekapList />
    </Suspense>
  );
}
