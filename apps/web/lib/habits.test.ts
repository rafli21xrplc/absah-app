import { describe, expect, it } from 'vitest';
import { addDays, habitsBody, HABIT_LABELS, HABITS, mondayOf, tickedOf } from './habits';

describe('habits', () => {
  it('labels all seven habits', () => {
    expect(HABITS).toHaveLength(7);
    for (const h of HABITS) expect(HABIT_LABELS[h]).toBeTruthy();
  });

  it('sends every habit, unticked as false, and reads ticks back', () => {
    const body = habitsBody(new Set(['bangun_pagi', 'tidur_cepat']));
    expect(Object.keys(body)).toHaveLength(7);
    expect(body).toMatchObject({ bangun_pagi: true, tidur_cepat: true, beribadah: false });
    const habits = { ...body, beribadah: null };
    expect([...tickedOf({ habits })]).toEqual(['bangun_pagi', 'tidur_cepat']);
  });

  it('finds the Monday of a week and moves by days', () => {
    expect(mondayOf('2026-11-18')).toBe('2026-11-16'); // Wednesday
    expect(mondayOf('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
    expect(addDays('2026-11-16', -7)).toBe('2026-11-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
