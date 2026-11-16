import { deviceDayKey, schoolDayKey, toBase64Url, verifyCardToken } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { cardTokenAt, lastKeyDate, secondsLeft } from './card';

const cardId = '01900000-0000-7000-8000-000000000001';
const deviceId = '01900000-0000-7000-8000-000000000002';

describe('card QR on the phone', () => {
  it('makes tokens the kiosk accepts, only for days it holds a key for', async () => {
    const schoolSecret = new Uint8Array(32).fill(7);
    const ms = Date.parse('2026-11-16T01:00:00Z'); // 08.00 WIB
    const dayKey = await schoolDayKey(schoolSecret, '2026-11-16');
    const keys = { cardId, deviceId, timezone: 'Asia/Jakarta', keys: [{ schoolDate: '2026-11-16', key: toBase64Url(await deviceDayKey(dayKey, deviceId)) }] };
    const token = await cardTokenAt(keys, ms);
    expect(token).toMatch(/^A1\./);
    const check = await verifyCardToken(token ?? '', ms, 'Asia/Jakarta', (date) => (date === '2026-11-16' ? dayKey : null));
    expect(check.ok).toBe(true);
    expect(await cardTokenAt(keys, ms + 86_400_000)).toBeNull();
    expect(lastKeyDate(keys)).toBe('2026-11-16');
  });

  it('counts down to the next window', () => {
    expect(secondsLeft(Date.parse('2026-11-16T01:00:00Z'))).toBe(30);
    expect(secondsLeft(Date.parse('2026-11-16T01:00:29Z'))).toBe(1);
  });
});
