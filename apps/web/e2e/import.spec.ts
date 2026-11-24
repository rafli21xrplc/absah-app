import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, onboardAdmin } from './helpers';

const counts = (page: Page) => page.getByTestId('import-counts');

async function importFile(page: Page, file: string, applies: number) {
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, file));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await expect(page.getByRole('button', { name: `Terapkan ${applies} perubahan` })).toBeVisible({ timeout: 60_000 });
}

test('Dapodik import: preview, apply, re-import changes, settle calon keluar', async ({ page }) => {
  const { inviteUrl, email } = createSchool('SMP Negeri Import E2E');
  await onboardAdmin(page, inviteUrl, email);

  await page.goto('/import');
  await importFile(page, 'daftar-pd-awal.xlsx', 10);
  await expect(counts(page)).toContainText('10Siswa baru');
  await expect(page.getByRole('region', { name: 'Siswa baru' })).toContainText('FAJAR NUGROHO');
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click();
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  await page.goto('/rombel');
  const rows = page.getByRole('row');
  await expect(rows.filter({ hasText: 'VII A' }).first()).toContainText('4');
  await expect(rows.filter({ hasText: 'VIII A' })).toContainText('3');

  // A later export: one new, three changed, one missing.
  await page.goto('/import');
  await importFile(page, 'daftar-pd-perubahan.xlsx', 5);
  const changed = page.getByRole('region', { name: 'Berubah' });
  await expect(changed).toContainText('Rombel: VII A → VII B');
  await expect(page.getByRole('region', { name: 'Calon keluar' })).toContainText('BUNGA LESTARI');
  await page.getByRole('button', { name: 'Terapkan 5 perubahan' }).click();
  await page.getByRole('link', { name: 'Tindak lanjuti 1 calon keluar' }).click();

  await expect(page).toHaveURL(/\/siswa\?status=missing/);
  const bunga = page.getByRole('row', { name: /BUNGA LESTARI/ });
  await expect(bunga).toContainText('Calon keluar');
  // "Keluarkan" asks first, names what stays, and wants a reason before the button works.
  await bunga.getByRole('button', { name: 'Keluarkan BUNGA LESTARI' }).click();
  const ask = page.getByRole('alertdialog', { name: 'Keluarkan BUNGA LESTARI dari siswa aktif?' });
  await expect(ask).toContainText('Data tidak dihapus');
  await expect(ask.getByRole('button', { name: 'Keluarkan' })).toBeDisabled();
  await ask.getByRole('radio', { name: 'Pindah sekolah' }).check();
  await ask.getByRole('button', { name: 'Keluarkan' }).click();
  await expect(page.getByText('BUNGA LESTARI ditandai pindah sekolah.')).toBeVisible();
  await expect(page.getByText('Tidak ada siswa yang cocok.')).toBeVisible();

  await page.getByRole('button', { name: 'Aktif' }).click();
  await page.getByLabel('Cari siswa').fill('dimas');
  await expect(page.getByRole('row', { name: /DIMAS ANGGARA/ })).toContainText('VII B');
});
