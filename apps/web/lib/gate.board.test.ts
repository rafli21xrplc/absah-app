import { describe, expect, it } from 'vitest';
import { arrivedPercent, BOARD_STALE_MS, boardIsStale, boardOrder, toChase } from './gate';

const row = (className: string, students: number, onTime: number, late: number, notArrived: number, excused = 0) => ({ className, students, onTime, late, notArrived, excused });

describe('arrival board helpers (GRB-08)', () => {
  it('counts only students nobody has an excuse for', () => {
    expect(toChase(row('VII A', 30, 20, 3, 7, 2))).toBe(5);
    expect(toChase(row('VII A', 30, 20, 3, 1, 4))).toBe(0);
  });

  it('rounds the arrived share and survives an empty rombel', () => {
    expect(arrivedPercent(row('VII A', 30, 20, 3, 7))).toBe(77);
    expect(arrivedPercent(row('VII B', 0, 0, 0, 0))).toBe(0);
  });

  it('lists the rombel with most to chase first, then by name with numbers in order', () => {
    const order = boardOrder([row('VII 10', 30, 30, 0, 0), row('VII 2', 30, 30, 0, 0), row('VIII A', 30, 10, 0, 20), row('VII C', 30, 20, 0, 10, 10)]);
    expect(order.map((r) => r.className)).toEqual(['VIII A', 'VII 2', 'VII 10', 'VII C']);
  });

  it('says the board may be out of date after 20 seconds without an answer', () => {
    expect(boardIsStale(null, 1000)).toBe(true);
    expect(boardIsStale(1000, 1000 + BOARD_STALE_MS)).toBe(false);
    expect(boardIsStale(1000, 1001 + BOARD_STALE_MS)).toBe(true);
  });
});
