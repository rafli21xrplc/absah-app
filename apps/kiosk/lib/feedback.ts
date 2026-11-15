/** Large scan feedback on the kiosk: green = on time, amber = late, red = rejected (GRB-03). */
export type ScanOutcome = 'on_time' | 'late' | 'rejected';

export const FEEDBACK: Record<ScanOutcome, { color: string; label: string }> = {
  on_time: { color: 'var(--absah-hadir)', label: 'Hadir' },
  late: { color: 'var(--absah-telat)', label: 'Terlambat' },
  rejected: { color: 'var(--absah-alpa)', label: 'Kartu ditolak' },
};
