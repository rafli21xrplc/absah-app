import type { CapabilityKey } from '@absah/capabilities';

/** How capabilities are named to school staff. */
export const CAPABILITY_LABELS: Record<CapabilityKey, string> = {
  'attendance.mode': 'Mode presensi',
  'attendance.learningGroups': 'Kelompok belajar (mapel pilihan, moving class)',
  'gate.enabled': 'Presensi gerbang',
  'gate.pickup': 'Penjemputan dengan penjemput resmi',
  'gate.visitors': 'Buku tamu',
  'card.holder': 'Pemegang kartu QR',
  'habits.kaih': 'Jurnal 7 Kebiasaan Anak Indonesia Hebat',
  'religious.worship': 'Jurnal ibadah',
  'religious.memorization': 'Setoran hafalan',
  'academic.streams': 'Peminatan / jurusan',
  'pkl.enabled': 'Praktik Kerja Lapangan (PKL)',
  'pkl.tracer': 'Tracer study alumni',
  'mbg.enabled': 'Laporan Makan Bergizi Gratis (MBG)',
  'student.tppk': 'Kanal lapor TPPK',
  'student.uks': 'Catatan UKS',
  'student.points': 'Poin kesiswaan, ambang, dan tugas tindak lanjut',
  'student.counseling': 'Catatan BK',
  'student.early_warning': 'Peringatan dini kehadiran',
  'teacher.attendance': 'Presensi, izin, dan pengganti guru',
  'student.billing': 'Tagihan siswa: SPP, kegiatan, dan pembayaran',
  'exam.enabled': 'Ujian: boleh ujian, ruang, dan absen ujian',
  'portal.liaison': 'Buku penghubung',
  'platform.openApi': 'API terbuka dan webhook untuk pihak ketiga',
  'data.source': 'Sumber data siswa',
  'report.target': 'Ekspor rapor',
};

export const CAPABILITY_VALUE_LABELS: Record<string, string> = {
  per_period: 'per jam pelajaran',
  daily: 'harian oleh wali kelas',
  student: 'siswa',
  parent: 'orang tua',
  off: 'tidak dipakai',
  dapodik: 'Dapodik',
  emis: 'EMIS',
  erapor: 'e-Rapor',
  rdm: 'RDM',
};
