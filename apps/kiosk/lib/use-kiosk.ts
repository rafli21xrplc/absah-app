'use client';

import { KioskDay, KioskHeartbeatResponse, PairKioskResponse } from '@absah/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiBaseUrl, createKioskApi, isRevoked, type KioskApi } from './kiosk-api';
import { indexedDbStore, memoryStore, type KioskStore, type Pairing } from './store';
import { syncQueue } from './sync';
import { checkLocally, dayIsCurrent, isCardToken, type LocalVerdict } from './verify';
import { loadHosts, registerVisit, type Attempt, type VisitorForm } from './visitors';

export const APP_VERSION = '0.4.0';
const SYNC_EVERY_MS = 15_000;
const HEARTBEAT_EVERY_MS = 60_000;
const DAY_REFRESH_MS = 30 * 60_000;

export type KioskState =
  | { phase: 'loading' }
  | { phase: 'unpaired'; revoked: boolean }
  | { phase: 'ready'; pairing: Pairing; day: KioskDay | null; queueSize: number; online: boolean; syncedAt: number | null };

/** What the screen shows for one scan; `queued` = no day download yet, the server will decide. */
export type ScanFeedback = LocalVerdict | { kind: 'queued' };

/**
 * The kiosk's whole runtime: pairing, the morning download, offline checks, the IndexedDB queue,
 * background sync and heartbeat. Scans never wait for the network.
 */
export function useKiosk() {
  const [state, setState] = useState<KioskState>({ phase: 'loading' });
  const store = useRef<KioskStore | null>(null);
  const api = useRef<KioskApi>(createKioskApi(apiBaseUrl()));
  const syncing = useRef(false);
  /** Staff a guest can name; null while the school has no guest book (or it is not known yet). */
  const [hosts, setHosts] = useState<{ id: string; name: string }[] | null>(null);

  const unpair = useCallback(async (revoked: boolean) => {
    await store.current?.clear();
    setState({ phase: 'unpaired', revoked });
  }, []);

  /** Runs a network step; offline and server errors only flip the online flag, 401 unpairs. */
  const online = useCallback(
    async (step: (pairing: Pairing, s: KioskStore) => Promise<void>) => {
      const s = store.current;
      const pairing = await s?.getPairing();
      if (!s || !pairing) return;
      try {
        await step(pairing, s);
        const queueSize = await s.queueSize();
        setState((prev) => (prev.phase === 'ready' ? { ...prev, online: true, queueSize } : prev));
      } catch (err) {
        if (isRevoked(err)) return unpair(true);
        setState((prev) => (prev.phase === 'ready' ? { ...prev, online: false } : prev));
      }
    },
    [unpair],
  );

  const refreshDay = useCallback(
    () =>
      online(async (pairing, s) => {
        const day = await api.current('/kiosk/day', KioskDay, { token: pairing.token });
        await s.setDay(day);
        setState((prev) => (prev.phase === 'ready' ? { ...prev, day } : prev));
      }),
    [online],
  );

  const refreshHosts = useCallback(
    () =>
      online(async (pairing) => {
        setHosts(await loadHosts(api.current, pairing.token));
      }),
    [online],
  );

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await online(async (pairing, s) => {
        await syncQueue(s, api.current, pairing.token);
        setState((prev) => (prev.phase === 'ready' ? { ...prev, syncedAt: Date.now() } : prev));
      });
    } finally {
      syncing.current = false;
    }
  }, [online]);

  const heartbeat = useCallback(
    () =>
      online(async (pairing, s) => {
        await api.current('/kiosk/heartbeat', KioskHeartbeatResponse, {
          method: 'POST',
          token: pairing.token,
          idempotencyKey: crypto.randomUUID(),
          body: { queueSize: await s.queueSize(), appVersion: APP_VERSION },
        });
      }),
    [online],
  );

  useEffect(() => {
    void (async () => {
      store.current = await indexedDbStore().catch(() => memoryStore());
      const pairing = await store.current.getPairing();
      if (!pairing) return setState({ phase: 'unpaired', revoked: false });
      const day = await store.current.getDay();
      setState({ phase: 'ready', pairing, day, queueSize: await store.current.queueSize(), online: navigator.onLine, syncedAt: null });
    })();
  }, []);

  const ready = state.phase === 'ready';
  useEffect(() => {
    if (!ready) return;
    const tick = async () => {
      const day = await store.current?.getDay();
      if (!dayIsCurrent(day ?? null, Date.now())) await refreshDay();
      await sync();
    };
    void tick().then(heartbeat).then(refreshHosts);
    const timers = [setInterval(() => void tick(), SYNC_EVERY_MS), setInterval(() => void heartbeat(), HEARTBEAT_EVERY_MS), setInterval(() => void refreshDay(), DAY_REFRESH_MS), setInterval(() => void refreshHosts(), DAY_REFRESH_MS)];
    const back = () => void tick();
    window.addEventListener('online', back);
    return () => {
      timers.forEach(clearInterval);
      window.removeEventListener('online', back);
    };
  }, [ready, refreshDay, sync, heartbeat, refreshHosts]);

  const pair = useCallback(async (input: { pairingCode: string; name: string; idempotencyKey: string }) => {
    const res = await api.current('/kiosk/pair', PairKioskResponse, {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
      body: { pairingCode: input.pairingCode.trim(), name: input.name.trim(), appVersion: APP_VERSION },
    });
    const pairing: Pairing = { token: res.deviceToken, kioskId: res.kiosk.id, kioskName: res.kiosk.name, schoolName: res.school.name, timezone: res.school.timezone };
    await store.current?.setPairing(pairing);
    setState({ phase: 'ready', pairing, day: null, queueSize: 0, online: true, syncedAt: null });
  }, []);

  /** One scan: decide locally, queue it, show the result; the server catches up in the background. */
  const scan = useCallback(
    async (text: string): Promise<ScanFeedback> => {
      const s = store.current;
      const token = text.trim();
      if (!s || !isCardToken(token)) return { kind: 'rejected', reason: 'malformed' };
      const now = Date.now();
      const day = await s.getDay();
      const verdict: ScanFeedback = day ? await checkLocally(day, await s.getSeen(day.schoolDate), token, now) : { kind: 'queued' };
      if (verdict.kind === 'arrived') await s.addSeen(verdict.schoolDate, verdict.cardId);
      await s.enqueue({ clientEventId: crypto.randomUUID(), token, scannedAt: new Date(now).toISOString() });
      const queueSize = await s.queueSize();
      setState((prev) => (prev.phase === 'ready' ? { ...prev, queueSize } : prev));
      void sync();
      return verdict;
    },
    [sync],
  );

  /** A guest signs in (GRB-11). Needs the network: errors reach the form, which says so. */
  const registerVisitor = useCallback(async (form: VisitorForm, photo: Blob | null, attempt: Attempt): Promise<void> => {
    const pairing = await store.current?.getPairing();
    if (!pairing) throw new TypeError('not paired');
    try {
      await registerVisit({ api: api.current, token: pairing.token }, form, photo, attempt);
    } catch (err) {
      if (isRevoked(err)) await unpair(true);
      throw err;
    }
  }, [unpair]);

  return { state, pair, scan, hosts, registerVisitor };
}
