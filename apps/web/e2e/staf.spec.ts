import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { acceptInvite, createSchool, onboardAdmin } from './helpers';

test('Guru dan staf: undang lewat tautan, nonaktifkan dengan konfirmasi, aktifkan lagi', async ({ page, browser }) => {
  const { inviteUrl, email } = createSchool('SMP Negeri Staf E2E');
  await onboardAdmin(page, inviteUrl, email);

  await page.goto('/staf');
  await expect(page.getByRole('heading', { level: 1, name: 'Guru dan staf' })).toBeVisible();
  const table = page.getByRole('region', { name: 'Daftar guru dan staf' });
  // The admin sees themself, and the page does not offer to switch themself off (the API refuses it).
  const me = table.getByRole('row', { name: /Anda/ });
  await expect(me).toContainText('Admin');
  await expect(me.getByRole('button')).toHaveCount(0);

  const guruEmail = `e2e-staf-${randomUUID()}@test.local`;
  await page.getByRole('button', { name: 'Undang staf' }).click();
  const drawer = page.getByRole('dialog', { name: 'Undang staf' });
  await drawer.getByLabel('Nama').fill('Bu Guru Baru');
  await drawer.getByRole('textbox', { name: 'Email' }).fill(guruEmail);
  await drawer.getByLabel('Peran').selectOption({ label: 'Guru' });
  await drawer.getByRole('button', { name: 'Buat undangan' }).click();
  await expect(drawer.getByRole('heading', { name: 'Undangan untuk Bu Guru Baru sudah dibuat' })).toBeVisible();
  const link = await drawer.getByLabel('Tautan undangan').inputValue();
  expect(link).toMatch(/^https?:\/\//);
  await drawer.getByRole('button', { name: 'Selesai' }).click();

  const row = table.getByRole('row', { name: /Bu Guru Baru/ });
  await expect(row).toContainText('Undangan terkirim');
  await expect(row.getByRole('button')).toHaveCount(0); // an invitation is not an account to switch yet

  const guru = await (await browser.newContext()).newPage();
  await acceptInvite(guru, link, guruEmail);

  await page.reload();
  await expect(row).toContainText('Aktif');
  await row.getByRole('button', { name: 'Nonaktifkan Bu Guru Baru sebagai Guru' }).click();
  const ask = page.getByRole('alertdialog', { name: 'Nonaktifkan Bu Guru Baru sebagai Guru?' });
  await expect(ask).toContainText('Riwayat sesi dan catatannya tetap ada');
  await ask.getByRole('button', { name: 'Nonaktifkan' }).click();
  await expect(page.getByText('Bu Guru Baru dinonaktifkan sebagai Guru.')).toBeVisible();
  await expect(row).toContainText('Dinonaktifkan');

  await row.getByRole('button', { name: 'Aktifkan Bu Guru Baru sebagai Guru' }).click();
  await expect(page.getByText('Bu Guru Baru diaktifkan sebagai Guru.')).toBeVisible();
  await expect(row).toContainText('Aktif');

  await page.getByLabel('Cari guru atau staf').fill('zzz');
  await expect(page.getByRole('heading', { name: 'Tidak ada yang cocok.' })).toBeVisible();
});
