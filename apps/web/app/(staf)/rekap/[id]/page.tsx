'use client';

import { EmptyState } from '@absah/ui';
import { ClassRecapDetail } from '@absah/contracts';
import Link from 'next/link';
import { Suspense, use } from 'react';
import { percent, periodQuery } from '@/lib/report';
import styles from '../../data.module.css';
import { ExportButtons } from '../export-buttons';
import { PeriodPicker, usePeriod, useReport } from '../period';

/** Rekap per siswa of one rombel (RKP-01, RKP-02), with the semester files for e-Rapor. */
function RekapRombel({ id }: { id: string }) {
  const { period, semesters } = usePeriod();
  const { data, error } = useReport(period ? `/reports/attendance/classes/${id}?from=${period.from}&to=${period.to}` : null, ClassRecapDetail);

  return (
    <main className={styles.main}>
      <Link className={styles.back} href={`/rekap${period ? `?${periodQuery(period)}` : ''}`}>
        ← Rekap semua rombel
      </Link>
      <h1 className={styles.title}>Rekap {data?.class.name ?? 'rombel'}</h1>
      {data && <p className={styles.muted}>Wali kelas: {data.class.homeroom?.name ?? 'belum ada'}</p>}
      {period && <PeriodPicker period={period} semesters={semesters} />}
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Memuat…</p>}
      {data && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nama</th>
                <th>NISN</th>
                <th className={styles.num}>H</th>
                <th className={styles.num}>T</th>
                <th className={styles.num}>S</th>
                <th className={styles.num}>I</th>
                <th className={styles.num}>A</th>
                <th className={styles.num}>Hadir</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.enrollmentId}>
                  <td>
                    {s.name} {!s.active && <span className={styles.badgeWarn}>sudah pindah</span>}
                  </td>
                  <td>{s.nisn ?? <span className={styles.muted}>-</span>}</td>
                  <td className={styles.num}>{s.counts.H}</td>
                  <td className={styles.num}>{s.counts.T}</td>
                  <td className={styles.num}>{s.counts.S}</td>
                  <td className={styles.num}>{s.counts.I}</td>
                  <td className={styles.num}>{s.counts.A}</td>
                  <td className={styles.num}>{percent(s.presentRate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Jumlah</th>
                <th />
                <th className={styles.num}>{data.totals.counts.H}</th>
                <th className={styles.num}>{data.totals.counts.T}</th>
                <th className={styles.num}>{data.totals.counts.S}</th>
                <th className={styles.num}>{data.totals.counts.I}</th>
                <th className={styles.num}>{data.totals.counts.A}</th>
                <th className={styles.num}>{percent(data.totals.presentRate)}</th>
              </tr>
            </tfoot>
          </table>
          {data.items.length === 0 && <EmptyState bare headingLevel="p" kind="empty" title="Tidak ada siswa pada periode ini." />}
        </div>
      )}
      {data && period?.semesterId && <ExportButtons semesterId={period.semesterId} classId={id} />}
      {data && !period?.semesterId && <p className={styles.muted}>Pilih semester untuk mengunduh berkas e-Rapor dan arsip PDF.</p>}
    </main>
  );
}

export default function RekapRombelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <RekapRombel id={id} />
    </Suspense>
  );
}
