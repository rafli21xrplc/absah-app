'use client';

import { Button } from '@absah/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { offlineStore, QUEUE_CHANGED_EVENT } from '@/lib/offline-queue';
import { SESSIONS_SYNCED_EVENT, syncPending, type SyncOutcome } from '@/lib/sync-sessions';
import { useWorkspace } from '@/lib/workspace';
import styles from './data.module.css';

const RETRY_MS = 15_000;

/**
 * Sends the sessions filled without signal (PRS-08) as soon as the API answers again: on load, when the browser says it is
 * online, when the tab comes back and every 15 s while something waits. Says what happened to each one; a session that was
 * locked meanwhile shows as "koreksi diajukan", never as lost.
 */
export function OfflineSync() {
  const { me } = useWorkspace();
  const userId = me.user.id;
  const [pending, setPending] = useState(0);
  const [outcomes, setOutcomes] = useState<SyncOutcome[]>([]);
  const running = useRef(false);

  const flush = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const done = await syncPending(offlineStore(), userId);
      setPending((await offlineStore().queue(userId)).length);
      if (done.length > 0) {
        setOutcomes((prev) => [...prev, ...done]);
        window.dispatchEvent(new Event(SESSIONS_SYNCED_EVENT));
      }
    } finally {
      running.current = false;
    }
  }, [userId]);

  useEffect(() => {
    const count = () => void offlineStore().queue(userId).then((q) => setPending(q.length));
    const tick = () => void offlineStore().queue(userId).then((q) => (q.length > 0 ? flush() : undefined));
    count();
    tick();
    const timer = window.setInterval(tick, RETRY_MS);
    const visible = () => document.visibilityState === 'visible' && tick();
    window.addEventListener('online', tick);
    window.addEventListener(QUEUE_CHANGED_EVENT, count);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', tick);
      window.removeEventListener(QUEUE_CHANGED_EVENT, count);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [userId, flush]);

  if (pending === 0 && outcomes.length === 0) return null;
  return (
    <aside className={styles.notice} aria-label="Sesi offline">
      {pending > 0 && (
        <p role="status">
          {pending} sesi menunggu dikirim. Dikirim otomatis saat ada sinyal.{' '}
          <Button variant="secondary" onClick={() => void flush()}>
            Kirim sekarang
          </Button>
        </p>
      )}
      {outcomes.length > 0 && (
        <>
          <ul>
            {outcomes.map((o) => (
              <li key={`${o.id}:${o.text}`} role="status">
                {o.text}
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setOutcomes([])}>
            Tutup
          </Button>
        </>
      )}
    </aside>
  );
}
