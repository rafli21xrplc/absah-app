import type { ReportSemesterList, Role } from '@absah/contracts';

/** Mirror absah-api report policies (the API enforces them). Teachers see only a rombel they are wali of. */
export const RECAP_MANAGERS: Role[] = ['admin', 'operator', 'kepsek', 'wakasek'];
export const RECAP_READERS: Role[] = [...RECAP_MANAGERS, 'wali_kelas', 'guru'];
export const COMPLIANCE_READERS: Role[] = ['admin', 'kepsek', 'wakasek'];

export interface Period {
  from: string;
  to: string;
  /** Set when the period is a semester: exports need one. */
  semesterId: string | null;
}

type Semester = ReportSemesterList['items'][number];

/**
 * The period in the URL (?semester= or ?from=&to=), else the semester that contains today, else today.
 * A semester id the school does not have falls back the same way.
 */
export function periodFrom(params: URLSearchParams, semesters: readonly Semester[], today: string): Period {
  const semester = semesters.find((s) => s.id === params.get('semester'));
  if (semester) return { from: semester.startsOn, to: semester.endsOn, semesterId: semester.id };
  const from = params.get('from');
  const to = params.get('to');
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (from && to && iso.test(from) && iso.test(to) && from <= to) return { from, to, semesterId: null };
  const current = semesters.find((s) => s.startsOn <= today && today <= s.endsOn);
  if (current) return { from: current.startsOn, to: current.endsOn, semesterId: current.id };
  return { from: today, to: today, semesterId: null };
}

/** Query string for links that keep the chosen period. */
export function periodQuery(period: Period): string {
  return period.semesterId ? `semester=${period.semesterId}` : `from=${period.from}&to=${period.to}`;
}

export function semesterLabel(s: Pick<Semester, 'number' | 'academicYear'>): string {
  return `Semester ${s.number === 1 ? 'ganjil' : 'genap'} ${s.academicYear}`;
}

/** 0.9123 -> "91,2%"; null -> "–". */
export function percent(rate: number | null): string {
  if (rate === null) return '–';
  return `${(Math.round(rate * 1000) / 10).toLocaleString('id-ID')}%`;
}
