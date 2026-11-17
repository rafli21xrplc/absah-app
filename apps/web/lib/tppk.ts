import type { Role, TppkReportCategory, TppkReporterRelation, TppkReportStatus } from '@absah/contracts';

/** Plain words for each form of violence (Permendikbudristek 46/2023), so a student can pick one. */
export const CATEGORY_LABELS: Record<TppkReportCategory, { label: string; hint: string }> = {
  fisik: { label: 'Kekerasan fisik', hint: 'Dipukul, ditendang, didorong, dilukai.' },
  psikis: { label: 'Kekerasan psikis', hint: 'Diancam, dihina, dipermalukan, ditakut-takuti.' },
  perundungan: { label: 'Perundungan', hint: 'Diejek atau dikucilkan berulang kali, termasuk di media sosial.' },
  seksual: { label: 'Kekerasan seksual', hint: 'Disentuh, dipaksa, atau dilecehkan secara seksual.' },
  diskriminasi: { label: 'Diskriminasi dan intoleransi', hint: 'Dibedakan karena agama, suku, disabilitas, atau latar belakang.' },
  kebijakan: { label: 'Aturan yang mengandung kekerasan', hint: 'Aturan atau hukuman sekolah yang menyakiti.' },
  lainnya: { label: 'Lainnya', hint: 'Tidak cocok dengan pilihan di atas.' },
};
export const CATEGORIES = Object.keys(CATEGORY_LABELS) as TppkReportCategory[];

export const RELATION_LABELS: Record<TppkReporterRelation, string> = {
  siswa: 'Siswa',
  orang_tua: 'Orang tua atau wali',
  guru: 'Guru',
  tenaga_kependidikan: 'Tenaga kependidikan',
  lainnya: 'Lainnya',
};
export const RELATIONS = Object.keys(RELATION_LABELS) as TppkReporterRelation[];

/** What the reporter reads on the tracking page. */
export const STATUS_LABELS: Record<TppkReportStatus, { label: string; hint: string }> = {
  diterima: { label: 'Diterima', hint: 'Laporan sudah masuk dan akan dibaca oleh tim TPPK sekolah.' },
  ditangani: { label: 'Sedang ditangani', hint: 'Tim TPPK sedang menangani laporan ini.' },
  selesai: { label: 'Selesai', hint: 'Tim TPPK sudah menyelesaikan penanganan laporan ini.' },
};

/** 10 characters as two groups of 5, easier to copy by hand. The API accepts it with or without the dash. */
export const formatCode = (code: string) => (code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code);

/** The address on the QR poster: the school id is not secret, the form is public. */
export const reportUrl = (origin: string, schoolId: string) => `${origin}/lapor?s=${encodeURIComponent(schoolId)}`;

/** Admin appoints the team (mirrors absah-api canAppointTppk). */
export const TPPK_APPOINTERS: Role[] = ['admin'];
