'use client';

import { EarlyWarningList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { dateRangeLabel } from '@/lib/leave';
import { EARLY_WARNING_LABELS, POINT_PROFILE_READERS } from '@/lib/ksw';
import { useWorkspace } from '@/lib/workspace';
import forms from '../../forms.module.css';
import styles from '../data.module.css';
import ui from '../presensi.module.css';
import { EmptyState, Select } from '@absah/ui';

const RANGES = [7, 14, 30] as const;

/** Peringatan dini (KSW-04): raised each evening after 18.00 from a student's recent attendance. */
export default function PeringatanDiniPage() {
  const { schoolId, hasRole } = useWorkspace();
  const [days, setDays] = useState<(typeof RANGES)[number]>(14);
  const [list, setList] = useState<EarlyWarningList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api(`/early-warnings?days=${days}`, EarlyWarningList, { schoolId })
      .then((r) => {
        setList(r);
        setError(null);
      })
      .catch(() => setError('Tidak bisa memuat peringatan dini.'));
  }, [schoolId, days]);

  return (
    <IfCap name="student.early_warning" fallback={<p className={styles.main}>Peringatan dini belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/">
          ← Beranda
        </Link>
        <h1 className={styles.title}>Peringatan dini</h1>
        <label className={forms.field}>
          Periode
          <Select value={days} onChange={(e) => setDays(Number(e.target.value) as (typeof RANGES)[number])}>
            {RANGES.map((d) => (
              <option key={d} value={d}>
                {d} hari terakhir
              </option>
            ))}
          </Select>
        </label>
        {error && (
          <p className={forms.error} role="alert">
            {error}
          </p>
        )}
        {list && list.items.length === 0 && <EmptyState bare headingLevel="p" kind="done" title="Tidak ada peringatan pada periode ini." />}
        <ul className={ui.sessions}>
          {list?.items.map((w) => (
            <li key={w.id} className={ui.student} aria-label={`${w.student.name} ${EARLY_WARNING_LABELS[w.kind]}`}>
              <span className={ui.studentName}>
                {hasRole(...POINT_PROFILE_READERS) ? <Link href={`/poin/${w.student.enrollmentId}`}>{w.student.name}</Link> : w.student.name} · {w.student.className}
              </span>
              <span className={styles.badgeWarn}>{EARLY_WARNING_LABELS[w.kind]}</span>
              <span>
                {w.dates.length > 1 ? `${w.dates.length} hari: ` : ''}
                {w.dates.length > 0 ? dateRangeLabel(w.dates[0] ?? w.date, w.dates[w.dates.length - 1] ?? w.date) : ''} · dicatat {w.date}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </IfCap>
  );
}
