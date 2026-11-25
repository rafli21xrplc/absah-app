import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { choose, createSchool, fillSession, generateSessions, onboardAdmin, pickStatus, sendReview } from './helpers';

test('Presensi harian SD: Hari ini, Semua hadir lalu yang tidak hadir, resubmit', async ({ page }) => {
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
  await choose(page.getByLabel('Wali kelas VII A'), { label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();
  generateSessions(schoolId);

  await page.goto('/hari-ini');
  // A daily session is open all day, so it is the one in progress: the big "Isi presensi" card.
  const card = page.getByRole('link', { name: /VII A/ });
  await expect(card).toHaveText('Isi presensi');
  await card.click();

  await expect(page.getByRole('heading', { name: 'VII A' })).toBeVisible();
  // Nobody is Hadir by default: every row says "Belum diisi" until the teacher answers.
  await expect(page.getByRole('button', { name: /: Belum diisi\. Ketuk untuk mengubah\.$/ })).toHaveCount(4);
  await fillSession(page, [{ name: 'ADITYA PRATAMA', status: 'Alpa' }]);
  await expect(page.getByText(/Hadir 3 · Telat 0 · Izin 0 · Sakit 0 · Alpa 1\./)).toBeVisible();

  // Change of mind before the 23.59 lock: send again.
  await page.getByRole('button', { name: 'Ubah presensi ini' }).click();
  await expect(page.getByRole('button', { name: /^ADITYA PRATAMA: Alpa\. Ketuk untuk mengubah\.$/ })).toBeVisible();
  await pickStatus(page, 'ADITYA PRATAMA', 'Sakit');
  await sendReview(page);
  await expect(page.getByText(/Hadir 3 · Telat 0 · Izin 0 · Sakit 1 · Alpa 0\./)).toBeVisible();

  await page.getByRole('link', { name: 'Kembali ke Hari ini' }).click();
  // Sent: it moves to "Sudah selesai" with what was sent, as a row (no button).
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('Terkirim');
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('1 tidak hadir');

  await page.goto('/koreksi');
  await expect(page.getByText('Tidak ada koreksi.')).toBeVisible();
});
