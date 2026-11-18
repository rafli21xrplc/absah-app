import { describe, expect, it, vi } from 'vitest';
import { KioskApiError, type KioskApi } from './kiosk-api';
import { EMPTY_FORM, loadHosts, newAttempt, registerVisit, validateVisitor, visitorError } from './visitors';

const form = { name: ' Pak Hendra ', organization: ' ', purpose: ' Monitoring BOS ', hostUserId: '' };
const visitor = { id: crypto.randomUUID(), schoolDate: '2026-11-17', name: 'Pak Hendra', organization: null, purpose: 'Monitoring BOS', host: null, arrivedAt: '2026-11-17T01:00:00.000Z', leftAt: null, hasPhoto: false };
const photo = new Blob(['jpeg!'], { type: 'image/jpeg' });
const presigned = { photoId: crypto.randomUUID(), upload: { url: 'https://api.test/put', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: '2026-11-17T01:05:00.000Z' } };

/** A fake kiosk API that answers by path and records the calls. */
function fakeApi(answers: Record<string, unknown>) {
  const calls: { path: string; body: unknown; key?: string }[] = [];
  const api = (async (path: string, contract: { parse(d: unknown): unknown }, call: { body?: unknown; idempotencyKey?: string } = {}) => {
    calls.push({ path, body: call.body, key: call.idempotencyKey });
    return contract.parse(answers[path]);
  }) as KioskApi;
  return { api, calls };
}

describe('validateVisitor', () => {
  it('asks for a name and a purpose, in plain words', () => {
    expect(validateVisitor(EMPTY_FORM)).toBe('Tulis nama Anda.');
    expect(validateVisitor({ ...EMPTY_FORM, name: 'Sari' })).toBe('Tulis tujuan kunjungan.');
    expect(validateVisitor({ ...EMPTY_FORM, name: 'Sari', purpose: 'Antar paket' })).toBeNull();
    expect(validateVisitor({ ...EMPTY_FORM, name: 'Sari', purpose: 'x'.repeat(201) })).toBe('Tujuan terlalu panjang.');
  });
});

describe('registerVisit', () => {
  it('sends the trimmed visit without empty optional fields', async () => {
    const { api, calls } = fakeApi({ '/kiosk/visitors': visitor });
    const attempt = newAttempt();
    await registerVisit({ api, token: 't' }, form, null, attempt);
    expect(calls).toEqual([{ path: '/kiosk/visitors', key: attempt.submitKey, body: { clientEventId: attempt.clientEventId, name: 'Pak Hendra', purpose: 'Monitoring BOS' } }]);
  });

  it('uploads the photo first and names it in the visit, with the host', async () => {
    const { api, calls } = fakeApi({ '/kiosk/visitor-photos': presigned, '/kiosk/visitors': visitor });
    const put = vi.fn(async () => new Response(null, { status: 200 }));
    const hostUserId = crypto.randomUUID();
    await registerVisit({ api, token: 't', put }, { ...form, hostUserId }, photo, newAttempt());
    expect(calls.map((c) => c.path)).toEqual(['/kiosk/visitor-photos', '/kiosk/visitors']);
    expect(calls[0]?.body).toEqual({ fileSize: photo.size, contentType: 'image/jpeg' });
    expect(put).toHaveBeenCalledWith('https://api.test/put', { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: photo });
    expect(calls[1]?.body).toMatchObject({ photoId: presigned.photoId, hostUserId });
  });

  it('keeps the same ids when the visit is resent after a dropped connection, and uploads the photo once', async () => {
    const { api, calls } = fakeApi({ '/kiosk/visitor-photos': presigned, '/kiosk/visitors': visitor });
    const put = vi.fn(async () => new Response(null, { status: 200 }));
    const attempt = newAttempt();
    let drop = true;
    const flaky = (async (path: string, contract: { parse(d: unknown): unknown }, call: object) => {
      if (path === '/kiosk/visitors' && drop) {
        drop = false;
        throw new TypeError('Failed to fetch');
      }
      return api(path, contract as never, call);
    }) as KioskApi;
    await expect(registerVisit({ api: flaky, token: 't', put }, form, photo, attempt)).rejects.toBeInstanceOf(TypeError);
    await registerVisit({ api: flaky, token: 't', put }, form, photo, attempt);
    expect(put).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.path === '/kiosk/visitor-photos')).toHaveLength(1);
    expect(calls.filter((c) => c.path === '/kiosk/visitors').map((c) => c.key)).toEqual([attempt.submitKey]);
  });

  it('asks for a fresh upload link after a refused upload', async () => {
    const { api, calls } = fakeApi({ '/kiosk/visitor-photos': presigned, '/kiosk/visitors': visitor });
    const put = vi.fn().mockResolvedValueOnce(new Response(null, { status: 403 })).mockResolvedValue(new Response(null, { status: 200 }));
    const attempt = newAttempt();
    const firstKey = attempt.photoKey;
    await expect(registerVisit({ api, token: 't', put }, form, photo, attempt)).rejects.toThrow('upload_403');
    await registerVisit({ api, token: 't', put }, form, photo, attempt);
    const photoCalls = calls.filter((c) => c.path === '/kiosk/visitor-photos');
    expect(photoCalls).toHaveLength(2);
    expect(photoCalls[0]?.key).toBe(firstKey);
    expect(photoCalls[1]?.key).not.toBe(firstKey);
  });

  it('refuses an incomplete form before any call', async () => {
    const { api, calls } = fakeApi({});
    await expect(registerVisit({ api, token: 't' }, EMPTY_FORM, null, newAttempt())).rejects.toThrow('Tulis nama Anda.');
    expect(calls).toEqual([]);
  });
});

describe('loadHosts and visitorError', () => {
  it('treats 404 as "this school has no guest book" and passes other errors on', async () => {
    const off = (async () => {
      throw new KioskApiError(404, 'CAPABILITY_DISABLED', 'Fitur tidak aktif.');
    }) as KioskApi;
    expect(await loadHosts(off, 't')).toBeNull();
    const down = (async () => {
      throw new TypeError('offline');
    }) as KioskApi;
    await expect(loadHosts(down, 't')).rejects.toBeInstanceOf(TypeError);
    const ok = fakeApi({ '/kiosk/visitor-hosts': { items: [{ id: crypto.randomUUID(), name: 'Bu Ani' }] } });
    expect(await loadHosts(ok.api, 't')).toMatchObject([{ name: 'Bu Ani' }]);
  });

  it('explains failures in plain words', () => {
    expect(visitorError(new TypeError('x'))).toContain('internet');
    expect(visitorError(new KioskApiError(400, 'VALIDATION_FAILED', 'Tulis tujuan kunjungan.'))).toBe('Tulis tujuan kunjungan.');
    expect(visitorError(new KioskApiError(500, 'INTERNAL', 'x'))).toContain('guru piket');
  });
});
