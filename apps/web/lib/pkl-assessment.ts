import { PKL_ASPECT_MAX, PKL_ASSESSMENT_OPEN_BEFORE_DAYS, PKL_SCORE_MAX, type PklAssessmentAspect, type PklAssessmentItem, type PklAssessmentWindow, type SavePklAspectsRequest, type SavePklAssessmentRequest } from '@absah/contracts';

export { PKL_ASPECT_MAX };

export const WINDOW_LABELS: Record<PklAssessmentWindow, string> = { not_yet: 'Belum dibuka', open: 'Bisa diisi', closed: 'Ditutup' };

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const dayMonth = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

/** The line under a student: when the form opens, or what state the assessment is in. */
export function assessmentNote(item: Pick<PklAssessmentItem, 'window' | 'endsOn' | 'assessment'>): string {
  if (item.assessment) return item.window === 'open' ? 'Sudah dinilai · masih bisa diperbaiki' : 'Sudah dinilai';
  if (item.window === 'not_yet') return `Dibuka ${dayMonth(addDays(item.endsOn, -PKL_ASSESSMENT_OPEN_BEFORE_DAYS))}`;
  return item.window === 'open' ? 'Belum dinilai' : 'Masa pengisian sudah ditutup';
}

/** "78,3" for a nilai akhir; "Belum dinilai" without one. */
export const overallText = (overall: number | null | undefined): string => (overall == null ? 'Belum dinilai' : overall.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export interface AspectDraft {
  /** Set for an aspect the school already has; new rows have none. */
  id?: string;
  name: string;
  description: string;
  weight: number;
}

export const draftsFrom = (aspects: readonly PklAssessmentAspect[]): AspectDraft[] => aspects.map((a) => ({ id: a.id, name: a.name, description: a.description ?? '', weight: a.weight }));

/** Moves a row up (-1) or down (1); out of range leaves the list as it is. */
export function moveRow<T>(rows: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= rows.length) return [...rows];
  const copy = [...rows];
  const [row] = copy.splice(index, 1);
  if (row !== undefined) copy.splice(target, 0, row);
  return copy;
}

/** The body of PUT /pkl/assessment-aspects, or the first thing wrong with the list (so the form can say it before sending). */
export function aspectsRequest(rows: readonly AspectDraft[]): { body: SavePklAspectsRequest } | { error: string } {
  if (rows.length === 0) return { error: 'Isi minimal satu aspek.' };
  const names = new Set<string>();
  for (const r of rows) {
    const name = r.name.trim();
    if (name.length < 2) return { error: 'Nama aspek minimal 2 huruf.' };
    if (names.has(name.toLowerCase())) return { error: `Nama aspek "${name}" dipakai dua kali.` };
    names.add(name.toLowerCase());
  }
  return { body: { items: rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim(), description: r.description.trim() || null, weight: r.weight })) } };
}

/** The body of PUT .../assessment from what was typed (aspect id -> text), or what is missing. */
export function scoresRequest(aspects: readonly Pick<PklAssessmentAspect, 'id' | 'name'>[], typed: Readonly<Record<string, string>>, note: string): { body: SavePklAssessmentRequest } | { error: string } {
  const scores: SavePklAssessmentRequest['scores'] = [];
  for (const a of aspects) {
    const text = (typed[a.id] ?? '').trim();
    if (!/^\d{1,3}$/.test(text) || Number(text) > PKL_SCORE_MAX) return { error: `Isi nilai ${a.name} dengan angka 0 sampai ${PKL_SCORE_MAX}.` };
    scores.push({ aspectId: a.id, score: Number(text) });
  }
  return { body: { scores, note: note.trim() || null } };
}
