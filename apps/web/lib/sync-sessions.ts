import { SyncSessionResult } from '@absah/contracts';
import { api, ApiError } from './api';
import { isTransient, type OfflineStore, type QueuedSession } from './offline-queue';

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
  if (result.outcome === 'submitted') return { kind: 'submitted', text: `${title}: presensi terkirim.` };
  if (result.outcome === 'correction_requested') {
    return { kind: 'correction_requested', text: `${title}: sesi sudah terkunci, jadi ${result.corrections.length} perubahan diajukan sebagai koreksi ke wakasek.` };
  }
  return { kind: 'unchanged', text: `${title}: sudah tercatat sama, tidak ada yang berubah.` };
}

export const sendQueued = (item: QueuedSession) =>
  api(`/sessions/${item.sessionId}/sync`, SyncSessionResult, {
    method: 'POST',
    schoolId: item.schoolId,
    idempotencyKey: item.idempotencyKey,
    body: { exceptions: item.exceptions, capturedAt: item.capturedAt, ...(item.topic === undefined ? {} : { topic: item.topic }) },
  });

/**
 * Sends the user's waiting sessions oldest first. A session leaves the queue only after the API answered it: an answer
 * (including a refusal) is final; no answer (no signal, gateway down) stops the run and the rest waits for the next try.
 * Sign-out (401) also stops: the queue stays for when the same user logs in again.
 */
export async function syncPending(store: OfflineStore, userId: string, send: (item: QueuedSession) => Promise<SyncSessionResult> = sendQueued): Promise<SyncOutcome[]> {
  const outcomes: SyncOutcome[] = [];
  for (const item of await store.queue(userId)) {
    try {
      const result = await send(item);
      await store.dequeue(item.id);
      outcomes.push({ id: item.id, sessionId: item.sessionId, ...describeResult(item.title, result) });
    } catch (err) {
      if (isTransient(err) || (err instanceof ApiError && err.status === 401)) break;
      await store.dequeue(item.id);
      const why = err instanceof ApiError ? err.message : 'Tidak bisa diproses.';
      outcomes.push({ id: item.id, sessionId: item.sessionId, kind: 'rejected', text: `${item.title}: tidak terkirim. ${why} Hubungi wakasek bila perlu.` });
    }
  }
  return outcomes;
}
