import { describe, expect, it } from 'vitest';
import { keyState, parseRate, toggle, webhookInput } from './integration';

describe('integration helpers (PLT-09)', () => {
  it('names a key by what happened to it, revoked first', () => {
    expect(keyState({ revokedAt: '2027-01-01T00:00:00Z', lastUsedAt: '2026-12-01T00:00:00Z' })).toBe('revoked');
    expect(keyState({ revokedAt: null, lastUsedAt: null })).toBe('unused');
    expect(keyState({ revokedAt: null, lastUsedAt: '2026-12-01T00:00:00Z' })).toBe('used');
  });

  it('toggles an item in a list without touching the others', () => {
    expect(toggle(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('accepts a whole number of requests within the API range, and says why otherwise', () => {
    expect(parseRate(' 120 ')).toEqual({ rate: 120 });
    expect(parseRate('10')).toEqual({ rate: 10 });
    expect(parseRate('600')).toEqual({ rate: 600 });
    expect(parseRate('9')).toEqual({ error: 'Batas permintaan antara 10 dan 600 per menit.' });
    expect(parseRate('601')).toEqual({ error: 'Batas permintaan antara 10 dan 600 per menit.' });
    expect(parseRate('1,5')).toEqual({ error: 'Isi batas permintaan dengan angka.' });
    expect(parseRate('')).toEqual({ error: 'Isi batas permintaan dengan angka.' });
  });

  it('needs https and at least one event', () => {
    expect(webhookInput('  https://hooks.example/in ', ['leave.approved'])).toEqual({ url: 'https://hooks.example/in', events: ['leave.approved'] });
    expect(webhookInput('http://hooks.example/in', ['leave.approved'])).toEqual({ error: 'Alamat harus diawali https://.' });
    expect(webhookInput('hooks.example', ['leave.approved'])).toEqual({ error: 'Alamat harus diawali https://.' });
    expect(webhookInput('https://hooks.example/in', [])).toEqual({ error: 'Pilih minimal satu kejadian.' });
    expect(webhookInput(`https://h.example/${'a'.repeat(500)}`, ['leave.approved'])).toEqual({ error: 'Alamat terlalu panjang.' });
  });
});
