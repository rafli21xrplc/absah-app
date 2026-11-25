import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthError, failure, safeNext, signInWithPassword } from './auth';
import { AUTH } from './auth-config';

const headers = (h: Record<string, string> = {}) => new Headers(h);

describe('failure: what a refusal means for the screen', () => {
  it('a wrong password is "invalid" and never says which part was wrong', () => {
    const err = failure({ status: 401, json: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' }, headers: headers() }, 'Email atau kata sandi belum cocok.');
    expect(err.kind).toBe('invalid');
    expect(err.message).toBe('Email atau kata sandi belum cocok.');
    expect(err.detail.attemptsLeft).toBeUndefined();
  });

  it('passes on the tries left when the server says them', () => {
    expect(failure({ status: 401, json: { attemptsLeft: 3 }, headers: headers() }, 'x').detail.attemptsLeft).toBe(3);
  });

  it('too many tries (429) is "locked" and opens at the time the server named', () => {
    const before = Date.now();
    const err = failure({ status: 429, json: null, headers: headers({ 'x-retry-after': '90' }) }, 'x');
    expect(err.kind).toBe('locked');
    const at = err.detail.unlockAt?.getTime() ?? 0;
    expect(at).toBeGreaterThanOrEqual(before + 90_000);
    expect(at).toBeLessThan(before + 91_000 + 1000);
  });

  it('a lock without a time opens after the configured lock minutes', () => {
    const before = Date.now();
    const at = failure({ status: 429, json: null, headers: headers() }, 'x').detail.unlockAt?.getTime() ?? 0;
    expect(Math.round((at - before) / 60_000)).toBe(AUTH.lockMinutes);
  });

  it('an ACCOUNT_LOCKED answer carries its own opening time', () => {
    const err = failure({ status: 403, json: { code: 'ACCOUNT_LOCKED', unlockAt: '2026-11-25T09:52:00.000Z' }, headers: headers() }, 'x');
    expect(err.kind).toBe('locked');
    expect(err.detail.unlockAt?.toISOString()).toBe('2026-11-25T09:52:00.000Z');
  });

  it('a server fault is not blamed on the person', () => {
    expect(failure({ status: 500, json: null, headers: headers() }, 'x').kind).toBe('unknown');
  });
});

describe('signInWithPassword', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends rememberMe (off unless asked) and reads the name and the second step', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ twoFactorRedirect: true, user: { name: 'Pak Hendra' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await signInWithPassword('a@b.id', 'rahasia-123')).toEqual({ next: 'two_factor', name: 'Pak Hendra' });
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({ email: 'a@b.id', password: 'rahasia-123', rememberMe: false });
    await signInWithPassword('a@b.id', 'rahasia-123', { remember: true });
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)).rememberMe).toBe(true);
  });

  it('no answer at all is "offline" when the device says so, otherwise "unreachable"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    vi.stubGlobal('navigator', { onLine: false });
    await expect(signInWithPassword('a@b.id', 'x')).rejects.toMatchObject({ kind: 'offline' });
    vi.stubGlobal('navigator', { onLine: true });
    const err: unknown = await signInWithPassword('a@b.id', 'x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toMatchObject({ kind: 'unreachable' });
  });
});

describe('safeNext', () => {
  it('keeps same-site paths only', () => {
    expect(safeNext('/portal')).toBe('/portal');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext(null, '/portal')).toBe('/portal');
  });
});
