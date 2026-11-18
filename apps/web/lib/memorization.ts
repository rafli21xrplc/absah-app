import { SURAH_AYAT, SURAH_NAMES, type Role } from '@absah/contracts';

/** Mirror absah-api canRecordMemorization (the API enforces it). */
export const MEMORIZATION_WRITERS: Role[] = ['guru_tahfidz', 'admin'];

/** Options for the surah select: "67. Al-Mulk (30 ayat)". */
export const SURAH_OPTIONS = SURAH_NAMES.map((name, i) => ({ value: i + 1, label: `${i + 1}. ${name} (${SURAH_AYAT[i]} ayat)` }));

/** Ayat in a surah (1-based); 0 for an unknown number. */
export const ayatIn = (surah: number) => SURAH_AYAT[surah - 1] ?? 0;

/** Optional whole number field: '' -> undefined, else the number (the contract checks the range). */
export function optionalInt(text: string): number | undefined {
  const t = text.trim();
  return t === '' ? undefined : Number(t);
}
