import { SyncSessionResult } from '@absah/contracts';
import { messages } from '@absah/ui/messages';
import { api, ApiError } from './api';
import { afterNoAnswer, forRetry, isDue, isTransient, type OfflineStore, type QueuedSession } from './offline-queue';

const t = messages.offline;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));

export type SyncKind = 'submitted' | 'correction_requested' | 'unchanged' | 'rejected';

/** What happened to one queued session, in words for the teacher. */
export interface SyncOutcome {
  id: string;
  sessionId: string;
  kind: SyncKind;
  text: string;
}

export const SESSIONS_SYNCED_EVENT = 'absah:sessions-synced';

export function describeResult(title: string, result: SyncSessionResult): { kind: Exclude<SyncKind, 'rejected'>; text: string } {
  if (result.outcome === 'submitted') return { kind: 'submitted', text: fill(t.submitted, { title }) };
  if (result.outcome === 'correction_requested') return { kind: 'correction_requested', text: fill(t.correction, { title, n: result.corrections.length }) };
  return { kind: 'unchanged', text: fill(t.unchanged, { title }) };
}

/** "Presensi X-2 belum terkirim. Batas ubah sudah lewat. Hubungi wali kelas." The API's own sentence says why. */
export const rejectionText = (title: string, why: string | undefined): string => fill(t.rejected, { title, why: why?.trim() || t.rejectedNoReason });

export const sendQueued = (item: QueuedSession) =>
  api(`/sessions/${item.sessionId}/sync`, SyncSessionResult, {
    method: 'POST',
    schoolId: item.schoolId,
    idempotencyKey: item.idempotencyKey,
    body: { exceptions: item.exceptions, capturedAt: item.capturedAt, ...(item.topic === undefined ? {} : { topic: item.topic }) },
  });

export interface SyncOptions {
  /** The clock (tests). */
  now?: Date;
  /** Ignore the growing wait between tries: "Kirim sekarang", or the browser says it is online again. */
  force?: boolean;
  /** "Coba lagi": also take the items the server refused, as if they were new. */
  retry?: boolean;
  /** Only this item (the "Coba lagi" of one banner). */
  only?: string;
}

/**
 * Sends the user's waiting sessions oldest first. A session leaves the queue only after the API answered it with success.
 * - No answer (no signal, gateway down): the item stays, counts the try and waits longer (15 s, 30 s, 1 min, ... 5 min);
 *   the run stops, the rest waits for the next try. The Idempotency-Key never changes, so a resend after a lost reply is safe.
 * - A refusal for good (e.g. the change window is over): the item STAYS with the reason, and is not sent again until "Coba lagi".
 * - Sign-out (401) stops too: the queue stays for when the same user logs in again.
 */
export async function syncPending(store: OfflineStore, userId: string, send: (item: QueuedSession) => Promise<SyncSessionResult> = sendQueued, options: SyncOptions = {}): Promise<SyncOutcome[]> {
  const now = options.now ?? new Date();
  const outcomes: SyncOutcome[] = [];
  for (const queued of await store.queue(userId)) {
    if (options.only !== undefined && queued.id !== options.only) continue;
    if (queued.rejected && !options.retry) continue;
    const item = queued.rejected ? forRetry(queued) : queued;
    if (!options.force && !isDue(item, now)) continue;
    try {
      const result = await send(item);
      await store.dequeue(item.id);
      outcomes.push({ id: item.id, sessionId: item.sessionId, ...describeResult(item.title, result) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) break;
      if (isTransient(err)) {
        await store.enqueue(afterNoAnswer(item, now));
        break;
      }
      const text = rejectionText(item.title, err instanceof ApiError ? err.message : undefined);
      await store.enqueue({ ...item, rejected: { message: text, at: now.toISOString() } });
      outcomes.push({ id: item.id, sessionId: item.sessionId, kind: 'rejected', text });
    }
  }
  return outcomes;
}
