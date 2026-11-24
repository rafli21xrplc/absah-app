import type { MbgDaily } from '@absah/contracts';
import { describe, expect, it } from 'vitest';
import { clock, mbgStatusLine } from './mbg';

const daily = (patch: Partial<MbgDaily>): MbgDaily => ({
  date: '2027-02-01',
  cutoffTime: '08:30',
  status: 'pending',
  countedAt: null,
  sentAt: null,
  total: { enrolled: 0, present: 0, unrecorded: 0 },
  classes: [],
  ...patch,
});

describe('mbg labels', () => {
  it('writes times the Indonesian way', () => {
    expect(clock('08:30')).toBe('08.30');
  });

  it('explains each status', () => {
    expect(mbgStatusLine(daily({}), 'Asia/Jakarta')).toBe('Angka sementara. Dihitung dan dikirim ke PIC pukul 08.30.');
    expect(mbgStatusLine(daily({ status: 'not_school_day' }), 'Asia/Jakarta')).toMatch(/Bukan hari sekolah/);
    const at = '2027-02-01T01:30:00.000Z';
    expect(mbgStatusLine(daily({ status: 'counted', countedAt: at, sentAt: at }), 'Asia/Jakarta')).toBe('Dihitung pukul 08.30, terkirim ke PIC.');
    expect(mbgStatusLine(daily({ status: 'counted', countedAt: at }), 'Asia/Makassar')).toBe('Dihitung pukul 09.30. Belum ada nomor PIC, jadi tidak dikirim.');
  });
});
