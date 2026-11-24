import { KAIH_HABITS, type HabitCode, type HabitDay, type Role } from '@absah/contracts';

/** 7 Kebiasaan Anak Indonesia Hebat, in the order of the ministry's poster. */
export const HABIT_LABELS: Record<HabitCode, string> = {
  bangun_pagi: 'Bangun pagi',
  beribadah: 'Beribadah',
  berolahraga: 'Berolahraga',
  makan_sehat: 'Makan sehat dan bergizi',
  gemar_belajar: 'Gemar belajar',
  bermasyarakat: 'Bermasyarakat',
  tidur_cepat: 'Tidur cepat',
};
export const HABITS = KAIH_HABITS;

/** Who opens the weekly summary (the API narrows a guru to the rombel they are wali kelas of). */
export const HABIT_SUMMARY_READERS: Role[] = ['admin', 'operator', 'kepsek', 'wakasek', 'wali_kelas', 'guru'];

/** Ticks of one day as sent by PUT /habits: every habit, unticked = false. */
export const habitsBody = (ticked: ReadonlySet<HabitCode>) => Object.fromEntries(HABITS.map((h) => [h, ticked.has(h)])) as Record<HabitCode, boolean>;

/** Habits ticked on a day (null and false both mean not done). */
export const tickedOf = (day: Pick<HabitDay, 'habits'>) => new Set(HABITS.filter((h) => day.habits[h] === true));

/** The Monday of the week of an ISO date (weeks run Monday to Sunday, like the API). */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Sen, 16 Nov" for a day row. */
export const shortDay = (date: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
