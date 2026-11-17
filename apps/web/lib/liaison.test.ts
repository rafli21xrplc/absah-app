import { describe, expect, it } from 'vitest';
import { messageTime } from './liaison';

describe('messageTime', () => {
  const now = new Date('2026-11-17T05:00:00Z'); // 12.00 WIB
  it('says today, yesterday or the date, in the school timezone', () => {
    expect(messageTime('Asia/Jakarta', '2026-11-17T00:15:00Z', now)).toBe('Hari ini 07.15');
    expect(messageTime('Asia/Jakarta', '2026-11-16T12:02:00Z', now)).toBe('Kemarin 19.02');
    expect(messageTime('Asia/Jakarta', '2026-11-12T00:15:00Z', now)).toBe('12 Nov 07.15');
    // 23.30 WIB on the 16th is still "yesterday" although it is the 16th in UTC too.
    expect(messageTime('Asia/Jakarta', '2026-11-16T16:30:00Z', now)).toBe('Kemarin 23.30');
  });
});
