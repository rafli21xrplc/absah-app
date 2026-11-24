import { execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { API_ENV, API_SERVER_DIR } from './env';

/** Creates a school with an admin invitation through absah-api's ops CLI (school:create). */
export function createSchool(name: string): { schoolId: string; inviteUrl: string; email: string } {
  const email = `e2e-${randomUUID()}@test.local`;
  const out = execFileSync(
    'pnpm',
    ['-s', 'school:create', '--name', name, '--admin-name', 'Admin E2E', '--admin-email', email, '--json'],
    { cwd: API_SERVER_DIR, env: { ...process.env, ...API_ENV }, encoding: 'utf8' },
  );
  const result = JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as { schoolId: string; inviteUrl: string };
  return { ...result, email };
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
