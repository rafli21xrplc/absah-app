import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, generateSessions, onboardAdmin } from './helpers';

test('Izin dari wali kelas mengisi sesi; dibatalkan, siswa kembali bisa dipilih', async ({ page }) => {
  const { schoolId, inviteUrl, email } = createSchool('SD Negeri Izin E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);

  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  await page.goto('/jadwal');
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();

  // The wali kelas enters izin after a parent's phone call: approved at once.
  await page.goto('/izin/baru');
  await page.getByLabel('Siswa').selectOption({ label: 'ADITYA PRATAMA · VII A' });
  await page.getByLabel('Alasan').fill('Demam, ibu menelepon pagi ini');
  await page.getByRole('button', { name: 'Simpan izin' }).click();
  await expect(page.getByRole('status')).toContainText('ADITYA PRATAMA: Sakit');
  await expect(page.getByRole('status')).toContainText('Disetujui');

  // Sessions created after the approval are filled from it.
  generateSessions(schoolId);
  await page.goto('/hari-ini');
  await page.getByRole('link', { name: /VII A/ }).click();
  await expect(page.getByText('Sakit · Izin disetujui')).toBeVisible();
  await expect(page.getByRole('button', { name: /^ADITYA PRATAMA: / })).toHaveCount(0);
  const sessionUrl = page.url();

  await page.goto('/izin');
  await page.getByRole('button', { name: 'Semua' }).click();
  const card = page.getByRole('listitem', { name: 'Izin ADITYA PRATAMA' });
  await card.getByRole('button', { name: 'Batalkan izin' }).click();
  await expect(card).toContainText('Dibatalkan');

  // The worker processes leave.cancelled; the student is a normal choice again.
  await expect(async () => {
    await page.goto(sessionUrl);
    await expect(page.getByRole('button', { name: /^ADITYA PRATAMA: / })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
});
