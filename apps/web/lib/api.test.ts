import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getHealth } from './api';
import { LEVEL_OPTIONS } from './levels';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))));
}

describe('api client uses @absah/contracts from absah-api', () => {
  it('parses a valid health response', async () => {
    stubFetch(200, { status: 'ok', service: 'absah-api', version: '0.0.0', time: new Date().toISOString() });
    await expect(getHealth()).resolves.toMatchObject({ status: 'ok' });
  });

  it('turns the error contract into ApiError with a stable code', async () => {
    stubFetch(404, { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.', requestId: 'r1' });
    await expect(getHealth()).rejects.toMatchObject({ status: 404, body: { code: 'NOT_FOUND' } });
    await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a response that breaks the contract', async () => {
    stubFetch(200, { status: 'down' });
    await expect(getHealth()).rejects.toThrow();
  });
});

describe('levels come from @absah/capabilities', () => {
  it('labels all four levels', () => {
    expect(LEVEL_OPTIONS.map((o) => o.label)).toEqual(['SD/MI', 'SMP/MTs', 'SMA/MA', 'SMK/MAK']);
  });
});
