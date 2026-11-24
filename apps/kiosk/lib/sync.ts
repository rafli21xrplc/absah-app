import { KIOSK_SCAN_BATCH_MAX, KioskScanResults, type KioskScanResult } from '@absah/contracts';
import type { KioskApi } from './kiosk-api';
import type { KioskStore } from './store';

/**
 * Sends the queue in batches, oldest first, until it is empty or the network fails. A batch is
 * removed only after the server answered; a lost answer means the same scans go again, and the
 * server returns its stored results per clientEventId, so each scan counts exactly once. A fresh
 * Idempotency-Key per attempt is fine for the same reason.
 */
export async function syncQueue(store: KioskStore, api: KioskApi, token: string): Promise<KioskScanResult[]> {
  const answered: KioskScanResult[] = [];
  for (;;) {
    const batch = await store.peek(KIOSK_SCAN_BATCH_MAX);
    if (batch.length === 0) return answered;
    const { results } = await api('/kiosk/scans', KioskScanResults, {
      method: 'POST',
      token,
      idempotencyKey: crypto.randomUUID(),
      body: { scans: batch },
    });
    await store.remove(results.map((r) => r.clientEventId));
    answered.push(...results);
  }
}
