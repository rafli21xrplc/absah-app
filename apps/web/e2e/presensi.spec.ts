import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, generateSessions, onboardAdmin } from './helpers';

test('Presensi harian SD: Hari ini, "Semua hadir kecuali…", resubmit', async ({ page }) => {
  const { schoolId, inviteUrl, email } = createSchool('SD Negeri Presensi E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);

  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  // SD runs on daily sessions owned by the wali kelas.
  await page.goto('/jadwal');
  await expect(page.getByRole('tab', { name: 'Wali kelas', selected: true })).toBeVisible();
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();
  generateSessions(schoolId);

  await page.goto('/hari-ini');
  // A daily session is open all day, so it is the one in progress: the big "Isi presensi" card.
  const card = page.getByRole('link', { name: /VII A/ });
  await expect(card).toHaveText('Isi presensi');
  await card.click();

  await expect(page.getByRole('heading', { name: 'VII A' })).toBeVisible();
  await page.getByRole('button', { name: 'ADITYA PRATAMA: Alpa' }).click();
  await page.getByRole('button', { name: 'Kirim: 3 hadir, 1 tidak hadir' }).click();
  await expect(page.getByText('Presensi tersimpan.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ADITYA PRATAMA: Alpa' })).toHaveAttribute('aria-pressed', 'true');

  // Change of mind before the 23.59 lock: send again.
  await page.getByRole('button', { name: 'ADITYA PRATAMA: Sakit' }).click();
  await page.getByRole('button', { name: 'Kirim: 3 hadir, 1 tidak hadir' }).click();
  await expect(page.getByText('Presensi tersimpan.')).toBeVisible();

  await page.getByRole('link', { name: '← Hari ini' }).click();
  // Sent: it moves to "Sudah selesai" with what was sent, as a row (no button).
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('Terkirim');
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('1 tidak hadir');

  await page.goto('/koreksi');
  await expect(page.getByText('Tidak ada koreksi.')).toBeVisible();
});
