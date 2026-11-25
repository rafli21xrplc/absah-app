import { describe, expect, it } from 'vitest';
import { toE164 } from './phone';

describe('toE164', () => {
  it('turns the three ways people type a WhatsApp number into +62...', () => {
    expect(toE164('0812-3456-7890')).toBe('+6281234567890');
    expect(toE164('6281234567890')).toBe('+6281234567890');
    expect(toE164('+62 812 3456 7890')).toBe('+6281234567890');
  });
});

describe('parentNumber and maskNumber (sign-in as a parent)', () => {
  it('turns every way of writing the number into +62...', async () => {
    const { parentNumber } = await import('./phone');
    for (const typed of ['0812 3456 7890', '812-3456-7890', '6281234567890', '+62 812 3456 7890', '81234567890']) {
      expect(parentNumber(typed)).toBe('+6281234567890');
    }
  });

  it('hides the middle of the number', async () => {
    const { maskNumber } = await import('./phone');
    expect(maskNumber('+6281234567890')).toBe('+62 812 ••• ••90');
  });
});
