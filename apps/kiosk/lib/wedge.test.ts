import { describe, expect, it } from 'vitest';
import { wedgeReader } from './wedge';

describe('wedgeReader', () => {
  it('reads fast keystrokes ending in Enter and ignores slow typing', () => {
    const codes: string[] = [];
    const read = wedgeReader((c) => codes.push(c));
    let t = 1_000;
    for (const ch of 'A1.abc.def.ghi') read(ch, (t += 5));
    read('Enter', (t += 5));
    for (const ch of 'halo guru') read(ch, (t += 300));
    read('Enter', (t += 300));
    read('Shift', (t += 5));
    expect(codes).toEqual(['A1.abc.def.ghi']);
  });
});
