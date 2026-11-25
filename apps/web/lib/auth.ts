// Thin wrappers over Better Auth endpoints (/api/auth/*, proxied to absah-api). Messages are shown
// to users, so they are Indonesian and never echo what the server said about accounts.
import { AUTH } from './auth-config';

export type AuthFailure = 'invalid' | 'locked' | 'offline' | 'unreachable' | 'unknown';

export interface AuthDetail {
  /** When a locked account opens again, if the server said. */
  unlockAt?: Date;
  /** Wrong tries left before the lock, if the server said (it does not today). */
  attemptsLeft?: number;
}

/** A failed sign-in step. `kind` is what the screen decides on; `message` is a safe sentence for a plain line of text. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly kind: AuthFailure = 'unknown',
    readonly detail: AuthDetail = {},
  ) {
    super(message);
  }
}

interface Reply {
  ok: boolean;
  status: number;
  json: unknown;
  headers: Headers;
}

async function post(path: string, body: unknown): Promise<Reply> {
  let res: Response;
  try {
    res = await fetch(`/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    // No answer at all: the device has no signal, or the server cannot be reached.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new AuthError('Tidak bisa terhubung. Periksa internet lalu coba lagi.', offline ? 'offline' : 'unreachable');
  }
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null), headers: res.headers };
}

const field = (json: unknown, key: string): unknown => (json && typeof json === 'object' ? (json as Record<string, unknown>)[key] : undefined);

/** Seconds from a Retry-After style header (Better Auth sends X-Retry-After), or undefined. */
function retrySeconds(headers: Headers): number | undefined {
  const raw = headers.get('retry-after') ?? headers.get('x-retry-after');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * What a refusal means for the screen. 429 (too many tries) and an ACCOUNT_LOCKED answer are "locked" with the time it opens;
 * any other refusal is "invalid" and never says which of email or password was wrong.
 */
export function failure(res: Pick<Reply, 'status' | 'json' | 'headers'>, wording: string): AuthError {
  const code = field(res.json, 'code');
  if (res.status === 429 || code === 'ACCOUNT_LOCKED') {
    const stated = field(res.json, 'unlockAt');
    const seconds = retrySeconds(res.headers) ?? AUTH.lockMinutes * 60;
    const at = typeof stated === 'string' && !Number.isNaN(Date.parse(stated)) ? new Date(stated) : new Date(Date.now() + seconds * 1000);
    return new AuthError('Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.', 'locked', { unlockAt: at });
  }
  if (res.status >= 500) return new AuthError('Belum berhasil. Coba lagi sebentar lagi.', 'unknown');
  const left = field(res.json, 'attemptsLeft');
  return new AuthError(wording, 'invalid', typeof left === 'number' ? { attemptsLeft: left } : {});
}

/** Only same-site paths, so ?lanjut= cannot send people elsewhere. */
export function safeNext(value: string | null, fallback = '/'): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

export interface SignedIn {
  next: 'done' | 'two_factor';
  /** The person's name when the server sends it, for "Selamat datang". */
  name?: string;
}

/** Email + password. `remember` keeps the session after the browser closes. `next: 'two_factor'` means a code is needed next. */
export async function signInWithPassword(email: string, password: string, options: { remember?: boolean } = {}): Promise<SignedIn> {
  const res = await post('/sign-in/email', { email, password, rememberMe: options.remember ?? false });
  if (!res.ok) throw failure(res, 'Email atau kata sandi belum cocok.');
  const name = field(field(res.json, 'user'), 'name');
  return { next: field(res.json, 'twoFactorRedirect') ? 'two_factor' : 'done', name: typeof name === 'string' ? name : undefined };
}

export async function verifyTotp(code: string): Promise<void> {
  const res = await post('/two-factor/verify-totp', { code });
  if (!res.ok) throw failure(res, 'Kode tidak cocok. Periksa jam di HP lalu coba lagi.');
}

/** Starts TOTP enrollment; the user confirms with verifyTotp(code). */
export async function enableTwoFactor(password: string): Promise<{ secret: string; uri: string; backupCodes: string[] }> {
  const res = await post('/two-factor/enable', { password });
  if (!res.ok) throw failure(res, 'Kata sandi salah.');
  const body = res.json as { totpURI: string; backupCodes?: string[] };
  const secret = new URL(body.totpURI).searchParams.get('secret') ?? '';
  return { secret, uri: body.totpURI, backupCodes: body.backupCodes ?? [] };
}

/** WhatsApp OTP (siswa, orang tua). The server answers the same whether or not the number has an account. */
export async function sendPhoneOtp(phoneNumber: string): Promise<void> {
  const res = await post('/phone-number/send-otp', { phoneNumber });
  if (!res.ok) throw failure(res, 'Kode tidak bisa dikirim. Periksa nomor lalu coba lagi.');
}

export async function verifyPhoneOtp(phoneNumber: string, code: string): Promise<void> {
  const res = await post('/phone-number/verify', { phoneNumber, code });
  if (!res.ok) throw failure(res, 'Kode salah atau sudah kedaluwarsa. Minta kode baru.');
}

/** "0812-3456-7890", "62812..." or "+62 812..." -> "+628123456789"; other input is returned trimmed. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('62')) return `+${digits}`;
  if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
  return digits;
}

export async function signOut(): Promise<void> {
  await post('/sign-out', {});
}
