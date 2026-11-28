'use client';

import { ClassRecapList, ClassStudentHours } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { STATUS_LABELS } from '@/lib/attendance';
import { todayIn } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import { DateInput, Select, LoadingState } from '@absah/ui';

type Session = ClassStudentHours['sessions'][number];

/** "Jam 3 · Fisika · Kelompok Fisika A" (the group's name only when it is not the rombel's own lesson). */
function sessionLabel(s: Session): string {
  const parts = [s.period ? `Jam ${s.period.number}` : 'Harian', s.subject?.name];
  if (s.owner.type === 'group') parts.push(s.owner.name);
  return parts.filter(Boolean).join(' · ');
}

/**
 * Jam siswa (AKD-10): each student's whole day, the rombel's lessons and the learning groups they
 * joined in other rooms, for the wali kelas. Rombel come from the rekap list, narrowed by the API.
 */
export default function JamSiswa() {
  const { me, schoolId } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const today = todayIn(timezone);
  const [classes, setClasses] = useState<ClassRecapList['items'] | null>(null);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState<ClassStudentHours | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api(`/reports/attendance/classes?from=${today}&to=${today}`, ClassRecapList, { schoolId })
      .then((l) => {
        setClasses(l.items);
        setClassId((prev) => prev || (l.items[0]?.id ?? ''));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat rombel.'));
  }, [schoolId, today]);

  useEffect(() => {
    if (!schoolId || !classId) return;
    api(`/classes/${classId}/student-hours?date=${date}`, ClassStudentHours, { schoolId })
      .then(setHours)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat jam siswa.'));
  }, [schoolId, classId, date]);

  const shown = hours && hours.classId === classId && hours.schoolDate === date ? hours : null;

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Jam siswa</h1>
      {error && <p role="alert">{error}</p>}
      {classes?.length === 0 && <p>Tidak ada rombel yang bisa Anda lihat.</p>}
      {classes && classes.length > 0 && (
        <p>
          <label>
            Rombel{' '}
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>{' '}
          <label>
            Tanggal <DateInput type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
        </p>
      )}
      {classId && !shown && !error && <LoadingState variant="table" />}
      {shown && shown.sessions.length === 0 && <p>Tidak ada pelajaran pada tanggal ini.</p>}
      {shown && shown.sessions.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label={`Jam siswa ${shown.className}`}>
            <thead>
              <tr>
                <th>Siswa</th>
                {shown.sessions.map((s) => (
                  <th key={s.id}>{sessionLabel(s)}</th>
                ))}
                <th>Hari ini</th>
              </tr>
            </thead>
            <tbody>
              {shown.students.map((st) => (
                <tr key={st.enrollmentId}>
                  <td>{st.name}</td>
                  {shown.sessions.map((s) => {
                    const mine = st.sessions.find((x) => x.sessionId === s.id);
                    if (!mine) return <td key={s.id} className={styles.muted} aria-label="Bukan pelajarannya">—</td>;
                    return <td key={s.id}>{mine.status ? STATUS_LABELS[mine.status] : <span className={styles.muted}>Belum diisi</span>}</td>;
                  })}
                  <td>{st.daily ? STATUS_LABELS[st.daily] : <span className={styles.muted}>Belum ada</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.muted}>Pelajaran kelompok belajar dihitung di rekap rombel siswa sendiri.</p>
    </main>
  );
}
