'use client';

import { Banner, Button, messages } from '@absah/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { offlineStore, QUEUE_CHANGED_EVENT, type QueuedSession } from '@/lib/offline-queue';
import { SESSIONS_SYNCED_EVENT, syncPending, type SyncOptions, type SyncOutcome } from '@/lib/sync-sessions';
import { useWorkspace } from '@/lib/workspace';

const t = messages.offline;
const RETRY_MS = 15_000;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

/**
 * Sends the presensi filled without signal as soon as the API answers again: when something is put on the queue, on load,
 * when the browser says it is online, when the tab comes back and every 15 s while something waits. Every item has its own
 * growing wait between tries (see syncPending); "Kirim sekarang" and coming back online skip it. Says what happened to each
 * one: a session that was locked meanwhile shows as "koreksi diajukan", a refusal stays on screen with "Coba lagi", nothing is
 * ever dropped. Background Sync is not used: see docs/ui (U5).
 */
export function OfflineSync() {
  const { me } = useWorkspace();
  const userId = me.user.id;
  const [items, setItems] = useState<QueuedSession[]>([]);
  const [outcomes, setOutcomes] = useState<SyncOutcome[]>([]);
  const running = useRef(false);

  const refresh = useCallback(() => offlineStore().queue(userId).then(setItems), [userId]);

  const flush = useCallback(
    async (options: SyncOptions = {}) => {
      if (running.current) return;
      running.current = true;
      try {
        const done = await syncPending(offlineStore(), userId, undefined, options);
        await refresh();
        // A refusal stays as its own banner (it is still in the queue); only what went out is told once.
        const told = done.filter((o) => o.kind !== 'rejected');
        if (told.length > 0) setOutcomes((prev) => [...prev, ...told]);
        if (done.length > 0) {
          window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
          window.dispatchEvent(new Event(SESSIONS_SYNCED_EVENT));
        }
      } finally {
        running.current = false;
      }
    },
    [userId, refresh],
  );

  useEffect(() => {
    const due = () => void offlineStore().queue(userId).then((q) => (q.length > 0 ? flush() : undefined));
    const online = () => void flush({ force: true });
    const changed = () => {
      void refresh();
      due();
    };
    void refresh();
    due();
    const timer = window.setInterval(due, RETRY_MS);
    const visible = () => document.visibilityState === 'visible' && due();
    window.addEventListener('online', online);
    window.addEventListener(QUEUE_CHANGED_EVENT, changed);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener(QUEUE_CHANGED_EVENT, changed);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [userId, flush, refresh]);

  const waiting = items.filter((i) => !i.rejected);
  const refused = items.filter((i) => i.rejected);
  const shown = waiting.length > 0 || refused.length > 0 || outcomes.length > 0;

  // Screens that fill the phone (h-dvh, e.g. isi presensi) subtract the height of this notice, or their footer would be pushed off the screen.
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const set = (px: number) => document.documentElement.style.setProperty('--offline-notice', `${px}px`);
    const el = box.current;
    if (!shown || !el) {
      set(0);
      return;
    }
    set(el.offsetHeight);
    const watch = new ResizeObserver(() => set(el.offsetHeight));
    watch.observe(el);
    return () => {
      watch.disconnect();
      set(0);
    };
  }, [shown]);

  if (!shown) return null;
  return (
    <aside ref={box} aria-label={messages.presensi.waitingTitle} className="mx-auto flex w-full max-w-xl flex-col gap-2 px-4 pt-3 lg:max-w-none lg:px-8">
      {waiting.length > 0 && (
        <Banner
          kind="offline"
          title={fill(t.badge, { n: waiting.length })}
          action={
            <Button variant="secondary" onClick={() => void flush({ force: true })}>
              {t.sendNow}
            </Button>
          }
        >
          {fill(t.waiting, { n: waiting.length })}
        </Banner>
      )}
      {refused.map((i) => (
        <Banner
          key={i.id}
          kind="error"
          title={t.rejectedTitle}
          action={
            <Button variant="secondary" onClick={() => void flush({ force: true, retry: true, only: i.id })}>
              {t.retry}
            </Button>
          }
        >
          {i.rejected?.message}
        </Banner>
      ))}
      {outcomes.map((o) => (
        <Banner key={`${o.id}:${o.text}`} kind="info" title={t.submittedTitle}>
          {o.text}
        </Banner>
      ))}
      {outcomes.length > 0 && (
        <Button variant="secondary" className="self-start" onClick={() => setOutcomes([])}>
          {t.close}
        </Button>
      )}
    </aside>
  );
}
