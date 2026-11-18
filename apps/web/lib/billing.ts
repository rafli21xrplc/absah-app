import type { InvoiceStatus, PaymentStatus, Role } from '@absah/contracts';

/** Mirror absah-api subscription policies (the API enforces them). */
export const BILLING_READERS: Role[] = ['admin', 'kepsek'];
export const BILLING_PAYERS: Role[] = ['admin'];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { issued: 'Belum dibayar', paid: 'Lunas', void: 'Dibatalkan' };
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  requested: 'Menyiapkan…',
  pending: 'Menunggu pembayaran',
  paid: 'Dibayar',
  expired: 'Kedaluwarsa',
  failed: 'Gagal dibuat',
};

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** 28387 -> "Rp28.387". */
export const rupiah = (amount: number) => `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount)}`;

/** "3225.8065" -> "Rp3.225,81" (a line's exact share; only the total is rounded). */
export const share = (amount: string) => `Rp${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount))}`;

/** "2027-01" -> "Januari 2027". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

/** "2027-02-15" -> "15 Februari 2027". */
export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m} ${y}`;
}

/** "9881234567890" -> "9881 2345 6789 0": easier to read out and type at the bank. */
export const groupDigits = (n: string) => n.replace(/(\d{4})(?=\d)/g, '$1 ');
