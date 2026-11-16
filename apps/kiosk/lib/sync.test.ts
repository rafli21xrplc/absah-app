import type { KioskScanResult } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import type { KioskApi } from './kiosk-api';
import { memoryStore, type QueuedScan } from './store';
import { syncQueue } from './sync';

/** A fake server that keeps answers per clientEventId, like POST /kiosk/scans. */
function fakeServer(failures: ('offline' | 'lost')[]) {
  const recorded = new Map<string, KioskScanResult>();
  const batches: number[] = [];
  const api: KioskApi = async (_path, contract, call) => {
    const { scans } = call?.body as { scans: QueuedScan[] };
    const failure = failures.shift();
    if (failure === 'offline') throw new TypeError('Failed to fetch');
    batches.push(scans.length);
    const results = scans.map((s) => {
      const known = recorded.get(s.clientEventId) ?? { clientEventId: s.clientEventId, result: 'accepted' as const, rejectReason: null, outcome: 'on_time' as const, firstName: 'Nadia' };
      recorded.set(s.clientEventId, known);
      return known;
    });
    if (failure === 'lost') throw new TypeError('connection reset'); // recorded, answer lost
    return contract.parse({ results });
  };
  return { api, recorded, batches };
}

const scans = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ clientEventId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, token: `A1.x.${i}`, scannedAt: new Date(Date.UTC(2026, 10, 16, 0, 0, i)).toISOString() }));

describe('syncQueue', () => {
  it('keeps the queue while offline and after a lost answer, then records each scan exactly once', async () => {
    const store = memoryStore();
    for (const s of scans(450)) await store.enqueue(s);
    const server = fakeServer(['offline', 'lost']);

    await expect(syncQueue(store, server.api, 'token')).rejects.toThrow();
    expect(await store.queueSize()).toBe(450);
    await expect(syncQueue(store, server.api, 'token')).rejects.toThrow();
    expect(await store.queueSize()).toBe(450);

    const answered = await syncQueue(store, server.api, 'token');
    expect(await store.queueSize()).toBe(0);
    expect(answered).toHaveLength(450);
    expect(server.recorded.size).toBe(450);
    // 200 per batch; the first 200 went twice (the lost answer).
    expect(server.batches).toEqual([200, 200, 200, 50]);
  });
});
