import type { CounselingFollowUp, EarlyWarningKind, PointKind, Role } from '@absah/contracts';
import { POINT_ENTRY_MAX_BACKDATE_DAYS, POINT_EVIDENCE_MAX_BYTES, POINT_EVIDENCE_TYPES } from '@absah/contracts';

/** Mirror absah-api policies for kesiswaan (the API enforces them; these only decide what to show). */
export const POINT_RECORDERS: Role[] = ['admin', 'wakasek', 'wali_kelas', 'guru'];
export const POINT_MANAGERS: Role[] = ['admin', 'wakasek'];
export const POINT_PROFILE_READERS: Role[] = ['admin', 'kepsek', 'wakasek', 'wali_kelas'];
export const FOLLOWUP_READERS: Role[] = ['admin', 'kepsek', 'wakasek', 'wali_kelas', 'guru_bk'];
export const FOLLOWUP_CLOSERS: Role[] = ['admin', 'wakasek', 'wali_kelas', 'guru_bk'];
export const EARLY_WARNING_READERS: Role[] = FOLLOWUP_READERS;
export const BK_READERS: Role[] = ['guru_bk', 'admin'];
export const BK_WRITERS: Role[] = ['guru_bk'];

export const POINT_KIND_LABELS: Record<PointKind, string> = { violation: 'Pelanggaran', achievement: 'Prestasi' };

export const EARLY_WARNING_LABELS: Record<EarlyWarningKind, string> = {
  consecutive_alpa: 'Alpa berturut-turut',
  repeated_late: 'Terlambat berulang',
  bolos_jam: 'Bolos jam pelajaran',
  pkl_absence: 'Tidak hadir PKL',
};

export const FOLLOW_UP_LABELS: Record<CounselingFollowUp, string> = { none: 'Tanpa tindak lanjut', planned: 'Tindak lanjut direncanakan', done: 'Tindak lanjut selesai' };

/** "+20" for a prestasi, "-5" for a pelanggaran (a real minus sign would be read aloud as "minus", and that is fine). */
export const signedPoints = (points: number): string => (points > 0 ? `+${points}` : `${points}`);

/** The oldest date an entry may be recorded for, given today (YYYY-MM-DD, school clock). */
export function earliestEntryDate(today: string): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - POINT_ENTRY_MAX_BACKDATE_DAYS);
  return d.toISOString().slice(0, 10);
}

export type EvidenceCheck = { ok: true; contentType: (typeof POINT_EVIDENCE_TYPES)[number] } | { ok: false; message: string };

/** Checks a chosen file before asking the API for an upload URL, so the person hears about it at once. */
export function checkEvidence(file: { size: number; type: string }): EvidenceCheck {
  const contentType = (POINT_EVIDENCE_TYPES as readonly string[]).includes(file.type) ? (file.type as (typeof POINT_EVIDENCE_TYPES)[number]) : null;
  if (!contentType) return { ok: false, message: 'Bukti harus berupa foto (JPEG, PNG, WebP) atau PDF.' };
  if (file.size <= 0) return { ok: false, message: 'Berkas kosong.' };
  if (file.size > POINT_EVIDENCE_MAX_BYTES) return { ok: false, message: 'Bukti maksimal 5 MB.' };
  return { ok: true, contentType };
}

/** The wording of one point total: "-35 poin pelanggaran, +20 poin prestasi". */
export function totalsLine(violationPoints: number, achievementPoints: number): string {
  return `${signedPoints(violationPoints)} poin pelanggaran, ${signedPoints(achievementPoints)} poin prestasi`;
}
