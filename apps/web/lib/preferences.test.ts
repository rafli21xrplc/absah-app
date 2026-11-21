import { MUTABLE_TEMPLATE_CODES } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { LATE_CUTOFF_LABEL, mutedFrom, PREFERENCE_LABELS, receivedFrom, toggled } from './preferences';

describe('preferences', () => {
  it('has a label for every type a parent can switch off', () => {
    expect(Object.keys(PREFERENCE_LABELS).sort()).toEqual([...MUTABLE_TEMPLATE_CODES].sort());
  });

  it('writes the cutoff the way the school clock reads', () => {
    expect(LATE_CUTOFF_LABEL).toBe('19.00');
  });

  it('turns what is ticked into what is muted, and back', () => {
    expect(mutedFrom(receivedFrom([]))).toEqual([]);
    expect(mutedFrom(receivedFrom(['leave_rejected', 'absent_marked']))).toEqual(['absent_marked', 'leave_rejected']);
    expect(receivedFrom(['absent_marked']).has('absent_marked')).toBe(false);
    expect(receivedFrom(['absent_marked']).has('leave_approved')).toBe(true);
  });

  it('toggles one type without touching the others or the original set', () => {
    const all = receivedFrom([]);
    const off = toggled(all, 'leave_approved');
    expect(off.has('leave_approved')).toBe(false);
    expect(all.has('leave_approved')).toBe(true);
    expect(toggled(off, 'leave_approved').has('leave_approved')).toBe(true);
    expect(mutedFrom(off)).toEqual(['leave_approved']);
  });
});
