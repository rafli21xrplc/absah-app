'use client';

import { TeacherReport, type TeacherReportRow } from '@absah/contracts';
import { Button } from '@absah/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { todayIn } from '@/lib/leave';
import { clockLabel, leaveDays, monthLabel, rateLabel, shiftMonth, TEACHER_DAY_LABELS, TEACHER_REPORT_READING } from '@/lib/teacher';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';

/** Laporan kehadiran guru (GRU-04): for the kepala sekolah, one month at a time, with one teacher's days on request. */
export default function LaporanGuruPage() {
  const { schoolId, me, hasRole } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const thisMonth = todayIn(timezone).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; data: TeacherReport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = hasRole(...TEACHER_REPORT_READING);

  const key = `${month}|${teacherId ?? ''}`;
  useEffect(() => {
    if (!schoolId || !allowed) return;
    api(`/teacher-attendance/report?month=${month}${teacherId ? `&teacherId=${teacherId}` : ''}`, TeacherReport, { schoolId })
      .then((data) => {
        setLoaded({ key, data });
        setError(null);
      })
      .catch(() => setError('Tidak bisa memuat laporan.'));
  }, [schoolId, allowed, month, teacherId, key]);
  // Only the answer to the current question counts; while the next one loads, show "Memuat…" instead of the old month.
  const report = loaded?.key === key ? loaded.data : null;

  const pick = (m: string) => {
    setTeacherId(null);
    setMonth(m);
  };
  const one: TeacherReportRow | undefined = teacherId ? report?.items[0] : undefined;

  return (
    <IfCap name="teacher.attendance" fallback={<p className={styles.main}>Laporan guru belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Kehadiran guru</h1>
        {!allowed ? (
          <p className={styles.empty}>Peran Anda tidak membuka laporan guru.</p>
        ) : (
          <>
            <div className={styles.rowActions} role="group" aria-label="Bulan">
              <Button variant="secondary" type="button" onClick={() => pick(shiftMonth(month, -1))}>
                ← Bulan sebelumnya
              </Button>
              <strong aria-live="polite">{monthLabel(month)}</strong>
              <Button variant="secondary" type="button" disabled={month >= thisMonth} onClick={() => pick(shiftMonth(month, 1))}>
                Bulan berikutnya →
              </Button>
            </div>
            {error && (
              <p className={forms.error} role="alert">
                {error}
              </p>
            )}
            {!report && !error && <p role="status">Memuat…</p>}
            {report && (
              <p className={styles.muted}>
                {report.schoolDays === 0 ? 'Belum ada hari sekolah pada bulan ini.' : `${report.schoolDays} hari sekolah${report.through ? ` sampai ${report.through}` : ''}.`} Hari tanpa absen dan tanpa izin ditulis “tanpa catatan”; sekolah
                yang menanyakannya, sistem tidak menyebutnya alpa.
              </p>
            )}
            {report && !teacherId && (
              <>
                <p role="status">
                  Rata-rata kehadiran {rateLabel(report.totals.rate)} · terlambat {report.totals.late}× · izin {report.totals.leave} hari · tanpa catatan {report.totals.noRecord} hari
                </p>
                {report.items.length === 0 && <p className={styles.empty}>Belum ada guru.</p>}
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <caption className={styles.muted}>Kehadiran guru {monthLabel(month)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Guru</th>
                        <th scope="col">Hadir</th>
                        <th scope="col">Terlambat</th>
                        <th scope="col">Izin</th>
                        <th scope="col">Tanpa catatan</th>
                        <th scope="col">Persen</th>
                        <th scope="col">Mengganti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.items.map((r) => (
                        <tr key={r.teacher.id}>
                          <th scope="row">
                            <button type="button" onClick={() => setTeacherId(r.teacher.id)} aria-label={`Rincian ${r.teacher.name}`}>
                              {r.teacher.name}
                            </button>
                          </th>
                          <td>{r.present}</td>
                          <td>{r.late}</td>
                          <td title={`Sakit ${r.leave.sakit}, izin ${r.leave.izin}, dinas ${r.leave.dinas}`}>{leaveDays(r.leave)}</td>
                          <td>{r.noRecord}</td>
                          <td>{rateLabel(r.rate)}</td>
                          <td>{r.substitutionsTaken}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {one && (
              <section className={styles.section} aria-labelledby="rincian">
                <h2 id="rincian">{one.teacher.name}</h2>
                <Button variant="secondary" type="button" onClick={() => setTeacherId(null)}>
                  ← Semua guru
                </Button>
                <p role="status">
                  Hadir {one.present} · terlambat {one.late} · izin {leaveDays(one.leave)} (sakit {one.leave.sakit}, izin {one.leave.izin}, dinas {one.leave.dinas}) · tanpa catatan {one.noRecord} · {rateLabel(one.rate)}
                </p>
                <table>
                  <caption className={styles.muted}>Rincian harian</caption>
                  <thead>
                    <tr>
                      <th scope="col">Tanggal</th>
                      <th scope="col">Status</th>
                      <th scope="col">Masuk</th>
                      <th scope="col">Pulang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {one.days?.map((d) => (
                      <tr key={d.date}>
                        <th scope="row">{d.date}</th>
                        <td>{TEACHER_DAY_LABELS[d.status]}</td>
                        <td>{d.checkedInAt ? clockLabel(d.checkedInAt, timezone) : '–'}</td>
                        <td>{d.checkedOutAt ? clockLabel(d.checkedOutAt, timezone) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </main>
    </IfCap>
  );
}
