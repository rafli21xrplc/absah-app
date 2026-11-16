'use client';

import { ClassList, SchedulePeriodsResponse, SubjectList, TeacherList } from '@absah/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { z } from 'zod';
import { api, ApiError } from '@/lib/api';
import { useCapability } from '@/lib/capabilities';
import { SCHEDULE_MANAGERS, SCHEDULE_PAGE_READERS } from '@/lib/schedule-access';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import { ScheduleGrid } from './grid';
import { HomeroomTable } from './homeroom';
import page from './jadwal.module.css';
import { PeriodsEditor } from './periods';
import { TemplateImport } from './template-import';

export interface ScheduleData {
  classes: ClassList;
  periods: SchedulePeriodsResponse;
  subjects: z.infer<typeof SubjectList>['items'];
  teachers: z.infer<typeof TeacherList>['items'];
}

type Tab = 'grid' | 'periods' | 'homeroom' | 'import';

/** Jadwal pelajaran, jam pelajaran, wali kelas and the Excel template (AKD-05). */
export default function JadwalPage() {
  const { schoolId, hasRole } = useWorkspace();
  const mode = useCapability('attendance.mode');
  const allowed = hasRole(...SCHEDULE_PAGE_READERS);
  const canEdit = hasRole(...SCHEDULE_MANAGERS);
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);

  const fetchData = useCallback(async (): Promise<ScheduleData> => {
    const [classes, periods, subjects, teachers] = await Promise.all([
      api('/classes', ClassList, { schoolId }),
      api('/schedule/periods', SchedulePeriodsResponse, { schoolId }),
      api('/subjects', SubjectList, { schoolId }),
      canEdit ? api('/schedule/teachers', TeacherList, { schoolId }) : Promise.resolve({ items: [] }),
    ]);
    return { classes, periods, subjects: subjects.items, teachers: teachers.items };
  }, [schoolId, canEdit]);
  const load = useCallback(() => fetchData().then(setData), [fetchData]);

  useEffect(() => {
    if (!schoolId || !allowed) return;
    fetchData()
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat jadwal.'));
  }, [schoolId, allowed, fetchData]);

  const daily = mode === 'daily';
  const current: Tab = tab ?? (daily ? 'homeroom' : 'grid');
  const tabs: [Tab, string][] = [
    ['grid', 'Jadwal pelajaran'],
    ['periods', 'Jam pelajaran'],
    ['homeroom', 'Wali kelas'],
    ...(canEdit ? ([['import', 'Import Excel']] as [Tab, string][]) : []),
  ];

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Jadwal{data?.classes.academicYear ? ` ${data.classes.academicYear.name}` : ''}</h1>
      {!allowed && <p>Halaman ini untuk admin, operator, dan pimpinan sekolah.</p>}
      {daily && allowed && (
        <p className={styles.notice}>
          Sekolah Anda memakai presensi harian: cukup tetapkan wali kelas tiap rombel. Jadwal pelajaran boleh diisi bila diperlukan.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {allowed && !data && !error && <p role="status">Memuat…</p>}
      {data && !data.classes.academicYear && (
        <p className={styles.notice}>
          Belum ada tahun ajaran aktif. <Link href="/import">Import data siswa</Link> terlebih dahulu.
        </p>
      )}
      {data?.classes.academicYear && (
        <>
          <div className={page.tabs} role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={current === id} className={page.tab} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          {current === 'grid' && <ScheduleGrid data={data} canEdit={canEdit} onChanged={load} />}
          {current === 'periods' && <PeriodsEditor initial={data.periods} canEdit={canEdit} onSaved={load} />}
          {current === 'homeroom' && <HomeroomTable data={data} canEdit={canEdit} onSaved={load} />}
          {current === 'import' && canEdit && <TemplateImport onApplied={load} />}
        </>
      )}
    </main>
  );
}
