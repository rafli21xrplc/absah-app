import { describe, expect, it } from 'vitest';
import { dateLabel, groupDigits, monthLabel, rupiah, share } from './billing';

describe('billing labels', () => {
  it('formats rupiah the Indonesian way', () => {
    expect(rupiah(28_387)).toBe('Rp28.387');
    expect(rupiah(9_000_000)).toBe('Rp9.000.000');
    expect(share('3225.8065')).toBe('Rp3.225,81');
  });

  it('names months and dates', () => {
    expect(monthLabel('2027-01')).toBe('Januari 2027');
    expect(dateLabel('2027-02-15')).toBe('15 Februari 2027');
  });

  it('groups VA digits by four', () => {
    expect(groupDigits('9881234567890')).toBe('9881 2345 6789 0');
  });
});
