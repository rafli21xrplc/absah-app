'use client';

import { PortalAttendance } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HafalanHistory } from '../../../_hafalan/history';
import { api, ApiError } from '@/lib/api';
import { IfCap } from '@/lib/capabilities';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../portal.module.css';

/** Riwayat setoran hafalan (KEG-03) for the student and each child of a parent. */
export default function PortalHafalan() {
  const { schoolId } = useWorkspace();
  const [children, setChildren] = useState<PortalAttendance['items'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/portal/attendance', PortalAttendance, { schoolId })
      .then((d) => setChildren(d.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat data.'));
  }, [schoolId]);

  return (
    <main className={styles.main}>
      <Link href="/portal">← Portal</Link>
      <h1 className={styles.title}>Hafalan Al-Qur&apos;an</h1>
      <IfCap name="religious.memorization" fallback={<p>Sekolah belum mencatat hafalan di Absah.</p>}>
        {error && <p role="alert">{error}</p>}
        {!children && !error && <p role="status">Memuat…</p>}
        {schoolId && children?.map((c) => <HafalanHistory key={c.studentId} className={styles.card} schoolId={schoolId} studentId={c.studentId} />)}
      </IfCap>
    </main>
  );
}
