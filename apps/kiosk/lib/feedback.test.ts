import { ErrorCode, SCAN_REJECT_REASONS } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { FEEDBACK, REJECT_HINTS } from './feedback';

describe('kiosk feedback', () => {
  it('is green, amber or red with an Indonesian label per outcome', () => {
    const colors = new Set(Object.values(FEEDBACK).map((f) => f.color));
    expect(colors.size).toBe(3);
    expect(FEEDBACK.late.label).toBe('Terlambat');
    expect(FEEDBACK.duplicate.color).toBe(FEEDBACK.late.color);
  });

  it('has a hint for every reject reason', () => {
    expect(Object.keys(REJECT_HINTS).sort()).toEqual([...SCAN_REJECT_REASONS].sort());
  });

  it('shares error codes with absah-api', () => {
    expect(ErrorCode.options).toContain('CAPABILITY_DISABLED');
  });
});
