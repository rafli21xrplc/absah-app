import type { Role } from '@absah/contracts';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  operator: 'Operator',
  kepsek: 'Kepala sekolah',
  wakasek: 'Wakil kepala sekolah',
  wali_kelas: 'Wali kelas',
  guru: 'Guru',
  piket: 'Guru piket',
  petugas_uks: 'Petugas UKS',
  guru_bk: 'Guru BK',
  guru_tahfidz: 'Guru tahfidz',
  bendahara: 'Bendahara',
  tppk: 'Anggota TPPK',
  pembina: 'Pembina',
  humas_pkl: 'Humas / koordinator PKL',
  pembimbing_pkl: 'Guru pembimbing PKL',
  pembimbing_industri: 'Pembimbing industri',
  orang_tua: 'Orang tua',
  siswa: 'Siswa',
};
