'use client';

import Link from 'next/link';
import { useCapability } from '@/lib/capabilities';
import { useWorkspace } from '@/lib/workspace';
import styles from '../data.module.css';
import { Keys } from './keys';
import { Webhooks } from './webhooks';

/** Integrasi (PLT-09): API keys and webhooks of the open API, for the school's admin. */
export default function IntegrasiPage() {
  const { schoolId, me, isAdmin } = useWorkspace();
  const on = useCapability('platform.openApi') === true;
  const timezone = me.schools.find((s) => s.id === schoolId)?.timezone ?? 'Asia/Jakarta';

  return (
    <main className={styles.main}>
      <Link className={styles.back} href="/">
        ← Beranda
      </Link>
      <h1 className={styles.title}>Integrasi</h1>
      {!isAdmin ? (
        <p role="alert">Integrasi hanya untuk admin sekolah.</p>
      ) : !on ? (
        <p role="alert">API terbuka belum diaktifkan untuk sekolah Anda. Hubungi tim Absah bila Anda memerlukannya.</p>
      ) : (
        schoolId && (
          <>
            <Keys schoolId={schoolId} timezone={timezone} />
            <Webhooks schoolId={schoolId} />
          </>
        )
      )}
    </main>
  );
}
