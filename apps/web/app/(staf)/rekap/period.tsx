'use client';

import { ReportSemesterList, schoolDateAt } from '@absah/contracts';
import type { z } from 'zod';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { periodFrom, semesterLabel, type Period } from '@/lib/report';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import { Input, Select } from '@absah/ui';

/** Semesters of the active year and the period chosen in the URL (null while loading). */
export function usePeriod(): { period: Period | null; semesters: ReportSemesterList['items'] } {
  const { schoolId, me } = useWorkspace();
  const params = useSearchParams();
  const [loaded, setLoaded] = useState<{ semesters: ReportSemesterList['items']; today: string } | null>(null);
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';

  useEffect(() => {
    if (!schoolId) return;
    api('/reports/semesters', ReportSemesterList, { schoolId })
      .catch(() => ({ items: [] }))
      .then((list) => setLoaded({ semesters: list.items, today: schoolDateAt(timezone, Date.now()) }))
      .catch(() => undefined);
  }, [schoolId, timezone]);

  if (!loaded) return { period: null, semesters: [] };
  return { period: periodFrom(new URLSearchParams(params.toString()), loaded.semesters, loaded.today), semesters: loaded.semesters };
}

/** GET one report for the current path; a new path shows "loading" again instead of stale data. */
export function useReport<S extends z.ZodType>(path: string | null, schema: S): { data: z.infer<S> | null; error: string | null } {
  const { schoolId } = useWorkspace();
  const [result, setResult] = useState<{ path: string; data: z.infer<S> | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!schoolId || !path) return;
    api(path, schema, { schoolId })
      .then((data) => setResult({ path, data, error: null }))
      .catch((err: unknown) => setResult({ path, data: null, error: err instanceof ApiError ? err.message : 'Tidak bisa memuat laporan.' }));
  }, [schoolId, path, schema]);

  return result?.path === path ? { data: result.data, error: result.error } : { data: null, error: null };
}

/** Semester, today, or a date range; the choice lives in the URL so links and reloads keep it. */
export function PeriodPicker({ period, semesters }: { period: Period; semesters: ReportSemesterList['items'] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [custom, setCustom] = useState(!period.semesterId && period.from !== period.to);
  const go = (query: string) => router.replace(`${pathname}?${query}`);
  const value = period.semesterId ?? (custom ? 'custom' : 'day');

  return (
    <div className={styles.toolbar}>
      <label className={forms.field}>
        <span className={forms.label}>Periode</span>
        <Select
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            setCustom(v === 'custom');
            if (v === 'day') go(`from=${period.to}&to=${period.to}`);
            else if (v !== 'custom') go(`semester=${v}`);
          }}
        >
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {semesterLabel(s)}
            </option>
          ))}
          <option value="day">Satu hari</option>
          <option value="custom">Rentang tanggal</option>
        </Select>
      </label>
      {!period.semesterId && (
        <>
          <label className={forms.field}>
            <span className={forms.label}>{custom ? 'Dari' : 'Tanggal'}</span>
            <Input
              type="date"
              value={period.from}
              onChange={(e) => e.target.value && go(`from=${e.target.value}&to=${custom && e.target.value <= period.to ? period.to : e.target.value}`)}
            />
          </label>
          {custom && (
            <label className={forms.field}>
              <span className={forms.label}>Sampai</span>
              <Input type="date" min={period.from} value={period.to} onChange={(e) => e.target.value && go(`from=${period.from}&to=${e.target.value}`)} />
            </label>
          )}
        </>
      )}
    </div>
  );
}
