import { describe, expect, it } from 'vitest';
import { aspectsRequest, assessmentNote, draftsFrom, moveRow, overallText, scoresRequest } from './pkl-assessment';

describe('assessment lines (PKL-04)', () => {
  it('says when the form opens or what state it is in', () => {
    expect(assessmentNote({ window: 'not_yet', endsOn: '2027-03-31', assessment: null })).toBe('Dibuka 17 Mar 2027');
    expect(assessmentNote({ window: 'open', endsOn: '2027-03-31', assessment: null })).toBe('Belum dinilai');
    expect(assessmentNote({ window: 'closed', endsOn: '2027-03-31', assessment: null })).toBe('Masa pengisian sudah ditutup');
    const given = { overall: 80, note: null, assessedAt: '2027-03-20T03:00:00+07:00', scores: [] };
    expect(assessmentNote({ window: 'open', endsOn: '2027-03-31', assessment: given })).toBe('Sudah dinilai · masih bisa diperbaiki');
    expect(assessmentNote({ window: 'closed', endsOn: '2027-03-31', assessment: given })).toBe('Sudah dinilai');
  });

  it('writes the nilai akhir with one decimal and a comma', () => {
    expect(overallText(78.3)).toBe('78,3');
    expect(overallText(100)).toBe('100,0');
    expect(overallText(null)).toBe('Belum dinilai');
  });
});

describe('aspect form (PKL-04)', () => {
  it('moves a row and stays put at the ends', () => {
    expect(moveRow(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveRow(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveRow(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  it('builds the request in order, keeping ids of existing aspects and trimming', () => {
    const drafts = [...draftsFrom([{ id: 'x', name: 'Disiplin', description: null, weight: 2 }]), { name: ' Inisiatif ', description: ' ', weight: 1 }];
    expect(aspectsRequest(drafts)).toEqual({ body: { items: [{ id: 'x', name: 'Disiplin', description: null, weight: 2 }, { name: 'Inisiatif', description: null, weight: 1 }] } });
  });

  it('says what is wrong before sending', () => {
    expect(aspectsRequest([])).toEqual({ error: 'Isi minimal satu aspek.' });
    expect(aspectsRequest([{ name: 'A', description: '', weight: 1 }])).toEqual({ error: 'Nama aspek minimal 2 huruf.' });
    expect(aspectsRequest([{ name: 'Rapi', description: '', weight: 1 }, { name: ' rapi', description: '', weight: 1 }])).toEqual({ error: 'Nama aspek "rapi" dipakai dua kali.' });
  });
});

describe('scores form (PKL-04)', () => {
  const aspects = [{ id: 'a', name: 'Disiplin' }, { id: 'b', name: 'Kerja sama' }];
  it('needs a whole number from 0 to 100 for every aspect', () => {
    expect(scoresRequest(aspects, { a: '90', b: '100' }, ' Baik ')).toEqual({ body: { scores: [{ aspectId: 'a', score: 90 }, { aspectId: 'b', score: 100 }], note: 'Baik' } });
    expect(scoresRequest(aspects, { a: '90' }, '')).toEqual({ error: 'Isi nilai Kerja sama dengan angka 0 sampai 100.' });
    expect(scoresRequest(aspects, { a: '101', b: '5' }, '')).toEqual({ error: 'Isi nilai Disiplin dengan angka 0 sampai 100.' });
    expect(scoresRequest(aspects, { a: '8,5', b: '5' }, '')).toEqual({ error: 'Isi nilai Disiplin dengan angka 0 sampai 100.' });
    expect(scoresRequest(aspects, { a: '0', b: '0' }, '')).toMatchObject({ body: { note: null } });
  });
});
