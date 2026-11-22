import { EARLY_WARNING_KINDS, POINT_ENTRY_MAX_BACKDATE_DAYS, POINT_EVIDENCE_MAX_BYTES } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { checkEvidence, earliestEntryDate, EARLY_WARNING_LABELS, FOLLOW_UP_LABELS, POINT_KIND_LABELS, signedPoints, totalsLine } from './ksw';

describe('kesiswaan labels', () => {
  it('name every early-warning kind the API knows', () => {
    expect(Object.keys(EARLY_WARNING_LABELS).sort()).toEqual([...EARLY_WARNING_KINDS].sort());
    expect(POINT_KIND_LABELS.violation).toBe('Pelanggaran');
    expect(Object.keys(FOLLOW_UP_LABELS)).toEqual(['none', 'planned', 'done']);
  });
});

describe('signedPoints and totalsLine', () => {
  it.each([
    [20, '+20'],
    [-5, '-5'],
    [0, '0'],
  ])('writes %i as %s', (n, text) => expect(signedPoints(n)).toBe(text));

  it('joins the two totals', () => {
    expect(totalsLine(-35, 20)).toBe('-35 poin pelanggaran, +20 poin prestasi');
    expect(totalsLine(0, 0)).toBe('0 poin pelanggaran, 0 poin prestasi');
  });
});

describe('earliestEntryDate', () => {
  it('counts the backdate limit of the API from the school date', () => {
    expect(POINT_ENTRY_MAX_BACKDATE_DAYS).toBe(30);
    expect(earliestEntryDate('2026-11-22')).toBe('2026-10-23');
    expect(earliestEntryDate('2026-03-05')).toBe('2026-02-03');
  });
});

describe('checkEvidence', () => {
  it.each([
    { name: 'a jpeg photo', file: { size: 1_000, type: 'image/jpeg' }, ok: true },
    { name: 'a pdf', file: { size: 1_000, type: 'application/pdf' }, ok: true },
    { name: 'exactly 5 MB', file: { size: POINT_EVIDENCE_MAX_BYTES, type: 'image/png' }, ok: true },
    { name: 'one byte over 5 MB', file: { size: POINT_EVIDENCE_MAX_BYTES + 1, type: 'image/png' }, ok: false },
    { name: 'a text file', file: { size: 10, type: 'text/plain' }, ok: false },
    { name: 'a file with no type', file: { size: 10, type: '' }, ok: false },
    { name: 'an empty file', file: { size: 0, type: 'image/png' }, ok: false },
  ])('$name', ({ file, ok }) => {
    expect(checkEvidence(file).ok).toBe(ok);
  });

  it('says what is wrong in plain words', () => {
    expect(checkEvidence({ size: POINT_EVIDENCE_MAX_BYTES + 1, type: 'image/png' })).toEqual({ ok: false, message: 'Bukti maksimal 5 MB.' });
    expect(checkEvidence({ size: 5, type: 'video/mp4' })).toMatchObject({ ok: false, message: expect.stringContaining('foto') as string });
  });
});
