import type { LeaveKind, LeaveStatus, Role } from '@absah/contracts';

export const LEAVE_KIND_LABELS: Record<LeaveKind, string> = { sakit: 'Sakit', izin: 'Izin' };
export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
};
/**
 * Staff who can enter and decide izin. The API checks the wali kelas of each student, and in a small
 * school the admin is often a wali kelas too, so the admin role is included.
 */
export const LEAVE_STAFF: Role[] = ['guru', 'wali_kelas', 'wakasek', 'kepsek', 'admin'];

/** YYYY-MM-DD in the school timezone (CLAUDE.md rule 6). */
export const todayIn = (timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

export function dateRangeLabel(startsOn: string, endsOn: string): string {
  const fmt = (d: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
  return startsOn === endsOn ? fmt(startsOn) : `${fmt(startsOn)} – ${fmt(endsOn)}`;
}
