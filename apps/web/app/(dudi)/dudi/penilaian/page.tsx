'use client';

import { PklAssessmentList } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { dateRangeLabel } from '@/lib/leave';
import { assessmentNote, overallText, WINDOW_LABELS } from '@/lib/pkl-assessment';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../../(portal)/portal.module.css';

/** Penilaian siswa PKL (PKL-04): the supervisor's students and whether the form is open. */
export default function DudiAssessmentsPage() {
  const { schoolId, hasRole } = useWorkspace();
  const allowed = hasRole('pembimbing_industri');
  const [items, setItems] = useState<PklAssessmentList['items'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolId || !allowed) return;
    api('/pkl/assessments', PklAssessmentList, { schoolId })
      .then((r) => setItems(r.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Tidak bisa memuat. Periksa internet.'));
  }, [schoolId, allowed]);

  return (
    <main className={styles.main}>
      <Link href="/dudi">← Kehadiran</Link>
      <h1 className={styles.title}>Penilaian siswa PKL</h1>
      {!allowed && <p>Halaman ini untuk pembimbing industri PKL.</p>}
      {error && <p role="alert">{error}</p>}
      {allowed && items && items.length === 0 && <p>Belum ada siswa PKL yang Anda bimbing.</p>}
      <ul className={styles.list} aria-label="Penilaian siswa">
        {items?.map((i) => (
          <li key={i.placementId} aria-label={i.student.name}>
            <strong>{i.student.name}</strong> · {i.student.className}
            <br />
            {i.partner.name} · {dateRangeLabel(i.startsOn, i.endsOn)}
            <br />
            <span className={styles.muted}>
              {WINDOW_LABELS[i.window]} · {assessmentNote(i)}
              {i.assessment && ` · nilai akhir ${overallText(i.assessment.overall)}`}
            </span>
            {i.window === 'open' && (
              <div>
                <Link href={`/dudi/penilaian/${i.placementId}`}>{i.assessment ? 'Perbaiki penilaian' : 'Isi penilaian'}</Link>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
