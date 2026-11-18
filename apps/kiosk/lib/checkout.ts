import { KIOSK_CHECKOUT_BATCH_MAX, KioskCheckoutResults, KioskUnlistedPickup, PICKUP_PHOTO_MAX_BYTES, type KioskCheckoutResult, type KioskDay, type KioskPickupStudent, type ScanRejectReason } from '@absah/contracts';
import { KioskApiError, type KioskApi } from './kiosk-api';
import type { KioskStore } from './store';
import { checkLocally } from './verify';
import { uploadPhoto, type Attempt, type RegisterDeps } from './visitors';

export type PickupGuardianOption = KioskPickupStudent['guardians'][number];

/** What the screen does after a scan in Pulang mode. */
export type CheckoutVerdict =
  | { kind: 'pick'; cardId: string; schoolDate: string; firstName: string; className: string; guardians: PickupGuardianOption[]; token: string; scannedAt: string }
  | { kind: 'already_out'; firstName: string; className: string }
  | { kind: 'rejected'; reason: ScanRejectReason };

/**
 * GRB-10, offline: the card is checked like an arrival (day key, bound phone), then the morning list
 * gives the student's approved penjemput. A student released today on this kiosk is not released twice.
 */
export async function checkForCheckout(day: KioskDay, out: readonly string[], token: string, ms: number): Promise<CheckoutVerdict> {
  const verdict = await checkLocally(day, [], token, ms);
  if (verdict.kind === 'rejected') return verdict;
  if (verdict.kind !== 'arrived') return { kind: 'rejected', reason: 'unknown_card' };
  const who = { firstName: verdict.firstName, className: verdict.className };
  if (out.includes(verdict.cardId)) return { kind: 'already_out', ...who };
  const guardians = day.pickup?.find((p) => p.cardId === verdict.cardId)?.guardians ?? [];
  return { kind: 'pick', cardId: verdict.cardId, schoolDate: verdict.schoolDate, ...who, guardians, token: token.trim(), scannedAt: new Date(ms).toISOString() };
}

/** Sends queued check-outs like scans: removed only once the server answered (exactly once per clientEventId). */
export async function syncCheckouts(store: KioskStore, api: KioskApi, token: string): Promise<KioskCheckoutResult[]> {
  const answered: KioskCheckoutResult[] = [];
  for (;;) {
    const batch = await store.peekCheckouts(KIOSK_CHECKOUT_BATCH_MAX);
    if (batch.length === 0) return answered;
    try {
      const { results } = await api('/kiosk/checkouts', KioskCheckoutResults, { method: 'POST', token, idempotencyKey: crypto.randomUUID(), body: { checkouts: batch } });
      await store.removeCheckouts(results.map((r) => r.clientEventId));
      answered.push(...results);
    } catch (err) {
      // gate.pickup was switched off: nothing in the queue can be recorded any more.
      if (err instanceof KioskApiError && err.status === 404) {
        await store.removeCheckouts(batch.map((c) => c.clientEventId));
        return answered;
      }
      throw err;
    }
  }
}

/**
 * The morning list's photos into the device, so the kiosk shows them offline; photos of penjemput no
 * longer on the list are dropped. The links live 5 minutes, so this runs right after the download.
 */
export async function syncPhotos(store: KioskStore, day: KioskDay, get: typeof fetch = fetch): Promise<number> {
  const wanted = new Map((day.pickup ?? []).flatMap((s) => s.guardians.map((g) => [g.id, g.photoUrl] as const)));
  const have = new Set(await store.photoIds());
  await store.removePhotos([...have].filter((id) => !wanted.has(id)));
  let fetched = 0;
  for (const [id, url] of wanted) {
    if (have.has(id)) continue;
    const res = await get(url, { cache: 'no-store', credentials: 'omit' });
    if (!res.ok) continue; // the next download tries again
    await store.putPhoto(id, await res.blob());
    fetched += 1;
  }
  return fetched;
}

/**
 * An unlisted penjemput (online only): the photo first, then the held request. The same Attempt can be
 * sent again after a dropped connection; the server keeps one request per clientEventId.
 */
export async function requestUnlisted(deps: RegisterDeps, input: { token: string; scannedAt: string; name: string; photo: Blob }, attempt: Attempt): Promise<KioskUnlistedPickup> {
  const name = input.name.trim();
  if (!name) throw new Error('Tulis nama penjemput.');
  if (input.photo.size > PICKUP_PHOTO_MAX_BYTES) throw new Error('Foto terlalu besar. Ambil ulang.');
  const photoId = await uploadPhoto(deps, input.photo, attempt, '/kiosk/pickup-photos');
  return deps.api('/kiosk/unlisted-pickups', KioskUnlistedPickup, {
    method: 'POST',
    token: deps.token,
    idempotencyKey: attempt.submitKey,
    body: { clientEventId: attempt.clientEventId, token: input.token, name, photoId, requestedAt: input.scannedAt },
  });
}

/** Plain words for a failed unlisted request. */
export function unlistedError(err: unknown): string {
  if (err instanceof TypeError) return 'Butuh sambungan internet untuk penjemput tidak terdaftar. Hubungi wali kelas atau guru piket.';
  if (err instanceof KioskApiError && (err.status === 400 || err.status === 409)) return err.message;
  if (err instanceof Error && err.message.startsWith('upload_')) return 'Foto tidak terunggah. Ambil ulang.';
  if (err instanceof Error && !(err instanceof KioskApiError)) return err.message;
  return 'Belum terkirim. Coba lagi, atau lapor ke guru piket.';
}
