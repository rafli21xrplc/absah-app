import { deviceDayKey, makeCardToken, schoolDateAt, schoolDayKey, toBase64Url, type KioskDay } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { checkLocally, clockAt, dayIsCurrent, isCardToken } from './verify';

const tz = 'Asia/Jakarta';
const secret = new Uint8Array(32).fill(7);
const card = { cardId: '0190a6c4-0000-7000-8000-000000000001', deviceId: '0190a6c4-0000-7000-8000-0000000000d1' };
// 2026-11-16 06:50 and 07:20 in Jakarta (UTC+7).
const early = Date.UTC(2026, 10, 15, 23, 50);
const late = Date.UTC(2026, 10, 16, 0, 20);

async function dayFor(ms: number): Promise<KioskDay> {
  const date = schoolDateAt(tz, ms);
  return {
    schoolDate: date,
    timezone: tz,
    lateAfter: '07:00',
    keys: [{ schoolDate: date, key: toBase64Url(await schoolDayKey(secret, date)) }],
    cards: [{ ...card, firstName: 'Nadia', className: '5A' }],
    pickup: null,
  };
}
const tokenAt = async (ms: number, c = card, s = secret) =>
  makeCardToken({ ...c, deviceKey: await deviceDayKey(await schoolDayKey(s, schoolDateAt(tz, ms)), c.deviceId), ms });

describe('checkLocally (offline, GRB-03)', () => {
  it('accepts the bound phone, on time or late by the school clock', async () => {
    expect(await checkLocally(await dayFor(early), [], await tokenAt(early), early)).toMatchObject({ kind: 'arrived', outcome: 'on_time', firstName: 'Nadia', schoolDate: '2026-11-16' });
    expect(await checkLocally(await dayFor(late), [], await tokenAt(late), late)).toMatchObject({ kind: 'arrived', outcome: 'late' });
    expect(clockAt(tz, late)).toBe('07:20');
  });

  it('flags a second arrival and rejects screenshots, other schools and old phones', async () => {
    const day = await dayFor(early);
    expect(await checkLocally(day, [card.cardId], await tokenAt(early), early)).toMatchObject({ kind: 'duplicate', firstName: 'Nadia' });
    expect(await checkLocally(day, [], await tokenAt(early - 5 * 60_000), early)).toEqual({ kind: 'rejected', reason: 'expired' });
    expect(await checkLocally(day, [], await tokenAt(early, card, new Uint8Array(32).fill(9)), early)).toEqual({ kind: 'rejected', reason: 'bad_signature' });
    const oldPhone = { ...card, deviceId: '0190a6c4-0000-7000-8000-0000000000d2' };
    expect(await checkLocally(day, [], await tokenAt(early, oldPhone), early)).toEqual({ kind: 'rejected', reason: 'wrong_device' });
    const stranger = { ...card, cardId: '0190a6c4-0000-7000-8000-000000000002' };
    expect(await checkLocally(day, [], await tokenAt(early, stranger), early)).toEqual({ kind: 'rejected', reason: 'unknown_card' });
  });

  it('knows when the download is stale and what is a card at all', async () => {
    const day = await dayFor(early);
    expect(dayIsCurrent(day, early)).toBe(true);
    expect(dayIsCurrent(day, early + 24 * 3_600_000)).toBe(false);
    expect(dayIsCurrent(null, early)).toBe(false);
    expect(isCardToken(await tokenAt(early))).toBe(true);
    expect(isCardToken('https://contoh.id')).toBe(false);
  });
});
