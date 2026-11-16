// Thin wrappers over Better Auth endpoints (/api/auth/*, proxied to absah-api). Messages are shown
// to users, so they are Indonesian and never echo what the server said about accounts.

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) };
}

export class AuthError extends Error {}

const failed = (status: number, fallback: string) =>
  new AuthError(status === 429 ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.' : fallback);

/** Email + password. Resolves to 'two_factor' when a TOTP code is needed next. */
export async function signInWithPassword(email: string, password: string): Promise<'done' | 'two_factor'> {
  const res = await post('/sign-in/email', { email, password });
  if (!res.ok) throw failed(res.status, 'Email atau kata sandi salah.');
  return (res.json as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect ? 'two_factor' : 'done';
}

export async function verifyTotp(code: string): Promise<void> {
  const res = await post('/two-factor/verify-totp', { code });
  if (!res.ok) throw failed(res.status, 'Kode tidak cocok. Periksa jam di HP lalu coba lagi.');
}

/** Starts TOTP enrollment; the user confirms with verifyTotp(code). */
export async function enableTwoFactor(password: string): Promise<{ secret: string; uri: string; backupCodes: string[] }> {
  const res = await post('/two-factor/enable', { password });
  if (!res.ok) throw failed(res.status, 'Kata sandi salah.');
  const body = res.json as { totpURI: string; backupCodes?: string[] };
  const secret = new URL(body.totpURI).searchParams.get('secret') ?? '';
  return { secret, uri: body.totpURI, backupCodes: body.backupCodes ?? [] };
}

export async function signOut(): Promise<void> {
  await post('/sign-out', {});
}
