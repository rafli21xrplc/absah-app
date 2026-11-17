import { defineConfig, devices } from '@playwright/test';
import { API_ENV, API_PORT, API_SERVER_DIR, KIOSK_DIR, KIOSK_PORT, KIOSK_URL, WEB_PORT, WEB_URL } from './e2e/env';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    locale: 'id-ID',
    // A fake camera for the kiosk's photo of an unlisted penjemput (contexts grant 'camera' themselves).
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  },
  projects: [
    { name: 'laptop', use: { ...devices['Desktop Chrome'] } },
    { name: 'hp', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // HTTP and worker (outbox consumers parse imports).
      command: 'pnpm exec concurrently -k -n http,worker "tsx src/entrypoints/http.ts" "tsx src/entrypoints/worker.ts"',
      cwd: API_SERVER_DIR,
      env: API_ENV,
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm exec next dev --port ${WEB_PORT}`,
      env: { API_URL: `http://localhost:${API_PORT}`, NEXT_TELEMETRY_DISABLED: '1' },
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // The kiosk as it ships: a static export (service worker included) talking to the API cross-origin.
      command: `pnpm -C ${KIOSK_DIR} build && node e2e/static-server.ts ${KIOSK_DIR}/out ${KIOSK_PORT}`,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`, NEXT_TELEMETRY_DISABLED: '1' },
      url: KIOSK_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
