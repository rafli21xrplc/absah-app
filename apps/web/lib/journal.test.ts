import { describe, expect, it } from 'vitest';
import { byTeacher, monthIn, monthLabel, shortDate } from './journal';

describe('journal helpers', () => {
  it('takes the month from the school clock, not the device', () => {
    const lateOnThe31st = new Date('2026-10-31T18:30:00Z'); // 01.30 on 1 November in Jakarta
    expect(monthIn('Asia/Jakarta', lateOnThe31st)).toBe('2026-11');
    expect(monthIn('UTC', lateOnThe31st)).toBe('2026-10');
  });

  it('writes months and dates in Indonesian', () => {
    expect(monthLabel('2026-11')).toBe('November 2026');
    expect(monthLabel('2027-01')).toBe('Januari 2027');
    expect(shortDate('2026-11-09')).toBe('Sen, 9 Nov');
  });

  it('groups by teacher in name order and keeps each teacher\'s entries in date order', () => {
    const budi = { id: 'b', name: 'Pak Budi' };
    const ani = { id: 'a', name: 'Bu Ani' };
    const groups = byTeacher([
      { teacher: budi, d: 1 },
      { teacher: ani, d: 2 },
      { teacher: budi, d: 3 },
      { teacher: null, d: 4 },
    ]);
    expect(groups.map((g) => [g.teacher?.name ?? null, g.entries.map((e) => e.d)])).toEqual([
      [null, [4]],
      ['Bu Ani', [2]],
      ['Pak Budi', [1, 3]],
    ]);
  });
});
