import { expect, test } from '@playwright/test';
import { createSchool } from './helpers';

test('Lapor TPPK: laporan anonim tanpa login, kode lacak tampil sekali, status bisa dilacak', async ({ browser }) => {
  const { schoolId } = createSchool('SMP Lapor E2E', 'smp');

  // A student on a phone, not signed in, from the QR poster.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/lapor?s=${schoolId}`);
  await expect(page.getByRole('heading', { name: 'Lapor ke TPPK' })).toBeVisible();
  await expect(page.getByText('SMP Lapor E2E')).toBeVisible();

  await page.getByRole('button', { name: 'Kirim laporan' }).click();
  await expect(page.getByText('Pilih jenis kejadian.')).toBeVisible();

  await page.getByLabel('Perundungan').check();
  await page.getByLabel('Ceritakan kejadiannya').fill('Saya diejek terus di grup kelas dan tidak diajak bermain sejak awal semester.');
  await page.getByLabel('Saya adalah').selectOption({ label: 'Siswa' });
  await expect(page.getByLabel('Kirim tanpa nama')).toBeChecked();
  await page.getByRole('button', { name: 'Kirim laporan' }).click();

  await expect(page.getByRole('heading', { name: 'Laporan Anda sudah diterima' })).toBeVisible();
  const code = ((await page.getByTestId('tracking-code').textContent()) ?? '').trim();
  expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);

  await page.getByRole('link', { name: 'Lacak laporan' }).click();
  await page.getByLabel('Kode lacak').fill('ZZZZZ-ZZZZZ');
  await page.getByRole('button', { name: 'Lihat status' }).click();
  await expect(page.getByText('Kode lacak tidak ditemukan.')).toBeVisible();
  await page.getByLabel('Kode lacak').fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Lihat status' }).click();
  await expect(page.getByRole('status', { name: 'Status laporan' })).toContainText('Diterima');

  // A wrong school id in the poster link says the channel is not available.
  await page.goto('/lapor?s=bukan-sekolah');
  await expect(page.getByRole('heading', { name: 'Kanal lapor tidak tersedia' })).toBeVisible();
  await context.close();
});
