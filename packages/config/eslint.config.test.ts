import { describe, expect, it } from 'vitest';
import { absahRules } from './eslint.config.js';

describe('shared eslint rules', () => {
  it('forbids any and ts-ignore', () => {
    expect(absahRules['@typescript-eslint/no-explicit-any']).toBe('error');
    expect(absahRules['@typescript-eslint/ban-ts-comment']).toEqual(
      expect.arrayContaining([expect.objectContaining({ 'ts-ignore': true })]),
    );
  });
});
