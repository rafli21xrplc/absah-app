import { describe, expect, it } from 'vitest';
import { canAnimate } from './motion';

/** A matchMedia that answers per query. */
const win = (answers: Record<string, boolean>) =>
  ({ matchMedia: (q: string) => ({ matches: answers[q] ?? false }) as MediaQueryList }) as Pick<Window, 'matchMedia'>;

describe('canAnimate', () => {
  it('is true on a wide screen without a reduced-motion request', () => {
    expect(canAnimate(win({ '(min-width: 1024px)': true, '(prefers-reduced-motion: reduce)': false }))).toBe(true);
  });

  it('is false when the person asked for less motion', () => {
    expect(canAnimate(win({ '(min-width: 1024px)': true, '(prefers-reduced-motion: reduce)': true }))).toBe(false);
  });

  it('is false on a phone-sized screen, so the guru phone never loads the library', () => {
    expect(canAnimate(win({ '(min-width: 1024px)': false, '(prefers-reduced-motion: reduce)': false }))).toBe(false);
  });

  it('is false without a window (server rendering) or without matchMedia', () => {
    expect(canAnimate(undefined)).toBe(false);
    expect(canAnimate({} as Pick<Window, 'matchMedia'>)).toBe(false);
  });
});
