import { TEACHER_LEAVE_KINDS } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { candidateNotes, checkInSummary, clockLabel, leaveDays, mayCancelTeacherLeave, monthLabel, rateLabel, shiftMonth, sessionTimeLabel, startLabel, TEACHER_CHECKIN, TEACHER_DAY_LABELS, TEACHER_LEAVE_DECIDING, TEACHER_LEAVE_KIND_LABELS, teacherLeaveProblem } from './teacher';

describe('teacher labels', () => {
  it('name every izin kind the API knows, and every day status of the report', () => {
    expect(Object.keys(TEACHER_LEAVE_KIND_LABELS).sort()).toEqual([...TEACHER_LEAVE_KINDS].sort());
    expect(Object.keys(TEACHER_DAY_LABELS).sort()).toEqual(['dinas', 'izin', 'late', 'none', 'present', 'sakit']);
  });

  it('keep the roles of the API: who checks in and who decides', () => {
    expect(TEACHER_CHECKIN).toContain('guru');
    expect(TEACHER_CHECKIN).not.toContain('kepsek');
    expect(TEACHER_LEAVE_DECIDING).toEqual(['wakasek', 'kepsek', 'admin']);
  });
});

describe('clockLabel and startLabel', () => {
  it('writes the school wall clock, not UTC', () => {
    expect(clockLabel('2026-11-23T00:05:00Z', 'Asia/Jakarta')).toBe('07.05');
    expect(clockLabel('2026-11-23T00:05:00Z', 'Asia/Jayapura')).toBe('09.05');
    expect(clockLabel('2026-11-22T23:50:00Z', 'Asia/Jakarta')).toBe('06.50');
    expect(clockLabel('2026-11-23T16:30:00Z', 'Asia/Jakarta')).toBe('23.30');
  });

  it('writes the school start with a dot', () => {
    expect(startLabel('07:00')).toBe('07.00');
    expect(startLabel('07:30:00')).toBe('07.30');
  });
});

describe('checkInSummary', () => {
  it('says on time, late and the check-out', () => {
    const base = { checkedInAt: '2026-11-23T00:05:00Z', checkedOutAt: null, late: false };
    expect(checkInSummary(base, '07:00', 'Asia/Jakarta')).toBe('Masuk pukul 07.05, tepat waktu');
    expect(checkInSummary({ ...base, late: true }, '07:00', 'Asia/Jakarta')).toBe('Masuk pukul 07.05, terlambat (sekolah mulai 07.00)');
    expect(checkInSummary({ ...base, checkedOutAt: '2026-11-23T08:00:00Z' }, '07:00', 'Asia/Jakarta')).toBe('Masuk pukul 07.05, tepat waktu · Pulang pukul 15.00');
  });
});

describe('mayCancelTeacherLeave', () => {
  it.each([
    { status: 'pending', endsOn: '2026-11-30', ok: true },
    { status: 'approved', endsOn: '2026-11-23', ok: true },
    { status: 'approved', endsOn: '2026-11-22', ok: false },
    { status: 'rejected', endsOn: '2026-11-30', ok: false },
    { status: 'cancelled', endsOn: '2026-11-30', ok: false },
  ] as const)('$status ending $endsOn: $ok', ({ status, endsOn, ok }) => expect(mayCancelTeacherLeave({ status, endsOn }, '2026-11-23')).toBe(ok));
});

describe('teacherLeaveProblem', () => {
  it('lets a good form through and names what is wrong otherwise', () => {
    expect(teacherLeaveProblem({ startsOn: '2026-11-24', endsOn: '2026-11-25', reason: 'Demam' })).toBeNull();
    expect(teacherLeaveProblem({ startsOn: '', endsOn: '2026-11-25', reason: 'x' })).toBe('Isi tanggal mulai dan selesai.');
    expect(teacherLeaveProblem({ startsOn: '2026-11-26', endsOn: '2026-11-25', reason: 'x' })).toBe('Tanggal selesai sebelum tanggal mulai.');
    expect(teacherLeaveProblem({ startsOn: '2026-11-24', endsOn: '2026-11-24', reason: '   ' })).toBe('Tulis alasannya.');
  });
});

describe('sessionTimeLabel', () => {
  it('names the lesson and its time, or a daily session', () => {
    expect(sessionTimeLabel({ number: 2, startsAt: '07:40', endsAt: '08:20' })).toBe('Jam ke-2 (07.40–08.20)');
    expect(sessionTimeLabel(null)).toBe('Sesi harian');
  });
});

describe('candidateNotes', () => {
  it('says who is already at school, the subject and the load', () => {
    expect(candidateNotes({ checkedIn: true, sameSubject: true, substitutionsThisMonth: 2 })).toBe('Sudah absen · Mapel sama · 2× mengganti bulan ini');
    expect(candidateNotes({ checkedIn: false, sameSubject: false, substitutionsThisMonth: 0 })).toBe('Belum absen · Belum mengganti bulan ini');
  });
});

describe('month helpers', () => {
  it('writes the month in Indonesian and steps over year ends', () => {
    expect(monthLabel('2026-11')).toBe('November 2026');
    expect(monthLabel('2027-01')).toBe('Januari 2027');
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(shiftMonth('2026-03', -1)).toBe('2026-02');
  });
});

describe('rateLabel and leaveDays', () => {
  it('uses the decimal comma and a dash without school days', () => {
    expect(rateLabel(62.5)).toBe('62,5%');
    expect(rateLabel(100)).toBe('100%');
    expect(rateLabel(0)).toBe('0%');
    expect(rateLabel(null)).toBe('–');
    expect(leaveDays({ sakit: 1, izin: 2, dinas: 3 })).toBe(6);
  });
});
