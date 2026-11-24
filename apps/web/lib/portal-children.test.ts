import type { MeContextResponse } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { childKey, childLabel, parentSchools, pickSelected, sortChildren, type PortalChild } from './portal-children';

const child = (schoolId: string, schoolName: string, studentId: string, name: string): PortalChild => ({
  key: childKey(schoolId, studentId),
  schoolId,
  schoolName,
  studentId,
  enrollmentId: `e-${studentId}`,
  name,
  className: '4A',
});
const andi = child('s1', 'SD Kembar A', 'a', 'ANDI');
const bella = child('s2', 'SD Kembar B', 'b', 'BELLA');

describe('parentSchools', () => {
  it('keeps only the schools where the login is an orang tua', () => {
    const me = {
      schools: [
        { id: 's1', name: 'A', roles: ['orang_tua'] },
        { id: 's2', name: 'B', roles: ['guru'] },
        { id: 's3', name: 'C', roles: ['guru', 'orang_tua'] },
      ],
    } as unknown as MeContextResponse;
    expect(parentSchools(me).map((s) => s.id)).toEqual(['s1', 's3']);
  });
});

describe('pickSelected', () => {
  it('prefers the remembered child, then the active school, then the first', () => {
    expect(pickSelected([andi, bella], bella.key, 's1')).toBe(bella);
    expect(pickSelected([andi, bella], 'gone:gone', 's2')).toBe(bella);
    expect(pickSelected([andi, bella], null, null)).toBe(andi);
    expect(pickSelected([], null, 's1')).toBeNull();
  });

  it('never confuses the same student id at two schools', () => {
    const a = child('s1', 'A', 'same', 'ANDI');
    const b = child('s2', 'B', 'same', 'BELLA');
    expect(pickSelected([a, b], b.key, null)).toBe(b);
  });
});

describe('labels and order', () => {
  it('names the school only when there are several', () => {
    expect(childLabel(andi, 1)).toBe('ANDI · 4A');
    expect(childLabel(andi, 2)).toBe('ANDI · 4A (SD Kembar A)');
  });

  it('sorts by school, then name', () => {
    const anisa = child('s1', 'SD Kembar A', 'c', 'ANISA');
    expect(sortChildren([bella, anisa, andi]).map((c) => c.name)).toEqual(['ANDI', 'ANISA', 'BELLA']);
  });
});
