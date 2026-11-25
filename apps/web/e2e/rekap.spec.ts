import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { choose, createSchool, fillSession, generateSessions, onboardAdmin } from './helpers';

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
  await choose(page.getByLabel('Wali kelas VII A'), { label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();

  generateSessions(schoolId);
  await page.goto('/hari-ini');
  await page.getByRole('link', { name: /VII A/ }).click();
  await fillSession(page, [{ name: 'ADITYA PRATAMA', status: 'Alpa' }]);

  // Rekap per rombel: the current semester by default.
  await page.goto('/rekap');
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

  // Rapor karakter (KEG-04): the same rombel, one PDF page per student.
  const character = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Rapor karakter (PDF)' }).click();
  expect((await character).suggestedFilename()).toMatch(/^rapor-karakter-.*-sem[12]-VII-A\.pdf$/);

  // Session filling report (RKP-04).
  await page.getByRole('link', { name: '← Rekap semua rombel' }).click();
  await page.getByRole('link', { name: /pengisian sesi/ }).click();
  await expect(page.getByRole('row', { name: /Admin E2E/ })).toContainText('100%');

  // Dasbor kepala sekolah (RKP-05): today's attendance and session fill, the same 75% as the rekap.
  await page.goto('/dasbor');
  await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible();
  // The five boxes in their fixed order; the rate under Hadir is the API's, the same 75% as the rekap.
  const board = page.getByRole('list', { name: 'Ringkasan kehadiran siswa' });
  await expect(board.getByRole('listitem')).toHaveCount(5);
  await expect(board.getByRole('listitem').first()).toContainText('75%');
  await expect(page.getByRole('region', { name: 'Sesi belum diisi' })).toContainText(/1 dari \d+ sesi sudah diisi/);
  await expect(page.getByRole('region', { name: 'Kehadiran per rombel' })).toBeVisible();
  await page.goto('/dasbor/yayasan');
  await expect(page.getByRole('heading', { name: 'Dasbor yayasan' })).toBeVisible();
  await expect(page.getByText(/belum memimpin sekolah yang tergabung dalam yayasan/)).toBeVisible();
});
