import type { AttendanceSource, AttendanceStatus, Role, SessionStatus } from '@absah/contracts';

export const STATUS_LABELS: Record<AttendanceStatus, string> = { H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa', T: 'Terlambat' };
/** Statuses a teacher can set as an exception ("Semua hadir kecuali..."). */
export const EXCEPTION_STATUSES = ['S', 'I', 'A', 'T'] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export const SOURCE_LABELS: Record<AttendanceSource, string> = {
  teacher: 'Guru',
  gate: 'Gerbang',
  leave: 'Izin disetujui',
  uks: 'Dipulangkan UKS',
  pkl_confirm: 'PKL',
  manual: 'Koreksi',
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  open: 'Belum diisi',
  submitted: 'Sudah diisi',
  missed: 'Tidak diisi',
  locked: 'Dikunci',
};

/** Mirror absah-api (the API enforces them). */
export const ALL_SESSIONS_VIEWERS: Role[] = ['admin', 'operator', 'kepsek', 'wakasek', 'piket'];
export const CORRECTION_DECIDERS: Role[] = ['wakasek', 'kepsek'];
