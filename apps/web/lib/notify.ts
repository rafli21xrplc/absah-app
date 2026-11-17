import type { NotificationStatus, Role, TemplateCode } from '@absah/contracts';

/** Mirrors absah-api canSeeNotifications. */
export const NOTIFY_VIEWERS: Role[] = ['admin', 'operator'];

export const STATUS_LABELS: Record<NotificationStatus, string> = {
  queued: 'Antre',
  sent: 'Terkirim',
  delivered: 'Diterima',
  read: 'Dibaca',
  failed: 'Gagal',
};

export const TEMPLATE_LABELS: Record<TemplateCode, string> = {
  absent_marked: 'Alpa',
  leave_approved: 'Izin disetujui',
  leave_rejected: 'Izin ditolak',
  login_otp: 'Kode masuk',
  mbg_count: 'Jumlah hadir MBG',
  mbg_count_corrected: 'Koreksi MBG',
  student_sent_home: 'Dipulangkan dari UKS',
};

/** Plain words for the common failure codes; the code itself stays visible for support. */
export function errorLabel(code: string | null): string {
  if (!code) return 'Tidak diketahui';
  if (code === 'template_not_approved') return 'Template belum disetujui WhatsApp';
  if (code === 'no_template') return 'Template tidak ditemukan';
  if (code === 'network') return 'Koneksi ke WhatsApp gagal';
  if (code.startsWith('http_429')) return 'Batas kirim WhatsApp tercapai';
  if (code === 'wa_131026' || code.includes(':131026')) return 'Nomor tidak bisa menerima WhatsApp';
  return 'Ditolak WhatsApp';
}
