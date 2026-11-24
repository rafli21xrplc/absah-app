/**
 * Every default text a shared component shows. Plain Indonesian, no technical words (Sistem-UI "Bahasa di layar").
 * Pages pass their own text for their own content; only what the component itself says lives here.
 */
export const messages = {
  status: {
    H: 'Hadir',
    T: 'Telat',
    I: 'Izin',
    S: 'Sakit',
    A: 'Alpa',
    '?': 'Belum diisi',
  },
  button: {
    loading: 'Sedang diproses',
  },
  field: {
    optional: '(boleh dikosongkan)',
    errorLabel: 'Perlu diperbaiki',
  },
  banner: {
    info: 'Info',
    warning: 'Perhatian',
    offline: 'Tanpa sinyal',
    error: 'Belum berhasil',
  },
  toast: {
    undo: 'Urungkan',
    close: 'Tutup',
    region: 'Pemberitahuan',
  },
  progress: {
    of: 'dari',
  },
  dialog: {
    cancel: 'Batal',
  },
  sheet: {
    cancel: 'Batal',
  },
  drawer: {
    close: 'Tutup',
    cancel: 'Batal',
  },
  skeleton: {
    label: 'Sedang memuat',
  },
  errorState: {
    retry: 'Coba lagi',
    pending: 'Menunggu',
  },
  bottomNav: {
    label: 'Menu utama',
  },
  today: {
    current: 'Sedang berlangsung',
    unfilled: 'Belum diisi',
    next: 'Berikutnya',
    done: 'Sudah selesai',
    fill: 'Isi presensi',
    sent: 'Terkirim',
    missed: 'Tidak diisi',
    locked: 'Dikunci',
    empty: 'Tidak ada jadwal mengajar hari ini',
    emptyBody: 'Jadwal muncul di sini pada hari mengajar.',
    emptyAll: 'Belum ada sesi hari ini',
    emptyAllBody: 'Sesi dibuat otomatis pukul 05.00 pada hari sekolah.',
    offline: 'Daftar dari salinan di HP (pukul {time}). Sesi yang diisi dikirim otomatis saat sinyal kembali.',
    errorTitle: 'Jadwal belum bisa dimuat',
    errorBody: 'Data Anda aman. Coba lagi sebentar lagi.',
    scope: 'Tampilkan',
    scopeMine: 'Sesi saya',
    scopeAll: 'Semua sesi',
    greetingMorning: 'Selamat pagi',
    greetingNoon: 'Selamat siang',
    greetingAfternoon: 'Selamat sore',
    greetingNight: 'Selamat malam',
  },
  sideNav: {
    label: 'Menu utama',
  },
  appShell: {
    skip: 'Lewati ke isi halaman',
    shortcuts: 'Pintasan',
    menu: 'Menu',
    closeMenu: 'Tutup menu',
  },
  pageState: {
    errorTitle: 'Halaman belum bisa dibuka',
    errorBody: 'Data Anda aman. Coba lagi, atau kembali ke beranda.',
    notFoundTitle: 'Halaman tidak ditemukan',
    notFoundBody: 'Alamat ini tidak ada atau sudah dipindah.',
    home: 'Ke beranda',
  },
} as const;

export type Messages = typeof messages;
