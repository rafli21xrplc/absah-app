import { ErrorCode } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { FEEDBACK } from './feedback';

describe('kiosk feedback', () => {
  it('has a distinct color and Indonesian label per outcome', () => {
    const colors = new Set(Object.values(FEEDBACK).map((f) => f.color));
    expect(colors.size).toBe(3);
    expect(FEEDBACK.late.label).toBe('Terlambat');
  });

  it('shares error codes with absah-api', () => {
    expect(ErrorCode.options).toContain('CAPABILITY_DISABLED');
  });
});
