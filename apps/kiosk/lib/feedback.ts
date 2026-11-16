import type { ScanRejectReason } from '@absah/contracts';

/** Large scan feedback on the kiosk: green = on time, amber = late or already in, red = rejected (GRB-03). */
export type ScanOutcome = 'on_time' | 'late' | 'duplicate' | 'rejected';

export const FEEDBACK: Record<ScanOutcome, { color: string; label: string }> = {
  on_time: { color: 'var(--absah-hadir)', label: 'Hadir' },
  late: { color: 'var(--absah-telat)', label: 'Terlambat' },
  duplicate: { color: 'var(--absah-telat)', label: 'Sudah tercatat' },
  rejected: { color: 'var(--absah-alpa)', label: 'Kartu ditolak' },
};

/** What to tell the student at the gate, short. */
export const REJECT_HINTS: Record<ScanRejectReason, string> = {
  malformed: 'Bukan kartu Absah.',
  expired: 'Kode kedaluwarsa. Buka ulang kartu di HP.',
  no_key: 'Kode kedaluwarsa. Buka ulang kartu di HP.',
  bad_signature: 'Kartu tidak sah untuk sekolah ini.',
  unknown_card: 'Kartu tidak dikenal. Lapor ke guru piket.',
  wrong_device: 'Kartu sudah dipindah ke HP lain.',
  not_enrolled: 'Siswa tidak terdaftar aktif. Lapor ke guru piket.',
};
