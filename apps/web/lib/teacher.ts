import { SUBSTITUTE_ROLES, SUBSTITUTION_ASSIGNERS, SUBSTITUTION_VIEWERS, TEACHER_CHECKIN_ROLES, TEACHER_LEAVE_DECIDERS, TEACHER_REPORT_READERS } from '@absah/contracts';
import type { LeaveStatus, Role, TeacherDayStatus, TeacherLeaveKind } from '@absah/contracts';

/** Role lists come from the contracts, the same constants the API's policies are built from. */
export const TEACHER_CHECKIN: Role[] = [...TEACHER_CHECKIN_ROLES];
export const TEACHER_LEAVE_DECIDING: Role[] = [...TEACHER_LEAVE_DECIDERS];
export const SUBSTITUTION_READING: Role[] = [...SUBSTITUTION_VIEWERS];
export const SUBSTITUTION_ASSIGNING: Role[] = [...SUBSTITUTION_ASSIGNERS];
export const TEACHER_REPORT_READING: Role[] = [...TEACHER_REPORT_READERS];
export const SUBSTITUTE_ROLE_LIST: Role[] = [...SUBSTITUTE_ROLES];

export const TEACHER_LEAVE_KIND_LABELS: Record<TeacherLeaveKind, string> = { sakit: 'Sakit', izin: 'Izin', dinas: 'Dinas luar' };

export const TEACHER_DAY_LABELS: Record<TeacherDayStatus, string> = {
  present: 'Hadir',
  late: 'Terlambat',
  sakit: 'Sakit',
  izin: 'Izin',
  dinas: 'Dinas luar',
  none: 'Tanpa catatan',
};

/** "07.05" for an instant on the school's clock (the school wall clock writes hours and minutes with a dot). */
export function clockLabel(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const value = (type: 'hour' | 'minute') => parts.find((p) => p.type === type)?.value ?? '00';
  return `${value('hour')}.${value('minute')}`;
}

/** "07.00" for a "HH:MM" school start. */
export const startLabel = (hhmm: string): string => hhmm.slice(0, 5).replace(':', '.');

/** What the teacher reads after checking in. */
export function checkInSummary(attendance: { checkedInAt: string; checkedOutAt: string | null; late: boolean }, schoolStart: string, timezone: string): string {
  const inAt = `Masuk pukul ${clockLabel(attendance.checkedInAt, timezone)}`;
  const status = attendance.late ? `terlambat (sekolah mulai ${startLabel(schoolStart)})` : 'tepat waktu';
  const out = attendance.checkedOutAt ? ` · Pulang pukul ${clockLabel(attendance.checkedOutAt, timezone)}` : '';
  return `${inAt}, ${status}${out}`;
}

/** An izin can be withdrawn while pending, or approved and not over (mirrors the API). */
export const mayCancelTeacherLeave = (leave: { status: LeaveStatus; endsOn: string }, today: string): boolean => (leave.status === 'pending' || leave.status === 'approved') && leave.endsOn >= today;

/** Problems with the form before it is sent, as the message to show, or null. */
export function teacherLeaveProblem(input: { startsOn: string; endsOn: string; reason: string }): string | null {
  if (!input.startsOn || !input.endsOn) return 'Isi tanggal mulai dan selesai.';
  if (input.endsOn < input.startsOn) return 'Tanggal selesai sebelum tanggal mulai.';
  if (!input.reason.trim()) return 'Tulis alasannya.';
  return null;
}

/** "Jam ke-1 (07.00–07.40)" for a lesson, "Sesi harian" for a daily session. */
export function sessionTimeLabel(period: { number: number; startsAt: string; endsAt: string } | null): string {
  return period ? `Jam ke-${period.number} (${startLabel(period.startsAt)}–${startLabel(period.endsAt)})` : 'Sesi harian';
}

/** Why a candidate is a good pick, in the order the list is sorted by. */
export function candidateNotes(c: { checkedIn: boolean; sameSubject: boolean; substitutionsThisMonth: number }): string {
  const notes = [c.checkedIn ? 'Sudah absen' : 'Belum absen', ...(c.sameSubject ? ['Mapel sama'] : []), c.substitutionsThisMonth === 0 ? 'Belum mengganti bulan ini' : `${c.substitutionsThisMonth}× mengganti bulan ini`];
  return notes.join(' · ');
}
