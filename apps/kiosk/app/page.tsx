'use client';

import { PairScreen } from '@/components/pair-screen';
import { ScanScreen } from '@/components/scan-screen';
import { useKiosk } from '@/lib/use-kiosk';
import styles from './page.module.css';

export default function KioskHome() {
  const { state, pair, scan } = useKiosk();
  if (state.phase === 'loading') {
    return (
      <main className={styles.screen}>
        <p className={styles.hint}>Memuat kios…</p>
      </main>
    );
  }
  if (state.phase === 'unpaired') return <PairScreen pair={pair} revoked={state.revoked} />;
  return <ScanScreen state={state} scan={scan} />;
}
