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
} as const;

export type Messages = typeof messages;
