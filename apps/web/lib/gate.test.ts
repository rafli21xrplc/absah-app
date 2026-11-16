import { describe, expect, it } from 'vitest';
import { agoLabel, timeIn } from './gate';

describe('gate labels', () => {
  it('shows times in the school timezone and heartbeat age in words', () => {
    expect(timeIn('Asia/Jakarta', '2026-11-16T00:12:00Z')).toBe('07.12');
    const now = Date.parse('2026-11-16T03:00:00Z');
    expect(agoLabel(null, now)).toBe('belum pernah');
    expect(agoLabel('2026-11-16T02:59:40Z', now)).toBe('baru saja');
    expect(agoLabel('2026-11-16T02:57:00Z', now)).toBe('3 menit lalu');
    expect(agoLabel('2026-11-15T23:00:00Z', now)).toBe('4 jam lalu');
  });
});
