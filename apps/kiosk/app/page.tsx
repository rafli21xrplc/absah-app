'use client';

import { useState } from 'react';
import { CheckoutScreen } from '@/components/checkout-screen';
import { PairScreen } from '@/components/pair-screen';
import { ScanScreen } from '@/components/scan-screen';
import { VisitorScreen } from '@/components/visitor-screen';
import { useKiosk } from '@/lib/use-kiosk';
import styles from './page.module.css';

export default function KioskHome() {
  const { state, pair, scan, hosts, registerVisitor, ...checkout } = useKiosk();
  const [guest, setGuest] = useState(false);
  const [leaving, setLeaving] = useState(false);
  if (state.phase === 'loading') {
    return (
      <main className={styles.screen}>
        <p className={styles.hint}>Memuat kios…</p>
      </main>
    );
  }
  if (state.phase === 'unpaired') return <PairScreen pair={pair} revoked={state.revoked} />;
  if (guest && hosts) return <VisitorScreen hosts={hosts} register={registerVisitor} onClose={() => setGuest(false)} />;
  // Pulang only for schools with gate.pickup: the morning download then carries the roster.
  const pickupOn = state.day?.pickup != null;
  if (leaving && pickupOn) return <CheckoutScreen state={state} actions={checkout} onClose={() => setLeaving(false)} />;
  return <ScanScreen state={state} scan={scan} onVisitor={hosts ? () => setGuest(true) : undefined} onCheckout={pickupOn ? () => setLeaving(true) : undefined} />;
}
