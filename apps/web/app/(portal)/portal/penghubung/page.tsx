'use client';

import Link from 'next/link';
import { LiaisonThreads } from '../../../_liaison/thread-list';
import { IfCap } from '@/lib/capabilities';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../portal.module.css';

/** Parents: one buku penghubung per child, with the wali kelas and the child's teachers. */
export default function PortalPenghubung() {
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  return (
    <main className={styles.main}>
      <Link href="/portal">← Portal</Link>
      <h1 className={styles.title}>Buku penghubung</h1>
      <IfCap name="portal.liaison" fallback={<p>Buku penghubung belum diaktifkan sekolah.</p>}>
        {schoolId && <LiaisonThreads schoolId={schoolId} timezone={timezone} base="/portal/penghubung" empty="Belum ada anak yang terdaftar." />}
      </IfCap>
    </main>
  );
}
