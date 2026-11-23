import type { CollectionSchoolSummary, EarlyWarningKind, PrincipalDashboard, Role } from '@absah/contracts';
import { EARLY_WARNING_LABELS } from './ksw';

/** Mirror absah-api canReadPrincipalDashboard (the API enforces it). */
export const DASHBOARD_READERS: Role[] = ['admin', 'kepsek', 'wakasek'];

/** "Alpa berturut-turut, Terlambat berulang" for the kinds a student was warned about. */
export const kindsLine = (kinds: readonly EarlyWarningKind[]): string => kinds.map((k) => EARLY_WARNING_LABELS[k]).join(', ');

/** Width of a trend bar in percent; no rate (a day without rekap) is an empty bar, never a full one. */
export const barWidth = (rate: number | null): number => (rate === null ? 0 : Math.max(0, Math.min(100, Math.round(rate * 100))));

/** "27 dari 35 sesi sudah diisi · 3 terlewat · 5 belum jatuh tempo" — open sessions are not due yet, so they are not "terlewat". */
export function sessionsLine(s: Pick<PrincipalDashboard['sessions'], 'total' | 'filled' | 'missed' | 'open'>): string {
  if (s.total === 0) return 'Belum ada sesi hari ini';
  const parts = [`${s.filled} dari ${s.total} sesi sudah diisi`];
  if (s.missed > 0) parts.push(`${s.missed} terlewat`);
  if (s.open > 0) parts.push(`${s.open} belum jatuh tempo`);
  return parts.join(' · ');
}

/** MBG tile text, by the day's status (the same words as the home card). */
export function mbgLine(mbg: NonNullable<PrincipalDashboard['mbg']>): string {
  if (mbg.status === 'not_school_day') return 'Bukan hari sekolah';
  const base = `${mbg.present} dari ${mbg.enrolled} penerima hadir`;
  if (mbg.status === 'pending') return `${base} sejauh ini`;
  return mbg.unrecorded > 0 ? `${base} · ${mbg.unrecorded} belum tercatat` : base;
}

/** The schools of a collection ranked for attention: lowest attendance first, schools without rekap last. */
export function schoolsByAttention(schools: readonly CollectionSchoolSummary[]): CollectionSchoolSummary[] {
  return [...schools].sort((a, b) => {
    const [x, y] = [a.attendance.presentRate, b.attendance.presentRate];
    if (x === null || y === null) return x === y ? a.name.localeCompare(b.name, 'id') : x === null ? 1 : -1;
    return x - y || a.name.localeCompare(b.name, 'id');
  });
}
