import { describe, expect, it } from 'vitest';
import { addMonths, billState, evenInstallments, hasLiveCharge, issueProblem, issueSummary, nextInstallment, parseRupiah, type IssueForm } from './student-billing';

const inst = (number: number, paidAt: string | null = null, payment: { status: string } | null = null) => ({ id: `i${number}`, number, amount: 1, dueOn: '2026-12-10', paidAt, payment }) as never;

describe('bill state', () => {
  it('reads overdue before open, and the rest as they are', () => {
    expect(billState({ status: 'open', overdue: true })).toBe('Lewat jatuh tempo');
    expect(billState({ status: 'open', overdue: false })).toBe('Belum lunas');
    expect(billState({ status: 'paid', overdue: false })).toBe('Lunas');
    expect(billState({ status: 'void', overdue: false })).toBe('Dibatalkan');
  });

  it('offers the first unpaid installment of an open bill only', () => {
    expect(nextInstallment({ status: 'open', installments: [inst(2), inst(1, '2026-11-01T00:00:00Z')] })?.number).toBe(2);
    expect(nextInstallment({ status: 'open', installments: [inst(1, 'x')] })).toBeNull();
    expect(nextInstallment({ status: 'void', installments: [inst(1)] })).toBeNull();
  });

  it('knows a charge that is still going to be paid', () => {
    expect(hasLiveCharge(inst(1, null, { status: 'pending' }))).toBe(true);
    expect(hasLiveCharge(inst(1, null, { status: 'requested' }))).toBe(true);
    expect(hasLiveCharge(inst(1, null, { status: 'expired' }))).toBe(false);
    expect(hasLiveCharge(inst(1))).toBe(false);
  });
});

describe('rupiah input', () => {
  it('reads whole rupiah with dots, and refuses the rest', () => {
    expect(parseRupiah('250.000')).toBe(250_000);
    expect(parseRupiah('Rp 1.500.000')).toBe(1_500_000);
    expect(parseRupiah('90000')).toBe(90_000);
    expect(parseRupiah('2,5')).toBeNull();
    expect(parseRupiah('')).toBeNull();
    expect(parseRupiah('seratus')).toBeNull();
  });
});

describe('installment plans', () => {
  it('adds months, keeping the last day of a short month, across a year end', () => {
    expect(addMonths('2026-11-10', 1)).toBe('2026-12-10');
    expect(addMonths('2026-12-10', 1)).toBe('2027-01-10');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 14)).toBe('2028-01-30');
  });

  it('splits into equal parts that add up exactly, one a month', () => {
    const plan = evenInstallments(1_000_000, 3, '2026-11-10');
    expect(plan).toEqual([{ amount: 333_334, dueOn: '2026-11-10' }, { amount: 333_333, dueOn: '2026-12-10' }, { amount: 333_333, dueOn: '2027-01-10' }]);
    expect(plan.reduce((n, p) => n + p.amount, 0)).toBe(1_000_000);
  });
});

describe('issue form', () => {
  const ok: IssueForm = { feeTypeId: 'f', period: '2026-11', amountText: '', target: 'class', classId: 'c', grade: '', parts: 1, dueOn: '2026-11-10' };
  it('names what is missing, in the order the form is read', () => {
    expect(issueProblem(ok)).toBeNull();
    expect(issueProblem({ ...ok, feeTypeId: '' })).toBe('Pilih jenis tagihan.');
    expect(issueProblem({ ...ok, period: ' ' })).toMatch(/periodenya/);
    expect(issueProblem({ ...ok, amountText: '2,5' })).toMatch(/Nominal/);
    expect(issueProblem({ ...ok, amountText: '0' })).toMatch(/Nominal/);
    expect(issueProblem({ ...ok, classId: '' })).toBe('Pilih rombelnya.');
    expect(issueProblem({ ...ok, target: 'grade', grade: 'delapan' })).toMatch(/angka/);
    expect(issueProblem({ ...ok, target: 'grade', grade: '8' })).toBeNull();
    expect(issueProblem({ ...ok, dueOn: '' })).toMatch(/jatuh tempo/);
  });

  it('says what was created, and what was left because it existed', () => {
    const r = (n: number) => `Rp${n}`;
    expect(issueSummary({ created: 3, skipped: 0, billed: 750_000 }, r)).toBe('3 tagihan dibuat, total Rp750000.');
    expect(issueSummary({ created: 1, skipped: 2, billed: 250_000 }, r)).toBe('1 tagihan dibuat, total Rp250000. 2 siswa sudah punya tagihan ini dan dilewati.');
    expect(issueSummary({ created: 0, skipped: 3, billed: 0 }, r)).toBe('Semua 3 siswa sudah punya tagihan ini; tidak ada yang dibuat.');
  });
});
