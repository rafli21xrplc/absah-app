import { describe, expect, it } from 'vitest';
import { monthRange, percent, scheduleLabel } from './activities';

describe('scheduleLabel', () => {
  it('names weekdays, date ranges and kemah', () => {
    expect(scheduleLabel({ days: [1, 5], startsOn: null, endsOn: null })).toBe('Sen, Jum');
    expect(scheduleLabel({ days: [6], startsOn: '2026-08-01', endsOn: null })).toBe('Sab · mulai 1 Agu 2026');
    expect(scheduleLabel({ days: [], startsOn: '2026-12-01', endsOn: '2026-12-03' })).toBe('Setiap hari 1 Des 2026 – 3 Des 2026');
    expect(scheduleLabel({ days: [], startsOn: null, endsOn: null })).toBe('Belum dijadwalkan');
  });
});

describe('monthRange and percent', () => {
  it('covers the whole month', () => {
    expect(monthRange('2027-02')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
  it('rounds the rate', () => {
    expect(percent(0.857)).toBe('86%');
    expect(percent(null)).toBe('–');
  });
});
