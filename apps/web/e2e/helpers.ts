import { expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { API_ENV, API_SERVER_DIR } from './env';

/** Creates a school with an admin invitation through absah-api's ops CLI (school:create). */
export function createSchool(name: string, level?: 'sd' | 'smp' | 'sma' | 'smk'): { schoolId: string; inviteUrl: string; email: string } {
  const email = `e2e-${randomUUID()}@test.local`;
  const out = execFileSync(
    'pnpm',
    ['-s', 'school:create', '--name', name, '--admin-name', 'Admin E2E', '--admin-email', email, '--json', ...(level ? ['--level', level] : [])],
    { cwd: API_SERVER_DIR, env: { ...process.env, ...API_ENV }, encoding: 'utf8' },
  );
  const result = JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as { schoolId: string; inviteUrl: string };
  return { ...result, email };
}

/** Today's attendance sessions now, instead of waiting for the 05.00 job (forced: works on weekends). */
export function generateSessions(schoolId: string): void {
  execFileSync('pnpm', ['-s', 'attendance:generate', '--school', schoolId, '--force', '--json'], {
    cwd: API_SERVER_DIR,
    env: { ...process.env, ...API_ENV },
    encoding: 'utf8',
  });
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value === -1) throw new Error('invalid base32');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits), what an authenticator app computes from the shown key. */
export function totp(secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, '0');
}

export const randomDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

const PASSWORD = 'kata-sandi-e2e-123';

/** Invitation -> password -> sign in -> TOTP enrollment -> lands in the wizard. */
export async function onboardAdmin(page: Page, inviteUrl: string, email: string) {
  await page.goto(inviteUrl);
  await page.getByLabel('Buat kata sandi').fill(PASSWORD);
  await page.getByRole('button', { name: 'Terima undangan' }).click();
  await page.getByRole('link', { name: 'Masuk sekarang' }).click();

  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Kata sandi').fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();

  // Admins must enroll TOTP before acting in a school.
  await expect(page).toHaveURL(/\/keamanan\/dua-langkah$/);
  await page.getByLabel('Kata sandi Anda').fill(PASSWORD);
  await page.getByRole('button', { name: 'Lanjut' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())?.trim() ?? '';
  await page.getByLabel('Kode 6 angka dari aplikasi').fill(totp(secret));
  await page.getByRole('button', { name: 'Aktifkan' }).click();

  await expect(page).toHaveURL(/\/setup$/);
}

