'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IfCap } from '@/lib/capabilities';
import { useWorkspace } from '@/lib/workspace';
import { PklJournals } from '../../../_pkl/journals';
import forms from '../../../forms.module.css';
import styles from '../../data.module.css';
import { Select } from '@absah/ui';

/** Jurnal PKL for the guru pembimbing and leaders (PKL-03): read, approve or ask for a revision. */
export default function PklJournalPage() {
  const { schoolId } = useWorkspace();
  const [status, setStatus] = useState('submitted');
  return (
    <IfCap name="pkl.enabled" fallback={<p className={styles.main}>PKL belum diaktifkan.</p>}>
      <main className={styles.main}>
        <Link className={styles.back} href="/pkl">
          ← PKL
        </Link>
        <h1 className={styles.title}>Jurnal PKL siswa</h1>
        <label className={forms.field}>
          <span className={forms.label}>Tampilkan</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="submitted">Menunggu tinjauan</option>
            <option value="">Semua (31 hari terakhir)</option>
          </Select>
        </label>
        {schoolId && <PklJournals schoolId={schoolId} query={status ? `status=${status}` : ''} />}
      </main>
    </IfCap>
  );
}
