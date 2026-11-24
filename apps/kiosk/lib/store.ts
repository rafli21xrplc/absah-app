import type { KioskDay } from '@absah/contracts';

/** What pairing leaves on the device. The token is the kiosk's only credential. */
export interface Pairing {
  token: string;
  kioskId: string;
  kioskName: string;
  schoolName: string;
  timezone: string;
}

/** One scan waiting to be sent (GRB-03: the queue survives reloads and power loss). */
export interface QueuedScan {
  clientEventId: string;
  token: string;
  scannedAt: string;
}

export interface KioskStore {
  getPairing(): Promise<Pairing | null>;
  setPairing(p: Pairing | null): Promise<void>;
  getDay(): Promise<KioskDay | null>;
  setDay(d: KioskDay | null): Promise<void>;
  /** Cards that arrived on a school date (local duplicate check while offline). */
  getSeen(schoolDate: string): Promise<string[]>;
  addSeen(schoolDate: string, cardId: string): Promise<void>;
  enqueue(scan: QueuedScan): Promise<void>;
  /** Oldest first. */
  peek(limit: number): Promise<QueuedScan[]>;
  remove(clientEventIds: string[]): Promise<void>;
  queueSize(): Promise<number>;
  /** Unpairing wipes everything (keys, roster, queue). */
  clear(): Promise<void>;
}

/** For tests and as a fallback when IndexedDB is unavailable (private mode). */
export function memoryStore(): KioskStore {
  const kv = new Map<string, unknown>();
  const queue = new Map<string, QueuedScan>();
  return {
    getPairing: async () => (kv.get('pairing') as Pairing | undefined) ?? null,
    setPairing: async (p) => void kv.set('pairing', p),
    getDay: async () => (kv.get('day') as KioskDay | undefined) ?? null,
    setDay: async (d) => void kv.set('day', d),
    getSeen: async (date) => (kv.get(`seen:${date}`) as string[] | undefined) ?? [],
    addSeen: async (date, cardId) => void kv.set(`seen:${date}`, [...((kv.get(`seen:${date}`) as string[] | undefined) ?? []), cardId]),
    enqueue: async (scan) => void queue.set(scan.clientEventId, scan),
    peek: async (limit) => [...queue.values()].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt)).slice(0, limit),
    remove: async (ids) => ids.forEach((id) => queue.delete(id)),
    queueSize: async () => queue.size,
    clear: async () => {
      kv.clear();
      queue.clear();
    },
  };
}

const DB = 'absah-kiosk';
const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

/** IndexedDB: store "kv" (pairing, day, seen:<date>) and store "queue" (by clientEventId). */
export async function indexedDbStore(): Promise<KioskStore> {
  const open = indexedDB.open(DB, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore('kv');
    open.result.createObjectStore('queue', { keyPath: 'clientEventId' }).createIndex('scannedAt', 'scannedAt');
  };
  const db = await req(open);
  const store = (name: 'kv' | 'queue', mode: IDBTransactionMode = 'readonly') => db.transaction(name, mode).objectStore(name);
  const get = async <T>(key: string) => ((await req(store('kv').get(key))) as T | undefined) ?? null;
  const put = async (key: string, value: unknown) => void (await req(store('kv', 'readwrite').put(value, key)));
  return {
    getPairing: () => get('pairing'),
    setPairing: (p) => put('pairing', p),
    getDay: () => get('day'),
    setDay: (d) => put('day', d),
    getSeen: async (date) => (await get<string[]>(`seen:${date}`)) ?? [],
    addSeen: async (date, cardId) => put(`seen:${date}`, [...((await get<string[]>(`seen:${date}`)) ?? []), cardId]),
    enqueue: async (scan) => void (await req(store('queue', 'readwrite').put(scan))),
    peek: async (limit) => req(store('queue').index('scannedAt').getAll(null, limit)) as Promise<QueuedScan[]>,
    remove: async (ids) => {
      const tx = db.transaction('queue', 'readwrite');
      ids.forEach((id) => tx.objectStore('queue').delete(id));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    queueSize: () => req(store('queue').count()),
    clear: async () => {
      await req(store('kv', 'readwrite').clear());
      await req(store('queue', 'readwrite').clear());
    },
  };
}
