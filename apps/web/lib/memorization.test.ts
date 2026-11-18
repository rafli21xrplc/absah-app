import { describe, expect, it } from 'vitest';
import { ayatIn, optionalInt, SURAH_OPTIONS } from './memorization';

describe('memorization helpers', () => {
  it('lists every surah with its ayat count', () => {
    expect(SURAH_OPTIONS).toHaveLength(114);
    expect(SURAH_OPTIONS[66]).toEqual({ value: 67, label: '67. Al-Mulk (30 ayat)' });
    expect(ayatIn(1)).toBe(7);
    expect(ayatIn(115)).toBe(0);
  });

  it('reads optional numbers', () => {
    expect(optionalInt(' ')).toBeUndefined();
    expect(optionalInt('88')).toBe(88);
  });
});
