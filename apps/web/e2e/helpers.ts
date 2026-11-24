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

/** Opens a release flag for one school, as the Absah team does (absah-api `release:flag`). */
export function releaseFlag(schoolId: string, flag: string): void {
  execFileSync('pnpm', ['-s', 'release:flag', '--flag', flag, '--school', schoolId], {
    cwd: API_SERVER_DIR,
    env: { ...process.env, ...API_ENV },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

/** Issues one month's Absah invoice now (absah-api `billing:issue`, instead of waiting for the 1st). */
export function issueInvoice(schoolId: string, month: string): void {
  execFileSync('pnpm', ['-s', 'billing:issue', '--school', schoolId, '--month', month], {
    cwd: API_SERVER_DIR,
    env: { ...process.env, ...API_ENV },
    encoding: 'utf8',
  });
}

/**
 * What the fake gateway posts when the money of a payment arrives: absah-api FakePaymentProvider
 * (charge ref "fake-<payment id>", x-absah-signature = sha256 HMAC of the raw body).
 */
export function fakeGatewayPaid(paymentId: string, amount: number): { body: string; headers: Record<string, string> } {
  const body = JSON.stringify({ events: [{ providerRef: `fake-${paymentId}`, providerTxnId: `e2e-${paymentId}`, status: 'paid', amount, at: new Date().toISOString() }] });
  const signature = `sha256=${createHmac('sha256', API_ENV.PAYMENT_WEBHOOK_SECRET ?? '').update(body).digest('hex')}`;
  return { body, headers: { 'content-type': 'application/json', 'x-absah-signature': signature } };
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
/** Accepts an email invitation and signs in (staff without TOTP land in their workspace). */
export async function acceptInvite(page: Page, inviteUrl: string, email: string) {
  await page.goto(inviteUrl);
  await page.getByLabel('Buat kata sandi').fill(PASSWORD);
  await page.getByRole('button', { name: 'Terima undangan' }).click();
  await page.getByRole('link', { name: 'Masuk sekarang' }).click();

  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByLabel('Kata sandi').fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  // Signed in once the app leaves /masuk (a page opened earlier would race the session cookie).
  await page.waitForURL((url) => !url.pathname.startsWith('/masuk'));
}

export async function onboardAdmin(page: Page, inviteUrl: string, email: string) {
  await acceptInvite(page, inviteUrl, email);

  // Admins must enroll TOTP before acting in a school.
  await expect(page).toHaveURL(/\/keamanan\/dua-langkah$/);
  await page.getByLabel('Kata sandi Anda').fill(PASSWORD);
  await page.getByRole('button', { name: 'Lanjut' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())?.trim() ?? '';
  await page.getByLabel('Kode 6 angka dari aplikasi').fill(totp(secret));
  await page.getByRole('button', { name: 'Aktifkan' }).click();

  await expect(page).toHaveURL(/\/setup$/);
}


export interface GateFixture {
  timezone: string;
  schoolDate: string;
  cards: { cardId: string; deviceId: string; deviceKey: string; studentId: string }[];
}

/**
 * Bound test phones for every active student (absah-api `gate:load-fixture`, dev only), with today's
 * device keys: what a real phone receives when its holder activates the card.
 */
export function gateFixture(schoolId: string): GateFixture {
  const out = execFileSync('pnpm', ['-s', 'gate:load-fixture', '--school', schoolId], {
    cwd: API_SERVER_DIR,
    env: { ...process.env, ...API_ENV },
    encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as GateFixture;
}

const uuidBytes = (uuid: string) => Buffer.from(uuid.replace(/-/g, ''), 'hex');

/** The QR text of a card at `ms`, as the phone makes it (@absah/contracts gate/card-token.ts, format A1). */
export function cardToken(card: GateFixture['cards'][number], ms: number): string {
  const window = Math.floor(ms / 1000 / 30);
  const mac = createHmac('sha256', Buffer.from(card.deviceKey, 'base64url')).update(`${card.cardId}:${window}`).digest().subarray(0, 16);
  return ['A1', Buffer.concat([uuidBytes(card.cardId), uuidBytes(card.deviceId)]).toString('base64url'), window.toString(36), mac.toString('base64url')].join('.');
}

/**
 * The action link of the school's newest WhatsApp message (absah-api `notify:last-link`, dev only):
 * what the parent would tap. The fake sender keeps messages inside the worker process.
 */
export function lastActionLink(schoolId: string): string | null {
  const out = execFileSync('pnpm', ['-s', 'notify:last-link', '--school', schoolId], {
    cwd: API_SERVER_DIR,
    env: { ...process.env, ...API_ENV },
    encoding: 'utf8',
  });
  const result = JSON.parse(out.trim().split('\n').at(-1) ?? 'null') as { link: string | null } | null;
  return result?.link ?? null;
}

/** The school's newest WhatsApp message (template and action link), like lastActionLink. */
export function lastMessage(schoolId: string): { templateCode: string; link: string | null } | null {
  const out = execFileSync('pnpm', ['-s', 'notify:last-link', '--school', schoolId], {
    cwd: API_SERVER_DIR,
    env: { ...process.env, ...API_ENV },
    encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').at(-1) ?? 'null') as { templateCode: string; link: string | null } | null;
}

/** The newest WhatsApp login code for a number (absah-api `auth:last-otp`, dev only). */
export function lastOtp(phoneE164: string): string | null {
  const out = execFileSync('pnpm', ['-s', 'auth:last-otp', '--phone', phoneE164], {
    cwd: API_SERVER_DIR,
    env: { ...process.env, ...API_ENV },
    encoding: 'utf8',
  });
  return (JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as { code: string | null }).code;
}

/** A parent or student logs in with WhatsApp OTP (number as typed, 08...) and lands on `next`. */
export async function otpLogin(page: Page, localPhone: string, next: string) {
  await page.goto(`/masuk/hp?lanjut=${encodeURIComponent(next)}`);
  await page.getByLabel('Nomor WhatsApp').fill(localPhone);
  await page.getByRole('button', { name: 'Kirim kode' }).click();
  await expect(page.getByLabel('Kode dari WhatsApp')).toBeVisible();
  const code = lastOtp(`+62${localPhone.replace(/^0/, '')}`);
  if (!code) throw new Error('no login code');
  await page.getByLabel('Kode dari WhatsApp').fill(code);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL((url) => url.pathname === next);
}

/** A 1x1 PNG: a photo for file inputs (the web turns it into a JPEG before upload). */
export const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

export type AbsentStatus = 'Telat' | 'Izin' | 'Sakit' | 'Alpa';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Opens a student's choice sheet and taps one reason: two taps, as a teacher does. */
export async function pickStatus(page: Page, name: string, status: AbsentStatus | 'Hadir'): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${escapeRe(name)}: `) }).click();
  const sheet = page.getByRole('dialog', { name: `Pilih kehadiran untuk ${name}` });
  await sheet.getByRole('button', { name: new RegExp(`^${status}:`) }).click();
  await sheet.waitFor({ state: 'hidden' });
}

/** "Semua hadir" (or "Sisanya hadir") when there is anyone left to mark, then the named exceptions. Nothing is sent. */
export async function markStudents(page: Page, exceptions: { name: string; status: AbsentStatus }[] = []): Promise<void> {
  const rest = page.getByRole('button', { name: /^(Semua hadir|Sisanya hadir)/ });
  await page.getByRole('button', { name: /: (Belum diisi|Hadir|Telat|Izin|Sakit|Alpa)\. Ketuk untuk mengubah\.$/ }).first().waitFor();
  if (await rest.count()) await rest.click();
  for (const e of exceptions) await pickStatus(page, e.name, e.status);
}

/**
 * From a complete screen: "Periksa dan kirim", then "Kirim presensi" in the check sheet. Without signal the same two taps are
 * "Simpan presensi di HP" and "Simpan di HP" (U5). Does not wait for the answer.
 */
export async function sendReview(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Periksa dan kirim|Simpan presensi di HP)$/ }).click();
  await page.getByRole('dialog', { name: 'Periksa sebelum kirim' }).getByRole('button', { name: /^(Kirim presensi|Simpan di HP)$/ }).click();
}

/** Fills the open session the way a teacher does, sends it, and waits for "Presensi X terkirim". */
export async function fillSession(page: Page, exceptions: { name: string; status: AbsentStatus }[] = []): Promise<void> {
  await markStudents(page, exceptions);
  await sendReview(page);
  await page.getByRole('heading', { name: /^Presensi .+ terkirim$/ }).waitFor();
}
