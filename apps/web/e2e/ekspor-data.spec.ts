import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, onboardAdmin } from './helpers';

test('Ekspor data sekolah: admin meminta, pekerja menyelesaikan, berkas ZIP bisa diunduh (PLT-11)', async ({ page, context }) => {
  const { inviteUrl, email } = createSchool('SD Negeri Ekspor E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  // Open it directly: the home page sends an admin of a school still in setup to /setup.
  await page.goto('/ekspor-data');
  await expect(page.getByText('Belum ada ekspor.')).toBeVisible();
  await page.getByRole('button', { name: 'Minta ekspor' }).click();
  await expect(page.getByText(/Ekspor diminta/)).toBeVisible();
  await expect(page.getByText('Sedang dibuat').first()).toBeVisible();

  // The worker builds it; the page polls by itself.
  await expect(page.getByText('Siap diunduh')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/\d+ tabel/)).toBeVisible();

  // "Unduh" opens a tab (a download never navigates it) and the link is what the API answered.
  const answered = page.waitForResponse((r) => r.url().endsWith('/download') && r.request().method() === 'GET');
  await page.getByRole('button', { name: /^Unduh data-sekolah-/ }).click();
  const { url } = (await (await answered).json()) as { url: string };
  for (const tab of context.pages()) if (tab !== page) await tab.close().catch(() => undefined);

  const file = await page.request.get(url);
  expect(file.status()).toBe(200);
  const body = await file.body();
  expect(body.subarray(0, 2).toString('latin1')).toBe('PK'); // a ZIP
  expect(body.includes(Buffer.from('tabel/students.csv'))).toBe(true);
  expect(body.includes(Buffer.from('README.txt'))).toBe(true);

  // A fresh request is allowed once the first one is done.
  await expect(page.getByRole('button', { name: 'Minta ekspor' })).toBeEnabled();
});
