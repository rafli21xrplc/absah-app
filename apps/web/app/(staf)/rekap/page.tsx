'use client';

import { ClassRecapList, type ClassStream } from '@absah/contracts';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { COMPLIANCE_READERS, percent, periodQuery, RECAP_MANAGERS, STREAM_LABELS, streamsOf } from '@/lib/report';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import { ExportButtons } from './export-buttons';
import { PeriodPicker, usePeriod, useReport } from './period';
import { EmptyState, Select, LoadingState } from '@absah/ui';

/** Rekap S/I/A per rombel (RKP-01): every rombel for pimpinan, their own for a wali kelas. */
function RekapList() {
  const { hasRole } = useWorkspace();
  const { period, semesters } = usePeriod();
  const { data, error } = useReport(period ? `/reports/attendance/classes?from=${period.from}&to=${period.to}` : null, ClassRecapList);
  // Jurusan (AKD-11): filtered here; the export asks the API for the same jurusan.
  const [stream, setStream] = useState<ClassStream | ''>('');
  const streams = data ? streamsOf(data.items) : [];
  const rows = data?.items.filter((c) => !stream || c.stream === stream) ?? [];

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
      {streams.length > 0 && (
        <p>
          <label>
            Jurusan{' '}
            <Select value={stream} onChange={(e) => setStream(e.target.value as ClassStream | '')}>
              <option value="">Semua jurusan</option>
              {streams.map((s) => (
                <option key={s} value={s}>
                  {STREAM_LABELS[s]}
                </option>
              ))}
            </Select>
          </label>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!data && !error && <LoadingState variant="table" />}
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
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/rekap/${c.id}?${periodQuery(period)}`}>{c.name}</Link>
                    {c.stream && !stream && <span className={styles.muted}> · {STREAM_LABELS[c.stream]}</span>}
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
          {rows.length === 0 && <EmptyState bare headingLevel="p" kind="empty" title="Belum ada rombel pada tahun ajaran aktif." />}
        </div>
      )}
      <p className={styles.muted}>Angka dalam hari sekolah. Hadir = hadir + terlambat dibagi semua hari tercatat.</p>
      {data && period?.semesterId && hasRole(...RECAP_MANAGERS) && <ExportButtons semesterId={period.semesterId} stream={stream || undefined} />}
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
