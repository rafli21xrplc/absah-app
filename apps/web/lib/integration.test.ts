import { describe, expect, it } from 'vitest';
import { anyPending, AUTO_OFF_NOTE, deliveryError, eventLabel, hookState, keyState, parseRate, toggle, webhookInput } from './integration';

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

  it('names the ping and the chosen events, and keeps an unknown type as it is', () => {
    expect(eventLabel('webhook.test')).toBe('Tes dari Absah');
    expect(eventLabel('leave.approved')).toBe('Izin siswa disetujui');
    expect(eventLabel('sesuatu.baru')).toBe('sesuatu.baru');
  });

  it('says why a call failed in words, and shows a code it does not know', () => {
    expect(deliveryError(null)).toBe('');
    expect(deliveryError('http_503')).toBe('Penerima menjawab 503.');
    expect(deliveryError('dns')).toBe('Nama alamat tidak ditemukan.');
    expect(deliveryError('network')).toBe('Tidak tersambung ke penerima.');
    expect(deliveryError('blocked_address')).toBe('Alamat mengarah ke jaringan dalam, jadi tidak dikirim.');
    expect(deliveryError('endpoint_off')).toBe('Alamat sedang dimatikan.');
    expect(deliveryError('aneh')).toBe('aneh');
  });

  it('keeps asking only while a call waits', () => {
    expect(anyPending([{ status: 'delivered' }, { status: 'failed' }])).toBe(false);
    expect(anyPending([{ status: 'delivered' }, { status: 'pending' }])).toBe(true);
    expect(anyPending([])).toBe(false);
  });

  it('tells an address the admin switched off from one Absah switched off, and says what to do', () => {
    expect(hookState({ active: true, disabledReason: null })).toBe('on');
    expect(hookState({ active: false, disabledReason: null })).toBe('off');
    expect(hookState({ active: false, disabledReason: 'too_many_failures' })).toBe('auto_off');
    expect(AUTO_OFF_NOTE).toBe('Absah berhenti mengirim karena 10 pengiriman terakhir gagal berturut-turut. Perbaiki penerimanya, lalu nyalakan lagi dan kirim tes.');
  });
});
