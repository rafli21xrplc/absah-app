import { BILLING_MANAGERS, BILLING_READERS, STUDENT_BILL_PAYERS } from '@absah/contracts';
import type { BillInstallment, BillStatus, FeeKind, Role, StudentBill } from '@absah/contracts';

/** Role lists come from the contracts, the same constants the API's policies are built from. (lib/billing.ts is the school's own Absah subscription.) */
export const STUDENT_BILLING_MANAGING: Role[] = [...BILLING_MANAGERS];
export const STUDENT_BILLING_READING: Role[] = [...BILLING_READERS];
export const STUDENT_BILL_PAYING: Role[] = [...STUDENT_BILL_PAYERS];

export const FEE_KIND_LABELS: Record<FeeKind, string> = { spp: 'SPP', kegiatan: 'Kegiatan', lainnya: 'Lainnya' };
export const BILL_STATUS_LABELS: Record<BillStatus, string> = { open: 'Belum lunas', paid: 'Lunas', void: 'Dibatalkan' };

/** What a bill says about itself: overdue beats open, so a late bill is not read as merely unpaid. */
export function billState(bill: Pick<StudentBill, 'status' | 'overdue'>): string {
  if (bill.status === 'open' && bill.overdue) return 'Lewat jatuh tempo';
  return BILL_STATUS_LABELS[bill.status];
}

/** The installment to pay next: the first one not paid yet (they are paid in order). */
export function nextInstallment(bill: Pick<StudentBill, 'status' | 'installments'>): BillInstallment | null {
  if (bill.status !== 'open') return null;
  return [...bill.installments].sort((a, b) => a.number - b.number).find((i) => !i.paidAt) ?? null;
}

/** A charge that is still going to be paid (being opened, or waiting for the money). */
export const hasLiveCharge = (i: Pick<BillInstallment, 'payment'>): boolean => i.payment?.status === 'requested' || i.payment?.status === 'pending';

/** "250.000" or "Rp 250.000" -> 250000; null for anything that is not whole rupiah. */
export function parseRupiah(text: string): number | null {
  const digits = text.replace(/^\s*rp\.?\s*/i, '').replaceAll('.', '').replace(/\s/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** "2026-11-30" + 1 -> "2026-12-30"; a short month keeps the last day ("2026-01-31" + 1 -> "2026-02-28"). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const index = m - 1 + months;
  const year = y + Math.floor(index / 12);
  const month = (((index % 12) + 12) % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, daysIn(year, month))).padStart(2, '0')}`;
}

/** n equal parts, one a month from the first due date; the first parts carry the odd rupiah so the sum is exact. */
export function evenInstallments(amount: number, parts: number, firstDue: string): { amount: number; dueOn: string }[] {
  const base = Math.floor(amount / parts);
  const extra = amount - base * parts;
  return Array.from({ length: parts }, (_, i) => ({ amount: base + (i < extra ? 1 : 0), dueOn: addMonths(firstDue, i) }));
}

export interface IssueForm {
  feeTypeId: string;
  period: string;
  amountText: string;
  target: 'class' | 'grade';
  classId: string;
  grade: string;
  parts: number;
  dueOn: string;
}

/** Problems with the issue form before it is sent, as the message to show, or null. */
export function issueProblem(form: IssueForm): string | null {
  if (!form.feeTypeId) return 'Pilih jenis tagihan.';
  if (!form.period.trim()) return 'Tulis periodenya, misalnya 2026-11 atau Semester 1.';
  if (form.amountText.trim() !== '' && (parseRupiah(form.amountText) ?? 0) < 1) return 'Nominal harus angka rupiah, tanpa koma.';
  if (form.target === 'class' && !form.classId) return 'Pilih rombelnya.';
  if (form.target === 'grade' && !/^\d{1,2}$/.test(form.grade.trim())) return 'Isi kelasnya dengan angka, misalnya 8.';
  if (!form.dueOn) return 'Isi tanggal jatuh tempo (cicilan pertama bila dicicil).';
  return null;
}

/** What the school is told after issuing. */
export function issueSummary(result: { created: number; skipped: number; billed: number }, rupiah: (n: number) => string): string {
  if (result.created === 0 && result.skipped > 0) return `Semua ${result.skipped} siswa sudah punya tagihan ini; tidak ada yang dibuat.`;
  const skipped = result.skipped > 0 ? ` ${result.skipped} siswa sudah punya tagihan ini dan dilewati.` : '';
  return `${result.created} tagihan dibuat, total ${rupiah(result.billed)}.${skipped}`;
}
