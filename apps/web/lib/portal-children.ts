import type { MeContextResponse } from '@absah/contracts';

/** A child of the signed-in parent at one school (ORT-03/04). The same login can hold children at several schools. */
export interface PortalChild {
  /** `<schoolId>:<studentId>`: a student id alone is only unique inside one school. */
  key: string;
  schoolId: string;
  schoolName: string;
  studentId: string;
  enrollmentId: string;
  name: string;
  className: string;
}

/** Days of history the parent can pick (the API allows 1-180). */
export const HISTORY_RANGES = [30, 90, 180] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export const childKey = (schoolId: string, studentId: string) => `${schoolId}:${studentId}`;

/** Schools where this login is an orang tua: each one is asked for its children on its own (RLS decides per school). */
export function parentSchools(me: MeContextResponse): MeContextResponse['schools'] {
  return me.schools.filter((s) => s.roles.includes('orang_tua'));
}

/**
 * The child on screen: the remembered one if it still exists, else the first child of the active
 * school, else the first child. Null only when there are no children.
 */
export function pickSelected(children: readonly PortalChild[], remembered: string | null, activeSchoolId: string | null): PortalChild | null {
  return (
    children.find((c) => c.key === remembered) ??
    children.find((c) => c.schoolId === activeSchoolId) ??
    children[0] ??
    null
  );
}

/** "ANDI · 4A", plus the school only when the parent has children at more than one. */
export function childLabel(child: PortalChild, schoolCount: number): string {
  const base = `${child.name} · ${child.className}`;
  return schoolCount > 1 ? `${base} (${child.schoolName})` : base;
}

/** Children sorted by school name, then name, so the picker does not jump when a school answers late. */
export function sortChildren(children: readonly PortalChild[]): PortalChild[] {
  return [...children].sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'id') || a.name.localeCompare(b.name, 'id'));
}
