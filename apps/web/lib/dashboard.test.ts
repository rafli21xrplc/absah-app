import type { CollectionSchoolSummary } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { barWidth, kindsLine, mbgLine, schoolsByAttention, sessionsLine } from './dashboard';

describe('dashboard helpers (RKP-05, RKP-06)', () => {
  it('draws a day without rekap as an empty bar and clamps the rest', () => {
    expect([null, 0, 0.456, 1, 1.4].map(barWidth)).toEqual([0, 0, 46, 100, 100]);
  });

  it('says what is overdue and what is not due yet', () => {
    expect(sessionsLine({ total: 0, filled: 0, missed: 0, open: 0 })).toBe('Belum ada sesi hari ini');
    expect(sessionsLine({ total: 35, filled: 27, missed: 3, open: 5 })).toBe('27 dari 35 sesi sudah diisi · 3 terlewat · 5 belum jatuh tempo');
    expect(sessionsLine({ total: 10, filled: 10, missed: 0, open: 0 })).toBe('10 dari 10 sesi sudah diisi');
  });

  it('names the warning kinds and the MBG state', () => {
    expect(kindsLine(['consecutive_alpa', 'repeated_late'])).toBe('Alpa berturut-turut, Terlambat berulang');
    expect(mbgLine({ status: 'not_school_day', enrolled: 0, present: 0, unrecorded: 0 })).toBe('Bukan hari sekolah');
    expect(mbgLine({ status: 'pending', enrolled: 40, present: 31, unrecorded: 9 })).toBe('31 dari 40 penerima hadir sejauh ini');
    expect(mbgLine({ status: 'counted', enrolled: 40, present: 38, unrecorded: 2 })).toBe('38 dari 40 penerima hadir · 2 belum tercatat');
  });

  it('ranks schools by lowest attendance, those without rekap last', () => {
    const school = (name: string, presentRate: number | null) =>
      ({ schoolId: name, name, schoolDate: '2026-11-23', attendance: { days: 1, present: 1, presentRate }, sessions: { total: 0, filled: 0, missed: 0, open: 0, fillRate: null }, atRiskStudents: null, mbg: null }) satisfies CollectionSchoolSummary;
    expect(schoolsByAttention([school('C', null), school('B', 0.9), school('A', 0.7), school('D', 0.9)]).map((s) => s.name)).toEqual(['A', 'B', 'D', 'C']);
  });
});
