'use client';

import Link from 'next/link';
import { useWorkspace } from '@/lib/workspace';
import { PklJournals } from '../../../_pkl/journals';
import styles from '../../../(portal)/portal.module.css';

/** Jurnal PKL of the supervisor's students (PKL-03): approve or ask for a revision. */
export default function DudiJournalPage() {
  const { schoolId, hasRole } = useWorkspace();
  return (
    <main className={styles.main}>
      <Link href="/dudi">← Kehadiran</Link>
      <h1 className={styles.title}>Jurnal siswa PKL</h1>
      {!hasRole('pembimbing_industri') && <p>Halaman ini untuk pembimbing industri PKL.</p>}
      {schoolId && hasRole('pembimbing_industri') && <PklJournals schoolId={schoolId} />}
    </main>
  );
}
