import type { Role } from '@absah/contracts';

/** Mirror absah-api canReadAllJournals (the API enforces it): every other teacher sees only their own. */
export const JOURNAL_MANAGERS: Role[] = ['admin', 'kepsek', 'wakasek'];
/** Who gets the menu: people who teach, and the managers who read the journal. */
export const JOURNAL_VIEWERS: Role[] = ['guru', 'wali_kelas', 'wakasek', 'kepsek', 'admin'];

/** "2026-11" for a date in the school's timezone (not the device's). */
export function monthIn(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}`;
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-11" -> "November 2026". */
export function monthLabel(month: string): string {
  const [year, number] = month.split('-');
  return `${MONTHS[Number(number) - 1] ?? ''} ${year ?? ''}`.trim();
}

/** "2026-11-09" -> "Sen, 9 Nov" without going through the device timezone. */
export function shortDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${(MONTHS[d.getUTCMonth()] ?? '').slice(0, 3)}`;
}

/** Groups journal entries by teacher, in order of first appearance (entries arrive sorted by date). */
export function byTeacher<T extends { teacher: { id: string; name: string } | null }>(entries: T[]): { teacher: { id: string; name: string } | null; entries: T[] }[] {
  const groups = new Map<string, { teacher: { id: string; name: string } | null; entries: T[] }>();
  for (const e of entries) {
    const key = e.teacher?.id ?? '';
    const group = groups.get(key) ?? { teacher: e.teacher, entries: [] };
    group.entries.push(e);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.teacher?.name ?? '').localeCompare(b.teacher?.name ?? '', 'id'));
}
