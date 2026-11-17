import { TPPK_REPORT_CATEGORIES, TPPK_REPORT_STATUSES, TPPK_REPORTER_RELATIONS } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, formatCode, RELATIONS, reportUrl, STATUS_LABELS } from './tppk';

describe('TPPK labels', () => {
  it('cover every value the API knows', () => {
    expect(CATEGORIES).toEqual([...TPPK_REPORT_CATEGORIES]);
    expect(RELATIONS).toEqual([...TPPK_REPORTER_RELATIONS]);
    expect(Object.keys(STATUS_LABELS)).toEqual([...TPPK_REPORT_STATUSES]);
  });

  it('formats the tracking code in two groups', () => {
    expect(formatCode('AB12CD34EF')).toBe('AB12C-D34EF');
    expect(formatCode('pendek')).toBe('pendek');
  });

  it('builds the poster address', () => {
    expect(reportUrl('https://absah.id', '0190a7e2-0000-7000-8000-000000000001')).toBe('https://absah.id/lapor?s=0190a7e2-0000-7000-8000-000000000001');
  });
});
