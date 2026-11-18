import type { ActivityKind, ActivityLocation, Role } from '@absah/contracts';

/** Mirror absah-api canManageActivities / canSeeAllActivities (the API enforces them). */
export const ACTIVITY_MANAGERS: Role[] = ['admin', 'wakasek'];
export const ACTIVITY_OVERSEERS: Role[] = ['admin', 'operator', 'wakasek', 'kepsek'];

export const KIND_LABELS: Record<ActivityKind, string> = { ekskul: 'Ekskul', upacara: 'Upacara', ibadah: 'Ibadah', lainnya: 'Lainnya' };
export const KINDS = Object.keys(KIND_LABELS) as ActivityKind[];
export const LOCATION_LABELS: Record<ActivityLocation, string> = { sekolah: 'Di sekolah', luar_sekolah: 'Di luar sekolah' };
export const LOCATIONS = Object.keys(LOCATION_LABELS) as ActivityLocation[];

/** ISO weekdays, Senin = 1. */
export const DAY_LABELS: Record<number, string> = { 1: 'Sen', 2: 'Sel', 3: 'Rab', 4: 'Kam', 5: 'Jum', 6: 'Sab', 7: 'Min' };
export const DAYS = [1, 2, 3, 4, 5, 6, 7];

const dateLabel = (date: string) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));

/** "Sen, Jum" / "10 Des 2026 – 12 Des 2026" / "Setiap hari 1 Des 2026 – 3 Des 2026" (kemah) / "Belum dijadwalkan". */
export function scheduleLabel(a: { days: number[]; startsOn: string | null; endsOn: string | null }): string {
  const range = a.startsOn && a.endsOn ? `${dateLabel(a.startsOn)} – ${dateLabel(a.endsOn)}` : a.startsOn ? `mulai ${dateLabel(a.startsOn)}` : a.endsOn ? `sampai ${dateLabel(a.endsOn)}` : '';
  if (a.days.length > 0) return [a.days.map((d) => DAY_LABELS[d]).join(', '), range].filter(Boolean).join(' · ');
  return a.startsOn && a.endsOn ? `Setiap hari ${range}` : 'Belum dijadwalkan';
}

/** First and last day of a "YYYY-MM" month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** 0.857 -> "86%"; null -> "–". */
export const percent = (rate: number | null) => (rate === null ? '–' : `${Math.round(rate * 100)}%`);
