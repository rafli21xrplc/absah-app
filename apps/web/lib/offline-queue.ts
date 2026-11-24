import { ApiError } from './api';
import type { ExceptionStatus } from './attendance';

/** A session filled without signal (PRS-08): waits on the phone until the API can be reached. */
export interface QueuedSession {
  /** `${userId}:${sessionId}`: filling the same session again replaces the earlier entry. */
  id: string;
  userId: string;
  schoolId: string;
  sessionId: string;
  /** Shown in the list of waiting sessions, e.g. "VII A" or "VII A · Matematika". */
  title: string;
  exceptions: { enrollmentId: string; status: ExceptionStatus }[];
  topic?: string;
  /** The moment the teacher tapped "Kirim"; the API shows it when the session was locked meanwhile. */
  capturedAt: string;
  /** One key per queued item, reused by every resend (the API replies with the same answer). */
  idempotencyKey: string;
  /** Sends that got no answer so far (no signal, gateway down). */
  attempts?: number;
  /** Not before this moment (ISO): the wait grows with `attempts`. "Kirim sekarang" and a back-online signal ignore it. */
  nextAttemptAt?: string;
  /** The server answered "no" for good (e.g. the change window is over). The item stays, with the reason in plain words, until "Coba lagi". */
  rejected?: { message: string; at: string };
}

/** Wait before the next automatic try after `attempts` failures: 15 s, 30 s, 1 min, 2 min, then 5 min at most. */
export function backoffMs(attempts: number): number {
  return Math.min(15_000 * 2 ** Math.max(0, attempts - 1), 300_000);
}

/** One more send without an answer: counts it and sets when the next automatic try may happen. */
export function afterNoAnswer(item: QueuedSession, now: Date): QueuedSession {
  const attempts = (item.attempts ?? 0) + 1;
  return { ...item, attempts, nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)).toISOString() };
}

/** "Coba lagi": the refusal is forgotten and the item is due at once. The key stays: the answer to a resend is the same. */
export function forRetry(item: QueuedSession): QueuedSession {
  const { rejected: _rejected, nextAttemptAt: _next, ...rest } = item;
  return rest;
}

/** Waiting for its turn (not refused, and its wait is over). */
export const isDue = (item: QueuedSession, now: Date): boolean => !item.rejected && (item.nextAttemptAt === undefined || item.nextAttemptAt <= now.toISOString());

export const queuedId = (userId: string, sessionId: string) => `${userId}:${sessionId}`;

interface Cached {
  value: unknown;
  savedAt: string;
}

/** Where the queue and the copies kept for offline use live: IndexedDB on the phone, memory in tests. */
export interface OfflineStore {
  queue(userId: string): Promise<QueuedSession[]>;
  enqueue(item: QueuedSession): Promise<void>;
  dequeue(id: string): Promise<void>;
  cached(key: string): Promise<Cached | null>;
  keep(key: string, value: unknown, savedAt?: string): Promise<void>;
  /** On sign-out: the copies of rosters go; the queue stays (it is keyed by user and sent only for that user). */
  clearCached(): Promise<void>;
}

export function memoryStore(): OfflineStore {
  const items = new Map<string, QueuedSession>();
  const copies = new Map<string, Cached>();
  return {
    queue: (userId) => Promise.resolve([...items.values()].filter((i) => i.userId === userId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))),
    enqueue: (item) => Promise.resolve(void items.set(item.id, item)),
    dequeue: (id) => Promise.resolve(void items.delete(id)),
    cached: (key) => Promise.resolve(copies.get(key) ?? null),
    keep: (key, value, savedAt = new Date().toISOString()) => Promise.resolve(void copies.set(key, { value, savedAt })),
    clearCached: () => Promise.resolve(copies.clear()),
  };
}

const DB_NAME = 'absah-staff-offline';

const wrap = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexeddb'));
  });

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('queue', { keyPath: 'id' });
      open.result.createObjectStore('cache', { keyPath: 'key' });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('indexeddb'));
  });
}

/** IndexedDB when the browser has it and lets us use it; otherwise memory (the queue then only lives while the tab does). */
export function indexedDbStore(): OfflineStore {
  let opened: Promise<IDBDatabase> | null = null;
  const fallback = memoryStore();
  const withDb = async <T>(run: (db: IDBDatabase) => Promise<T>, backup: () => Promise<T>): Promise<T> => {
    try {
      opened ??= openDb();
      return await run(await opened);
    } catch {
      return backup();
    }
  };
  const store = (db: IDBDatabase, name: 'queue' | 'cache', mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name);
  return {
    queue: (userId) =>
      withDb(
        async (db) => ((await wrap(store(db, 'queue', 'readonly').getAll())) as QueuedSession[]).filter((i) => i.userId === userId).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
        () => fallback.queue(userId),
      ),
    enqueue: (item) =>
      withDb(
        async (db) => void (await wrap(store(db, 'queue', 'readwrite').put(item))),
        () => fallback.enqueue(item),
      ),
    dequeue: (id) =>
      withDb(
        async (db) => void (await wrap(store(db, 'queue', 'readwrite').delete(id))),
        () => fallback.dequeue(id),
      ),
    cached: (key) =>
      withDb(
        async (db) => ((await wrap(store(db, 'cache', 'readonly').get(key))) as ({ key: string } & Cached) | undefined) ?? null,
        () => fallback.cached(key),
      ),
    keep: (key, value, savedAt = new Date().toISOString()) =>
      withDb(
        async (db) => void (await wrap(store(db, 'cache', 'readwrite').put({ key, value, savedAt }))),
        () => fallback.keep(key, value, savedAt),
      ),
    clearCached: () =>
      withDb(
        async (db) => void (await wrap(store(db, 'cache', 'readwrite').clear())),
        () => fallback.clearCached(),
      ),
  };
}

let shared: OfflineStore | null = null;
/** The one store of this tab. */
export const offlineStore = (): OfflineStore => (shared ??= typeof indexedDB === 'undefined' ? memoryStore() : indexedDbStore());

export const QUEUE_CHANGED_EVENT = 'absah:queue-changed';

/** Puts a filled session on the phone's queue and tells the banner. */
export async function queueSession(item: QueuedSession, store: OfflineStore = offlineStore()): Promise<void> {
  await store.enqueue(item);
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

/** No answer from the API (fetch failed: no signal) or a gateway that is down: the same request is worth sending again later. */
export function isTransient(err: unknown): boolean {
  if (err instanceof ApiError) return [408, 429, 502, 503, 504].includes(err.status);
  return err instanceof TypeError;
}

export const sessionCacheKey = (schoolId: string, sessionId: string) => `session:${schoolId}:${sessionId}`;
export const todayCacheKey = (schoolId: string, scope: string) => `today:${schoolId}:${scope}`;
export const contextCacheKey = 'me-context';

/** "terakhir diperbarui" line for data shown from the phone's copy, on the school clock. */
export function savedLabel(savedAt: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).formatToParts(new Date(savedAt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}.${get('minute')}`;
}
