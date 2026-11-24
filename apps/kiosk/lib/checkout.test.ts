import { deviceDayKey, makeCardToken, schoolDateAt, schoolDayKey, toBase64Url, type KioskCheckoutResult, type KioskDay } from '@absah/contracts';
import { describe, expect, it, vi } from 'vitest';
import { checkForCheckout, requestUnlisted, syncCheckouts, syncPhotos, unlistedError } from './checkout';
import { KioskApiError, type KioskApi } from './kiosk-api';
import { memoryStore, type QueuedCheckout } from './store';
import { newAttempt } from './visitors';

const tz = 'Asia/Jakarta';
const secret = new Uint8Array(32).fill(7);
const card = { cardId: '0190a6c4-0000-7000-8000-000000000001', deviceId: '0190a6c4-0000-7000-8000-0000000000d1' };
const other = { cardId: '0190a6c4-0000-7000-8000-000000000002', deviceId: '0190a6c4-0000-7000-8000-0000000000d2' };
const noon = Date.UTC(2026, 10, 16, 6, 0); // 13.00 WIB
const darto = { id: '0190a6c4-0000-7000-8000-0000000000a1', name: 'Pak Darto', relation: 'sopir' as const, photoUrl: 'https://r2.test/darto' };

async function dayAt(ms: number): Promise<KioskDay> {
  const date = schoolDateAt(tz, ms);
  return {
    schoolDate: date,
    timezone: tz,
    lateAfter: '07:00',
    keys: [{ schoolDate: date, key: toBase64Url(await schoolDayKey(secret, date)) }],
    cards: [
      { ...card, firstName: 'Ani', className: '2A' },
      { ...other, firstName: 'Budi', className: '2A' },
    ],
    pickup: [{ cardId: card.cardId, guardians: [darto] }],
  };
}
const tokenAt = async (ms: number, c = card) => makeCardToken({ ...c, deviceKey: await deviceDayKey(await schoolDayKey(secret, schoolDateAt(tz, ms)), c.deviceId), ms });

describe('checkForCheckout (offline, GRB-10)', () => {
  it("shows the student's approved penjemput, none for a student without any", async () => {
    const day = await dayAt(noon);
    const v = await checkForCheckout(day, [], await tokenAt(noon), noon);
    expect(v).toMatchObject({ kind: 'pick', firstName: 'Ani', schoolDate: '2026-11-16', guardians: [darto], scannedAt: new Date(noon).toISOString() });
    expect(await checkForCheckout(day, [], await tokenAt(noon, other), noon)).toMatchObject({ kind: 'pick', firstName: 'Budi', guardians: [] });
  });

  it('refuses a second release today and bad cards', async () => {
    const day = await dayAt(noon);
    expect(await checkForCheckout(day, [card.cardId], await tokenAt(noon), noon)).toEqual({ kind: 'already_out', firstName: 'Ani', className: '2A' });
    expect(await checkForCheckout(day, [], await tokenAt(noon - 5 * 60_000), noon)).toEqual({ kind: 'rejected', reason: 'expired' });
  });
});

describe('syncCheckouts', () => {
  const queued = (i: number): QueuedCheckout => ({ clientEventId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, token: 'A1.x', pickupGuardianId: darto.id, checkedOutAt: new Date(noon + i).toISOString() });

  it('removes what the server answered and keeps the rest when offline', async () => {
    const store = memoryStore();
    await store.enqueueCheckout(queued(1));
    await store.enqueueCheckout(queued(2));
    const offline: KioskApi = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(syncCheckouts(store, offline, 't')).rejects.toThrow(TypeError);
    expect(await store.queueSize()).toBe(2);
    const api: KioskApi = async (_p, contract, call) => {
      const { checkouts } = call?.body as { checkouts: QueuedCheckout[] };
      const results: KioskCheckoutResult[] = checkouts.map((c) => ({ clientEventId: c.clientEventId, result: 'released', rejectReason: null, firstName: 'Ani' }));
      return contract.parse({ results });
    };
    expect(await syncCheckouts(store, api, 't')).toHaveLength(2);
    expect(await store.queueSize()).toBe(0);
  });

  it('drops the queue once gate.pickup is off (404)', async () => {
    const store = memoryStore();
    await store.enqueueCheckout(queued(3));
    const off: KioskApi = async () => {
      throw new KioskApiError(404, 'CAPABILITY_DISABLED', 'off');
    };
    await syncCheckouts(store, off, 't');
    expect(await store.queueSize()).toBe(0);
  });
});

describe('syncPhotos', () => {
  it('downloads new photos once and drops ones no longer listed', async () => {
    const store = memoryStore();
    await store.putPhoto('old', new Blob(['x']));
    const get = vi.fn().mockResolvedValue(new Response(new Blob(['JPEG']), { status: 200 }));
    expect(await syncPhotos(store, await dayAt(noon), get)).toBe(1);
    expect(await store.photoIds()).toEqual([darto.id]);
    expect(await syncPhotos(store, await dayAt(noon), get)).toBe(0);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('requestUnlisted', () => {
  it('uploads the photo, then holds once per attempt', async () => {
    const calls: string[] = [];
    const api: KioskApi = async (path, contract) => {
      calls.push(path);
      if (path === '/kiosk/pickup-photos') return contract.parse({ photoId: '0190a6c4-0000-7000-8000-0000000000f1', upload: { url: 'https://r2.test/u', method: 'PUT', headers: {}, expiresAt: new Date().toISOString() } });
      return contract.parse({ id: '0190a6c4-0000-7000-8000-0000000000e1', status: 'held', firstName: 'Ani', pickupName: 'Om Joko', decidedVia: null });
    };
    const put = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const held = await requestUnlisted({ api, token: 't', put }, { token: 'A1.x', scannedAt: new Date(noon).toISOString(), name: ' Om Joko ', photo: new Blob(['JPEG']) }, newAttempt());
    expect(held.status).toBe('held');
    expect(calls).toEqual(['/kiosk/pickup-photos', '/kiosk/unlisted-pickups']);
    await expect(requestUnlisted({ api, token: 't', put }, { token: 'A1.x', scannedAt: '', name: ' ', photo: new Blob(['x']) }, newAttempt())).rejects.toThrow('Tulis nama');
    expect(unlistedError(new TypeError('Failed to fetch'))).toContain('internet');
  });
});
