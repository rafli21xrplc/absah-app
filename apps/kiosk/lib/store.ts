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

/** One check-out with a listed penjemput waiting to be sent (GRB-10). checkedOutAt is the scan time. */
export interface QueuedCheckout {
  clientEventId: string;
  token: string;
  pickupGuardianId: string;
  checkedOutAt: string;
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
  /** Scans and check-outs not sent yet. */
  queueSize(): Promise<number>;
  /** Cards released on a school date (local duplicate check while offline). */
  getOut(schoolDate: string): Promise<string[]>;
  addOut(schoolDate: string, cardId: string): Promise<void>;
  enqueueCheckout(checkout: QueuedCheckout): Promise<void>;
  /** Oldest first. */
  peekCheckouts(limit: number): Promise<QueuedCheckout[]>;
  removeCheckouts(clientEventIds: string[]): Promise<void>;
  /** Penjemput photos from the morning download, by pickup guardian id. */
  getPhoto(id: string): Promise<Blob | null>;
  putPhoto(id: string, photo: Blob): Promise<void>;
  photoIds(): Promise<string[]>;
  removePhotos(ids: string[]): Promise<void>;
  /** Unpairing wipes everything (keys, roster, photos, queues). */
  clear(): Promise<void>;
}

/** For tests and as a fallback when IndexedDB is unavailable (private mode). */
export function memoryStore(): KioskStore {
  const kv = new Map<string, unknown>();
  const queue = new Map<string, QueuedScan>();
  const checkouts = new Map<string, QueuedCheckout>();
  const photos = new Map<string, Blob>();
  const list = (key: string) => (kv.get(key) as string[] | undefined) ?? [];
  return {
    getPairing: async () => (kv.get('pairing') as Pairing | undefined) ?? null,
    setPairing: async (p) => void kv.set('pairing', p),
    getDay: async () => (kv.get('day') as KioskDay | undefined) ?? null,
    setDay: async (d) => void kv.set('day', d),
    getSeen: async (date) => list(`seen:${date}`),
    addSeen: async (date, cardId) => void kv.set(`seen:${date}`, [...list(`seen:${date}`), cardId]),
    enqueue: async (scan) => void queue.set(scan.clientEventId, scan),
    peek: async (limit) => [...queue.values()].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt)).slice(0, limit),
    remove: async (ids) => ids.forEach((id) => queue.delete(id)),
    queueSize: async () => queue.size + checkouts.size,
    getOut: async (date) => list(`out:${date}`),
    addOut: async (date, cardId) => void kv.set(`out:${date}`, [...list(`out:${date}`), cardId]),
    enqueueCheckout: async (c) => void checkouts.set(c.clientEventId, c),
    peekCheckouts: async (limit) => [...checkouts.values()].sort((a, b) => a.checkedOutAt.localeCompare(b.checkedOutAt)).slice(0, limit),
    removeCheckouts: async (ids) => ids.forEach((id) => checkouts.delete(id)),
    getPhoto: async (id) => photos.get(id) ?? null,
    putPhoto: async (id, photo) => void photos.set(id, photo),
    photoIds: async () => [...photos.keys()],
    removePhotos: async (ids) => ids.forEach((id) => photos.delete(id)),
    clear: async () => {
      kv.clear();
      queue.clear();
      checkouts.clear();
      photos.clear();
    },
  };
}

const DB = 'absah-kiosk';
const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

type StoreName = 'kv' | 'queue' | 'checkouts' | 'photos';

/**
 * IndexedDB: "kv" (pairing, day, seen:<date>, out:<date>), "queue" (scans by clientEventId),
 * "checkouts" (check-outs by clientEventId) and "photos" (penjemput photo blobs by guardian id).
 * Version 2 added the last two.
 */
export async function indexedDbStore(): Promise<KioskStore> {
  const open = indexedDB.open(DB, 2);
  open.onupgradeneeded = (event) => {
    const db = open.result;
    if (event.oldVersion < 1) {
      db.createObjectStore('kv');
      db.createObjectStore('queue', { keyPath: 'clientEventId' }).createIndex('scannedAt', 'scannedAt');
    }
    if (event.oldVersion < 2) {
      db.createObjectStore('checkouts', { keyPath: 'clientEventId' }).createIndex('checkedOutAt', 'checkedOutAt');
      db.createObjectStore('photos');
    }
  };
  const db = await req(open);
  const store = (name: StoreName, mode: IDBTransactionMode = 'readonly') => db.transaction(name, mode).objectStore(name);
  const get = async <T>(key: string) => ((await req(store('kv').get(key))) as T | undefined) ?? null;
  const put = async (key: string, value: unknown) => void (await req(store('kv', 'readwrite').put(value, key)));
  const deleteAll = async (name: StoreName, ids: string[]) => {
    const tx = db.transaction(name, 'readwrite');
    ids.forEach((id) => tx.objectStore(name).delete(id));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  };
  return {
    getPairing: () => get('pairing'),
    setPairing: (p) => put('pairing', p),
    getDay: () => get('day'),
    setDay: (d) => put('day', d),
    getSeen: async (date) => (await get<string[]>(`seen:${date}`)) ?? [],
    addSeen: async (date, cardId) => put(`seen:${date}`, [...((await get<string[]>(`seen:${date}`)) ?? []), cardId]),
    enqueue: async (scan) => void (await req(store('queue', 'readwrite').put(scan))),
    peek: async (limit) => req(store('queue').index('scannedAt').getAll(null, limit)) as Promise<QueuedScan[]>,
    remove: (ids) => deleteAll('queue', ids),
    queueSize: async () => (await req(store('queue').count())) + (await req(store('checkouts').count())),
    getOut: async (date) => (await get<string[]>(`out:${date}`)) ?? [],
    addOut: async (date, cardId) => put(`out:${date}`, [...((await get<string[]>(`out:${date}`)) ?? []), cardId]),
    enqueueCheckout: async (c) => void (await req(store('checkouts', 'readwrite').put(c))),
    peekCheckouts: async (limit) => req(store('checkouts').index('checkedOutAt').getAll(null, limit)) as Promise<QueuedCheckout[]>,
    removeCheckouts: (ids) => deleteAll('checkouts', ids),
    getPhoto: async (id) => ((await req(store('photos').get(id))) as Blob | undefined) ?? null,
    putPhoto: async (id, photo) => void (await req(store('photos', 'readwrite').put(photo, id))),
    photoIds: async () => (await req(store('photos').getAllKeys())).map(String),
    removePhotos: (ids) => deleteAll('photos', ids),
    clear: async () => {
      for (const name of ['kv', 'queue', 'checkouts', 'photos'] as const) await req(store(name, 'readwrite').clear());
    },
  };
}
