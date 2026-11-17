import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, generateSessions, onboardAdmin } from './helpers';

test('Rekap: alpa hari ini masuk rekap rombel dan siswa, ekspor e-Rapor dibuat worker, pengisian sesi', async ({ page }) => {
  test.slow(); // onboarding, import, a session and the worker building the file
  const { schoolId, inviteUrl, email } = createSchool('SD Negeri Rekap E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  await page.goto('/jadwal');
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();

  generateSessions(schoolId);
  await page.goto('/hari-ini');
  await page.getByRole('link', { name: /VII A/ }).click();
  await page.getByRole('button', { name: 'ADITYA PRATAMA: Alpa' }).click();
  await page.getByRole('button', { name: 'Kirim: 3 hadir, 1 tidak hadir' }).click();
  await expect(page.getByText('Presensi tersimpan.')).toBeVisible();

  // Rekap per rombel: the current semester by default.
  await page.goto('/');
  await page.getByRole('link', { name: 'Rekap kehadiran' }).click();
  await expect(page.getByLabel('Periode')).toHaveValue(/[0-9a-f-]{36}/);
  const row = page.getByRole('row', { name: /VII A/ });
  await expect(row).toContainText('Admin E2E');
  await expect(row).toContainText('75%'); // 3 of 4 present today

  // Rekap per siswa.
  await row.getByRole('link', { name: 'VII A' }).click();
  await expect(page.getByRole('heading', { name: 'Rekap VII A' })).toBeVisible();
  await expect(page.getByRole('row', { name: /ADITYA PRATAMA/ })).toContainText('0%');

  // The worker builds the e-Rapor sheet; the browser saves it.
  const download = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Excel untuk e-Rapor' }).click();
  expect((await download).suggestedFilename()).toMatch(/^rekap-kehadiran-.*-sem[12]-VII-A\.xlsx$/);

  // Session filling report (RKP-04).
  await page.getByRole('link', { name: '← Rekap semua rombel' }).click();
  await page.getByRole('link', { name: /pengisian sesi/ }).click();
  await expect(page.getByRole('row', { name: /Admin E2E/ })).toContainText('100%');
});
