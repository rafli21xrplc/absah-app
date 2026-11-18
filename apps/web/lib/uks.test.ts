import { UKS_OUTCOMES } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { OUTCOME_LABELS, OUTCOMES } from './uks';

describe('UKS labels', () => {
  it('covers every outcome the API knows, in its order', () => {
    expect(OUTCOMES).toEqual([...UKS_OUTCOMES]);
    expect(OUTCOME_LABELS.dipulangkan).toBe('Dipulangkan');
  });
});
