import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, onboardAdmin } from './helpers';

test('Jadwal: jam pelajaran, wali kelas, lesson with clash check, Excel template round trip', async ({ page }, testInfo) => {
  const { inviteUrl, email } = createSchool('SMP Negeri Jadwal E2E');
  await onboardAdmin(page, inviteUrl, email);

  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  // The home menu sends unfinished schools to /setup, so open the page directly.
  await page.goto('/jadwal');

  await page.getByRole('tab', { name: 'Jam pelajaran' }).click();
  await page.getByRole('button', { name: 'Isi', exact: true }).click();
  await expect(page.getByLabel('Jumat jam 8 selesai')).toHaveValue('12:20');
  // No sideways scrolling on phones.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Simpan jam pelajaran' }).click();
  await expect(page.getByText('Jam pelajaran tersimpan.')).toBeVisible();

  await page.getByRole('tab', { name: 'Wali kelas' }).click();
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();

  await page.getByRole('tab', { name: 'Jadwal pelajaran' }).click();
  await page.getByLabel('Rombel').selectOption({ label: 'VII A' });
  await page.getByRole('button', { name: 'Senin jam 1: kosong' }).click();
  await page.getByLabel('Nama mapel baru').fill('Matematika');
  await page.getByLabel('Guru').selectOption({ label: 'Admin E2E' });
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByRole('button', { name: 'Senin jam 1: Matematika' })).toContainText('Admin E2E');

  // The same teacher in another rombel at the same time is refused.
  await page.getByLabel('Rombel').selectOption({ label: 'VII B' });
  await page.getByRole('button', { name: 'Senin jam 1: kosong' }).click();
  await page.getByLabel('Mapel').selectOption({ label: 'Matematika' });
  await page.getByLabel('Guru').selectOption({ label: 'Admin E2E' });
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Jadwal bentrok' })).toContainText('Admin E2E sudah mengajar VII A di jam ini.');

  // The clash is said inside the drawer; closing it leaves VII B's Senin jam 1 empty.
  await page.getByRole('button', { name: 'Batal' }).click();
  await expect(page.getByRole('button', { name: 'Senin jam 1: kosong' })).toBeVisible();

  // Download the template (it holds the current lessons) and import it back.
  await page.getByRole('tab', { name: 'Import Excel' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh template' }).click();
  const file = testInfo.outputPath('template-jadwal.xlsx');
  await (await download).saveAs(file);
  await page.getByLabel('Template jadwal yang sudah diisi (.xlsx)').setInputFiles(file);
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await expect(page.getByRole('region', { name: 'Pratinjau jadwal' })).toContainText('1 pelajaran untuk 1 rombel (VII A).');
  await page.getByRole('button', { name: 'Terapkan jadwal' }).click();
  await expect(page.getByText('Jadwal diterapkan: 1 pelajaran untuk VII A.')).toBeVisible();
});
