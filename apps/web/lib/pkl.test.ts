import { describe, expect, it } from 'vitest';
import { DAY_LABELS } from './activities';
import { DEFAULT_WORK_HOURS, parseCoordinates, workHoursLabel } from './pkl';

describe('parseCoordinates', () => {
  it('reads a pasted pair or a Google Maps URL', () => {
    expect(parseCoordinates('-6.2383, 106.9756')).toEqual({ latitude: -6.2383, longitude: 106.9756 });
    expect(parseCoordinates('https://www.google.com/maps/@-6.238312,106.975601,17z')).toEqual({ latitude: -6.238312, longitude: 106.975601 });
  });

  it('refuses text without a valid pair', () => {
    expect(parseCoordinates('Jl. Raya Bekasi')).toBeNull();
    expect(parseCoordinates('95.1, 106.9')).toBeNull();
  });
});

describe('workHoursLabel', () => {
  it('collapses a regular week', () => {
    expect(workHoursLabel(DEFAULT_WORK_HOURS, DAY_LABELS)).toBe('Sen–Jum 08.00–16.00');
  });

  it('lists irregular days', () => {
    expect(
      workHoursLabel(
        [
          { day: 1, startsAt: '08:00', endsAt: '16:00' },
          { day: 6, startsAt: '08:00', endsAt: '12:00' },
        ],
        DAY_LABELS,
      ),
    ).toBe('Sen 08.00–16.00, Sab 08.00–12.00');
    expect(workHoursLabel([], DAY_LABELS)).toBe('Belum ada hari kerja');
  });
});
