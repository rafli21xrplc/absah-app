import { describe, expect, it } from 'vitest';
import { answerRequest, answerText, inviteSummary, percentText, tokenFromHash } from './tracer';

describe('tracer helpers (PKL-05)', () => {
  it('writes the BMW share with a decimal comma, and a dash before anyone answered', () => {
    expect(percentText(66.7)).toBe('66,7%');
    expect(percentText(100)).toBe('100,0%');
    expect(percentText(null)).toBe('–');
  });

  it('describes an answer, or that there is none', () => {
    expect(answerText({ response: null })).toBe('Belum mengisi');
    const response = { status: 'bekerja', organization: 'PT Maju', position: 'Teknisi', source: 'bkk', answeredAt: '2027-01-01T00:00:00Z' } as const;
    expect(answerText({ response })).toBe('Bekerja: PT Maju · Teknisi');
    expect(answerText({ response: { ...response, status: 'belum', organization: null, position: null } })).toBe('Belum bekerja atau melanjutkan');
  });

  it('builds the answer: BMW needs a name, "belum" sends none', () => {
    expect(answerRequest('', '', '')).toEqual({ error: 'Pilih status Anda.' });
    expect(answerRequest('melanjutkan', '  ', '')).toEqual({ error: 'Isi nama kampus.' });
    expect(answerRequest('wirausaha', ' Toko Andi ', ' ')).toEqual({ body: { status: 'wirausaha', organization: 'Toko Andi', position: null } });
    expect(answerRequest('belum', 'diabaikan', 'x')).toEqual({ body: { status: 'belum' } });
  });

  it('sums up an invitation round', () => {
    expect(inviteSummary({ queued: 2, withoutPhone: 1, alreadyAnswered: 1 })).toBe('2 undangan dikirim lewat WhatsApp, 1 sudah mengisi, 1 tanpa nomor.');
    expect(inviteSummary({ queued: 3, withoutPhone: 0, alreadyAnswered: 0 })).toBe('3 undangan dikirim lewat WhatsApp.');
    expect(inviteSummary({ queued: 0, withoutPhone: 0, alreadyAnswered: 0 })).toBe('Tidak ada alumni yang dipilih.');
  });

  it('takes a link token from the fragment only when it looks like one', () => {
    const id = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
    const secret = 'A'.repeat(43);
    expect(tokenFromHash(`#${id}.${secret}`)).toBe(`${id}.${secret}`);
    expect(tokenFromHash('')).toBeNull();
    expect(tokenFromHash('#acak')).toBeNull();
  });
});
