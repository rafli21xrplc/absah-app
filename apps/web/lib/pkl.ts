import type { AttendanceStatus, DudiWorkDay, PklConfirmStatus, PklJournalStatus, PklReviewReason, Role } from '@absah/contracts';

/** Mirror absah-api canManagePkl / canSeeAllPkl (the API enforces them). */
export const PKL_MANAGERS: Role[] = ['admin', 'wakasek', 'humas_pkl'];
export const PKL_OVERSEERS: Role[] = ['admin', 'wakasek', 'humas_pkl', 'kepsek'];

export const CONFIRM_LABELS: Record<PklConfirmStatus, string> = {
  pending: 'Menunggu pembimbing industri',
  confirmed: 'Dikonfirmasi',
  needs_review: 'Perlu ditinjau guru',
  disputed: 'Disanggah',
  decided: 'Diputuskan guru',
};

export const REASON_LABELS: Record<PklReviewReason, string> = {
  outside_radius: 'di luar radius',
  outside_hours: 'di luar jam kerja',
  clock_skew: 'jam HP tidak cocok',
  no_industry_mentor: 'belum ada pembimbing industri',
};

export const JOURNAL_STATUS_LABELS: Record<PklJournalStatus, string> = { submitted: 'Menunggu tinjauan', approved: 'Disetujui', revision: 'Perlu revisi' };

export const STATUS_WORDS: Record<AttendanceStatus, string> = { H: 'Hadir', T: 'Terlambat', S: 'Sakit', I: 'Izin', A: 'Alpa' };

/** Mon-Fri 08.00-16.00: the usual office week, the starting point of the form. */
export const DEFAULT_WORK_HOURS: DudiWorkDay[] = [1, 2, 3, 4, 5].map((day) => ({ day, startsAt: '08:00', endsAt: '16:00' }));

/**
 * Coordinates pasted from Google Maps ("-6.2383, 106.9756" or a URL with "@-6.2383,106.9756,17z").
 * Returns null when there is no valid pair.
 */
export function parseCoordinates(text: string): { latitude: number; longitude: number } | null {
  const m = /(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/.exec(text);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** "Sen–Jum 08.00–16.00" when every day shares the hours, else one entry per day. */
export function workHoursLabel(hours: DudiWorkDay[], dayLabels: Record<number, string>): string {
  if (hours.length === 0) return 'Belum ada hari kerja';
  const clock = (t: string) => t.replace(':', '.');
  const first = hours[0];
  const same = first && hours.every((h) => h.startsAt === first.startsAt && h.endsAt === first.endsAt);
  const consecutive = hours.every((h, i) => i === 0 || h.day === (hours[i - 1]?.day ?? 0) + 1);
  if (first && same) {
    const last = hours[hours.length - 1] ?? first;
    const days = consecutive && hours.length > 2 ? `${dayLabels[first.day]}–${dayLabels[last.day]}` : hours.map((h) => dayLabels[h.day]).join(', ');
    return `${days} ${clock(first.startsAt)}–${clock(first.endsAt)}`;
  }
  return hours.map((h) => `${dayLabels[h.day]} ${clock(h.startsAt)}–${clock(h.endsAt)}`).join(', ');
}

/** "07.52" on the school clock (CLAUDE.md rule 6). */
export const clockIn = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(':', '.');
