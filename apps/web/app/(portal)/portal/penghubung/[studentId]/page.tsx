'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LiaisonThreadView } from '../../../../_liaison/thread';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../../portal.module.css';

export default function PortalPenghubungThread() {
  const { studentId } = useParams<{ studentId: string }>();
  const { schoolId, me } = useWorkspace();
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';
  return (
    <main className={styles.main}>
      <Link href="/portal/penghubung">← Buku penghubung</Link>
      <h1 className={styles.title}>Buku penghubung</h1>
      {schoolId && <LiaisonThreadView schoolId={schoolId} studentId={studentId} timezone={timezone} />}
    </main>
  );
}
