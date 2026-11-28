'use client';

import { ClassHabitWeek, ClassRecapList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { addDays, HABIT_LABELS, HABITS, mondayOf, shortDay } from '@/lib/habits';
import { todayIn } from '@/lib/leave';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import { Select, LoadingState } from '@absah/ui';

/**
 * Jurnal 7 KAIH, weekly summary per rombel (KEG-02): days filled and ticks per habit per student.
 * Rombel come from the rekap list, which the API already narrows to the wali kelas's own.
 */
export default function Kebiasaan() {
  const { me, schoolId } = useWorkspace();
  const mode = useCapability('habits.kaih');
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  const today = todayIn(timezone);
  const [classes, setClasses] = useState<ClassRecapList['items'] | null>(null);
  const [classId, setClassId] = useState('');
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [week, setWeek] = useState<ClassHabitWeek | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !mode || mode === 'off') return;
    api(`/reports/attendance/classes?from=${today}&to=${today}`, ClassRecapList, { schoolId })
      .then((l) => {
        setClasses(l.items);
        setClassId((prev) => prev || (l.items[0]?.id ?? ''));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat rombel.'));
  }, [schoolId, mode, today]);

  useEffect(() => {
    if (!schoolId || !classId) return;
    api(`/classes/${classId}/habits?weekStart=${weekStart}`, ClassHabitWeek, { schoolId })
      .then(setWeek)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat jurnal.'));
  }, [schoolId, classId, weekStart]);

  // The answer for another rombel or week is not shown while the new one loads.
  const shown = week && week.classId === classId && week.weekStart === weekStart ? week : null;

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Jurnal 7 kebiasaan</h1>
      {mode === 'off' && <p>Sekolah belum memakai jurnal 7 kebiasaan.</p>}
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
          <button type="button" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            ← Minggu lalu
          </button>{' '}
          <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))} disabled={weekStart >= mondayOf(today)}>
            Minggu depan →
          </button>
        </p>
      )}
      {classId && !shown && !error && <LoadingState variant="table" />}
      {shown && (
        <>
          <p>
            {shown.className} · {shortDay(shown.weekStart)} – {shortDay(shown.weekEnd)}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Jurnal minggu ini">
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th className={styles.num}>Hari diisi</th>
                  {HABITS.map((h) => (
                    <th key={h} className={styles.num}>
                      {HABIT_LABELS[h]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.students.map((s) => (
                  <tr key={s.studentId}>
                    <td>{s.name}</td>
                    <td className={styles.num}>{s.daysFilled}/7</td>
                    {HABITS.map((h) => (
                      <td key={h} className={styles.num}>
                        {s.counts[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
