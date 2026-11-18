import { describe, expect, it } from 'vitest';
import { percent, periodFrom, periodQuery, semesterLabel, streamsOf } from './report';

const semesters = [
  { id: '00000000-0000-4000-8000-000000000001', academicYear: '2026/2027', number: 1, startsOn: '2026-07-13', endsOn: '2026-12-19' },
  { id: '00000000-0000-4000-8000-000000000002', academicYear: '2026/2027', number: 2, startsOn: '2027-01-04', endsOn: '2027-06-19' },
];
const params = (q: string) => new URLSearchParams(q);

describe('periodFrom', () => {
  it('takes the semester in the URL', () => {
    expect(periodFrom(params(`semester=${semesters[0]?.id ?? ''}`), semesters, '2027-02-01')).toEqual({ from: '2026-07-13', to: '2026-12-19', semesterId: semesters[0]?.id });
  });

  it('takes a valid date range', () => {
    expect(periodFrom(params('from=2027-01-11&to=2027-01-15'), semesters, '2027-02-01')).toEqual({ from: '2027-01-11', to: '2027-01-15', semesterId: null });
  });

  it('falls back to the current semester, then to today', () => {
    expect(periodFrom(params('from=2027-01-15&to=2027-01-11'), semesters, '2027-02-01').semesterId).toBe(semesters[1]?.id);
    expect(periodFrom(params('semester=unknown'), semesters, '2026-12-28')).toEqual({ from: '2026-12-28', to: '2026-12-28', semesterId: null });
  });
});

describe('labels', () => {
  it('formats periods, semesters and rates', () => {
    expect(periodQuery({ from: '2027-01-11', to: '2027-01-11', semesterId: null })).toBe('from=2027-01-11&to=2027-01-11');
    expect(semesterLabel({ number: 2, academicYear: '2026/2027' })).toBe('Semester genap 2026/2027');
    expect(percent(0.9123)).toBe('91,2%');
    expect(percent(1)).toBe('100%');
    expect(percent(null)).toBe('–');
  });
});

describe('streamsOf', () => {
  it('lists the jurusan present, in catalog order', () => {
    expect(streamsOf([{ stream: 'ips' }, { stream: null }, { stream: 'ipa' }, { stream: 'ips' }])).toEqual(['ipa', 'ips']);
    expect(streamsOf([{ stream: null }])).toEqual([]);
  });
});
