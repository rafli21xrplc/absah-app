import type { Role, UksOutcome } from '@absah/contracts';

/** Mirror absah-api canUseUks (the API enforces it): the notes are medical, only the petugas reads them. */
export const UKS_STAFF: Role[] = ['petugas_uks'];

export const OUTCOME_LABELS: Record<UksOutcome, string> = {
  kembali_kelas: 'Kembali ke kelas',
  istirahat: 'Istirahat di UKS',
  dipulangkan: 'Dipulangkan',
};
export const OUTCOMES = Object.keys(OUTCOME_LABELS) as UksOutcome[];
