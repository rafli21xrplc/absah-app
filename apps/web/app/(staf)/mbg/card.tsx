'use client';

import { MbgDaily } from '@absah/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { clock } from '@/lib/mbg';
import { useWorkspace } from '@/lib/workspace';
import styles from '../../shell.module.css';

/** Home card (RKP-08): today's MBG number at a glance; the page has the details. */
export function MbgCard() {
  const { schoolId } = useWorkspace();
  const [daily, setDaily] = useState<MbgDaily | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    api('/mbg/daily', MbgDaily, { schoolId })
      .then(setDaily)
      .catch(() => undefined); // the card still links to the page, which shows the error
  }, [schoolId]);

  const detail = !daily
    ? null
    : daily.status === 'not_school_day'
      ? 'bukan hari sekolah'
      : daily.status === 'pending'
        ? `${daily.total.present} hadir sejauh ini · dikirim ${clock(daily.cutoffTime)}`
        : `${daily.total.present} hadir · ${daily.sentAt ? 'terkirim ke PIC' : 'belum ada PIC'}`;

  return (
    <Link className={styles.card} href="/mbg">
      MBG hari ini
      {detail && (
        <>
          <br />
          <small>{detail}</small>
        </>
      )}
    </Link>
  );
}
