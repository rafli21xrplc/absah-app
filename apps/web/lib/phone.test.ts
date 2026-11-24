import { describe, expect, it } from 'vitest';
import { toE164 } from './phone';

describe('toE164', () => {
  it('turns the three ways people type a WhatsApp number into +62...', () => {
    expect(toE164('0812-3456-7890')).toBe('+6281234567890');
    expect(toE164('6281234567890')).toBe('+6281234567890');
    expect(toE164('+62 812 3456 7890')).toBe('+6281234567890');
  });
});
