import path from 'node:path';

// End-to-end runs the real absah-api (checked out next to this repo, or E2E_API_DIR) against a
// disposable Postgres database. Never point E2E_DATABASE_URL at a shared or production database.
export const WEB_PORT = 3710;
export const API_PORT = 4710;
export const WEB_URL = `http://localhost:${WEB_PORT}`;
export const KIOSK_PORT = 3711;
export const KIOSK_URL = `http://localhost:${KIOSK_PORT}`;
export const KIOSK_DIR = path.resolve(import.meta.dirname, '../../kiosk');
export const API_DIR = path.resolve(process.env.E2E_API_DIR ?? path.join(import.meta.dirname, '../../../../absah-api'));
export const API_SERVER_DIR = path.join(API_DIR, 'apps/server');
export const DAPODIK_FIXTURES = path.join(API_DIR, 'packages/db/fixtures/dapodik');

/** Test-only secrets, same spirit as absah-api's test harness. */
export const API_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  LOG_LEVEL: 'warn',
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgresql://localhost:5432/absah_test',
  DATABASE_URL_DIRECT: process.env.E2E_DATABASE_URL ?? 'postgresql://localhost:5432/absah_test',
  BETTER_AUTH_SECRET: 'Zp4vQ9xK2mT7wR1nB8cY5hL3sD6fJ0gA', // fixed, test only
  BETTER_AUTH_URL: WEB_URL,
  TRUSTED_ORIGINS: WEB_URL,
  KIOSK_ORIGINS: KIOSK_URL,
  AUTH_RATE_LIMIT: 'false',
  ENCRYPTION_KEYS: `e2e1:${Buffer.alloc(32, 9).toString('base64')}`,
  ENCRYPTION_ACTIVE_KEY_ID: 'e2e1',
  HASH_KEY: 'e2e-hash-key-e2e-hash-key-e2e-hash-key-00',
  // Fake gateway (never in production); e2e signs its webhooks with this secret.
  PAYMENT_PROVIDER: 'fake',
  PAYMENT_WEBHOOK_SECRET: 'e2e-payment-webhook-secret',
};
