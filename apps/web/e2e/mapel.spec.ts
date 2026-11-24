import { expect, test } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

test('Mapel: kosong, nama terlalu pendek ditolak, tambah dengan kode, dicari', async ({ page }) => {
  const { inviteUrl, email } = createSchool('SMP Negeri Mapel E2E');
  await onboardAdmin(page, inviteUrl, email);

  await page.goto('/mapel');
  await expect(page.getByRole('heading', { level: 1, name: 'Mata pelajaran' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Belum ada mata pelajaran.' })).toBeVisible();

  await page.getByRole('button', { name: 'Tambah mapel' }).click();
  const drawer = page.getByRole('dialog', { name: 'Tambah mata pelajaran' });
  // A name that is too short is refused in words, and nothing is saved.
  await drawer.getByLabel('Nama mapel').fill('M');
  await drawer.getByRole('button', { name: 'Simpan' }).click();
  await expect(drawer.getByText('Nama mapel minimal 2 huruf.')).toBeVisible();
  await drawer.getByLabel('Nama mapel').fill('Matematika');
  await drawer.getByLabel(/^Kode/).fill('MTK');
  await drawer.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Mapel Matematika ditambahkan.')).toBeVisible();

  const table = page.getByRole('region', { name: 'Daftar mata pelajaran' });
  await expect(table.getByRole('row', { name: /Matematika/ })).toContainText('MTK');
  await page.getByLabel('Cari mapel').fill('zzz');
  await expect(page.getByRole('heading', { name: 'Tidak ada mapel yang cocok.' })).toBeVisible();
  await page.getByLabel('Cari mapel').fill('mtk');
  await expect(table.getByRole('row', { name: /Matematika/ })).toBeVisible();
});
