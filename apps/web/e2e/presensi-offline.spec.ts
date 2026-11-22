import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, generateSessions, onboardAdmin } from './helpers';

// The app's own server stays reachable here (the service worker that keeps the page shells is production-only);
// what drops is the API, which is what "no signal" means for the session screens (PRS-08).
test('Guru mengisi dua sesi tanpa sinyal, lalu terkirim otomatis saat sinyal kembali', async ({ page }) => {
  const { schoolId, inviteUrl, email } = createSchool('SD Negeri Offline E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);

  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  await page.goto('/jadwal');
  for (const rombel of ['VII A', 'VII B']) {
    await page.getByLabel(`Wali kelas ${rombel}`).selectOption({ label: 'Admin E2E' });
    await expect(page.getByText(`Wali kelas ${rombel}: Admin E2E.`)).toBeVisible();
  }
  generateSessions(schoolId);

  // With signal: Hari ini keeps both sessions on the phone.
  await page.goto('/hari-ini');
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('Belum diisi');
  await expect(page.getByRole('link', { name: /VII B/ })).toContainText('Belum diisi');
  await page.waitForLoadState('networkidle');

  await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));

  await page.getByRole('link', { name: /VII A/ }).click();
  await expect(page.getByRole('heading', { name: 'VII A' })).toBeVisible();
  await expect(page.getByText(/Tanpa sinyal: daftar siswa dari salinan di HP/)).toBeVisible();
  await page.getByRole('button', { name: 'ADITYA PRATAMA: Alpa' }).click();
  await page.getByRole('button', { name: /^Kirim: \d+ hadir, 1 tidak hadir$/ }).click();
  await expect(page.getByText('Tidak ada sinyal. Presensi disimpan di HP')).toBeVisible();
  await expect(page.getByText('1 sesi menunggu dikirim.')).toBeVisible();

  await page.getByRole('link', { name: '← Hari ini' }).click();
  await expect(page.getByText(/Tanpa sinyal: daftar dari salinan di HP/)).toBeVisible();
  await page.getByRole('link', { name: /VII B/ }).click();
  await expect(page.getByRole('heading', { name: 'VII B' })).toBeVisible();
  await page.getByRole('button', { name: /: Sakit$/ }).first().click();
  await page.getByRole('button', { name: /^Kirim: \d+ hadir, 1 tidak hadir$/ }).click();
  await expect(page.getByText('2 sesi menunggu dikirim.')).toBeVisible();

  // Signal is back: nothing to press, the retry (every 15 s) sends both ("Kirim sekarang" only hurries it).
  await page.unroute('**/api/v1/**');
  await expect(page.getByText('VII A: presensi terkirim.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('VII B: presensi terkirim.')).toBeVisible();
  await expect(page.getByText(/sesi menunggu dikirim/)).toHaveCount(0);

  await page.getByRole('link', { name: '← Hari ini' }).click();
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('Sudah diisi');
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('1 tidak hadir');
  await expect(page.getByRole('link', { name: /VII B/ })).toContainText('Sudah diisi');
});
