import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

test('Integrasi: admin membuat kunci API, kunci itu membaca presensi, dicabut ditolak; webhook ditambah, dimatikan, dihapus (PLT-09)', async ({ page }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMA Integrasi E2E', 'sma');
  await onboardAdmin(page, inviteUrl, email);

  // Without the capability the page says so and offers nothing.
  await page.goto('/integrasi');
  await expect(page.getByText(/API terbuka belum diaktifkan/)).toBeVisible();

  const enabled = await page.request.put('/api/v1/school/capabilities', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { values: { 'platform.openApi': true } },
  });
  expect(enabled.ok()).toBe(true);
  await page.goto('/integrasi');

  // A key is shown once; the API answers with it and refuses it once revoked.
  await page.getByLabel('Nama kunci').fill('Dasbor Dinas');
  await page.getByLabel('Batas permintaan per menit').fill('5');
  await page.getByRole('button', { name: 'Buat kunci' }).click();
  await expect(page.getByText('Batas permintaan antara 10 dan 600 per menit.')).toBeVisible();
  await page.getByLabel('Batas permintaan per menit').fill('120');
  await page.getByRole('button', { name: 'Buat kunci' }).click();
  await expect(page.getByText('Kunci "Dasbor Dinas" dibuat')).toBeVisible();
  const key = (await page.locator('code').first().textContent()) ?? '';
  expect(key).toMatch(/^abk_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);

  const read = (token: string) => page.request.get('/api/v1/open/attendance/daily', { headers: { authorization: `Bearer ${token}` } });
  const ok = await read(key);
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ items: [] });

  await page.getByRole('button', { name: 'Sudah saya simpan' }).click();
  await expect(page.getByText(key)).toHaveCount(0);
  await expect(page.getByText('Aktif').first()).toBeVisible();

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Cabut kunci Dasbor Dinas' }).click();
  await expect(page.getByText('Dicabut')).toBeVisible();
  expect((await read(key)).status()).toBe(401);

  // Webhook: the API refuses a private address, then keeps a public one by host only.
  await page.getByLabel('Alamat penerima').fill('https://localhost/in');
  await page.getByRole('button', { name: 'Tambah webhook' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'tidak bisa dijangkau dari internet' })).toBeVisible();

  await page.getByLabel('Alamat penerima').fill('https://hooks.e2e.example/absah?token=RAHASIA');
  await page.getByRole('button', { name: 'Tambah webhook' }).click();
  await expect(page.getByText('Rahasia penandatangan')).toBeVisible();
  await expect(page.locator('code', { hasText: /^whsec_/ })).toBeVisible();
  await page.getByRole('button', { name: 'Sudah saya simpan' }).click();
  await expect(page.getByText('https://hooks.e2e.example', { exact: true })).toBeVisible();
  await expect(page.getByText('token=RAHASIA')).toHaveCount(0);

  await page.getByRole('button', { name: 'Matikan https://hooks.e2e.example' }).click();
  await expect(page.getByText('Dimatikan')).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Hapus https://hooks.e2e.example' }).click();
  await expect(page.getByText('Belum ada webhook.')).toBeVisible();
});
