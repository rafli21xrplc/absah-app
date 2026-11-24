import { describe, expect, it } from 'vitest';
import { checkInProblem, examWindowLabel, reasonLabel, ruleSummary } from './exam';

describe('reasonLabel', () => {
  it('says the student’s own number and the minimum, and how many installments are open, never an amount', () => {
    expect(reasonLabel({ kind: 'attendance', percent: 60, minimum: 75 })).toBe('Kehadiran 60% (minimal 75%)');
    expect(reasonLabel({ kind: 'attendance', percent: 74.9, minimum: 75 })).toBe('Kehadiran 74,9% (minimal 75%)');
    expect(reasonLabel({ kind: 'bills', unpaidInstallments: 1 })).toBe('1 cicilan belum lunas');
    expect(reasonLabel({ kind: 'bills', unpaidInstallments: 3 })).toBe('3 cicilan belum lunas');
  });
});

describe('examWindowLabel', () => {
  it('writes one day, a stretch in a month, across months and across years', () => {
    expect(examWindowLabel('2026-12-01', '2026-12-01')).toBe('1 Desember 2026');
    expect(examWindowLabel('2026-12-01', '2026-12-05')).toBe('1–5 Desember 2026');
    expect(examWindowLabel('2026-11-30', '2026-12-02')).toBe('30 November–2 Desember 2026');
    expect(examWindowLabel('2026-12-30', '2027-01-02')).toBe('30 Desember 2026–2 Januari 2027');
  });
});

describe('ruleSummary', () => {
  it('reads the rule the school chose', () => {
    expect(ruleSummary({ minAttendance: 75, excusedCounts: true, requirePaid: true, feeTypeIds: [] })).toBe('Kehadiran minimal 75% (sakit dan izin dihitung hadir) · Semua tagihan yang jatuh tempo harus lunas');
    expect(ruleSummary({ minAttendance: 80, excusedCounts: false, requirePaid: true, feeTypeIds: ['a', 'b'] })).toBe('Kehadiran minimal 80% (sakit dan izin tidak dihitung) · Tagihan terpilih (2 jenis) harus lunas');
    expect(ruleSummary({ minAttendance: null, excusedCounts: true, requirePaid: false, feeTypeIds: [] })).toBe('Semua siswa boleh ujian (belum ada syarat)');
  });
});

describe('checkInProblem', () => {
  it('turns the API’s reasons into what the pengawas should do', () => {
    expect(checkInProblem({ reason: 'wrong_room', room: 'R2' })).toBe('Siswa ini duduk di ruang R2.');
    expect(checkInProblem({ reason: 'not_eligible', reasons: ['bills'] })).toBe('Siswa ini belum boleh ujian.');
    expect(checkInProblem({ reason: 'card_rejected', cardReason: 'expired' })).toMatch(/kedaluwarsa/);
    expect(checkInProblem({ reason: 'card_rejected', cardReason: 'wrong_device' })).toMatch(/HP lain/);
    expect(checkInProblem({ reason: 'not_exam_day' })).toBe('Hari ini bukan hari ujian ini.');
    expect(checkInProblem({ reason: 'something_new' })).toBe('Tidak bisa mencatat kedatangan.');
    expect(checkInProblem(undefined)).toBe('Tidak bisa mencatat kedatangan.');
  });
});
