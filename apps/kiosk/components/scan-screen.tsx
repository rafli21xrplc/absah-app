'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from '@/app/page.module.css';
import { beep } from '@/lib/beep';
import { FEEDBACK, REJECT_HINTS } from '@/lib/feedback';
import type { KioskState, ScanFeedback } from '@/lib/use-kiosk';
import { wedgeReader } from '@/lib/wedge';
import { Camera } from './camera';

type Ready = Extract<KioskState, { phase: 'ready' }>;

const SHOW_MS = 2_500;
/** The camera sees the same code many times a second; one scan per code per few seconds. */
const SAME_CODE_MS = 5_000;

function view(f: ScanFeedback) {
  switch (f.kind) {
    case 'arrived':
      return { ...FEEDBACK[f.outcome], name: f.firstName, detail: f.className, sound: f.outcome === 'on_time' ? 'ok' : 'warn' } as const;
    case 'duplicate':
      return { ...FEEDBACK.duplicate, name: f.firstName, detail: 'Kedatangan sudah tercatat hari ini.', sound: 'warn' } as const;
    case 'rejected':
      return { ...FEEDBACK.rejected, name: null, detail: REJECT_HINTS[f.reason], sound: 'error' } as const;
    case 'queued':
      return { color: 'var(--absah-primary)', label: 'Tersimpan', name: null, detail: 'Diperiksa saat kios tersambung.', sound: 'ok' } as const;
  }
}

/** The gate screen: camera + USB scanner in, a large colored answer out (GRB-03). */
export function ScanScreen({ state, scan }: { state: Ready; scan: (text: string) => Promise<ScanFeedback> }) {
  const [shown, setShown] = useState<ReturnType<typeof view> | null>(null);
  const last = useRef({ text: '', at: 0 });
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onCode = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (text === last.current.text && now - last.current.at < SAME_CODE_MS) return;
      last.current = { text, at: now };
      const v = view(await scan(text));
      beep(v.sound);
      setShown(v);
      clearTimeout(hide.current);
      hide.current = setTimeout(() => setShown(null), SHOW_MS);
    },
    [scan],
  );

  useEffect(() => {
    const read = wedgeReader((code) => void onCode(code));
    const onKey = (e: KeyboardEvent) => read(e.key, e.timeStamp);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCode]);

  const status = state.online ? 'Tersambung' : 'Offline';
  return (
    <main className={styles.kiosk}>
      <header className={styles.bar}>
        <span>
          {state.pairing.schoolName} · {state.pairing.kioskName}
        </span>
        <span data-testid="kiosk-status">
          {status}
          {state.queueSize > 0 ? ` · antrean ${state.queueSize}` : ''}
          {state.day ? '' : ' · data hari ini belum terunduh'}
        </span>
      </header>
      <section className={styles.stage} style={shown ? { background: shown.color } : undefined} aria-live="assertive" data-testid="kiosk-feedback">
        {shown ? (
          <div className={styles.answer}>
            <p className={styles.label}>{shown.label}</p>
            {shown.name ? <p className={styles.name}>{shown.name}</p> : null}
            <p className={styles.detail}>{shown.detail}</p>
          </div>
        ) : (
          <div className={styles.answer}>
            <p className={styles.idle}>Tunjukkan kartu Absah ke kamera</p>
            <p className={styles.hint}>Buka kartu di aplikasi Absah pada HP.</p>
          </div>
        )}
      </section>
      <Camera onCode={(text) => void onCode(text)} className={styles.camera} />
    </main>
  );
}
