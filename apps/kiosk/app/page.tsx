'use client';

import { useState } from 'react';
import { PairScreen } from '@/components/pair-screen';
import { ScanScreen } from '@/components/scan-screen';
import { VisitorScreen } from '@/components/visitor-screen';
import { useKiosk } from '@/lib/use-kiosk';
import styles from './page.module.css';

export default function KioskHome() {
  const { state, pair, scan, hosts, registerVisitor } = useKiosk();
  const [guest, setGuest] = useState(false);
  if (state.phase === 'loading') {
    return (
      <main className={styles.screen}>
        <p className={styles.hint}>Memuat kios…</p>
      </main>
    );
  }
  if (state.phase === 'unpaired') return <PairScreen pair={pair} revoked={state.revoked} />;
  if (guest && hosts) return <VisitorScreen hosts={hosts} register={registerVisitor} onClose={() => setGuest(false)} />;
  return <ScanScreen state={state} scan={scan} onVisitor={hosts ? () => setGuest(true) : undefined} />;
}
