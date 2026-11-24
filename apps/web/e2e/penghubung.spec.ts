import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, onboardAdmin } from './helpers';

test('Buku penghubung: wali kelas menulis ke orang tua, menarik pesan dalam 15 menit, admin mengatur jam layanan', async ({ page }) => {
  const { inviteUrl, email } = createSchool('SMP Penghubung E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  await page.goto('/jadwal');
  await page.getByRole('tab', { name: 'Wali kelas' }).click();
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();

  // The admin's service hours.
  await page.goto('/penghubung');
  await page.getByLabel('Mulai').fill('07:00');
  await page.getByLabel('Selesai').fill('16:00');
  await page.getByRole('button', { name: 'Simpan jam layanan' }).click();
  await expect(page.getByText('Jam layanan tersimpan.')).toBeVisible();
  await expect(page.getByText('Belum ada percakapan.')).toBeVisible();

  // As wali kelas VII A the admin may write: a message, retracted, then another.
  await page.getByLabel('Cari siswa yang Anda ajar').fill('aditya');
  await page.getByRole('link', { name: 'ADITYA PRATAMA · VII A' }).click();
  await expect(page.getByText('Belum ada pesan.')).toBeVisible();
  await page.getByLabel('Tulis pesan').fill('Aditya lupa membawa buku paket hari ini.');
  await page.getByRole('button', { name: 'Kirim' }).click();
  const messages = page.getByRole('list', { name: 'Pesan' });
  await expect(messages).toContainText('Aditya lupa membawa buku paket hari ini.');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Tarik pesan' }).click();
  await expect(messages).toContainText('Pesan ditarik');
  await expect(messages).not.toContainText('buku paket');
  await page.getByLabel('Tulis pesan').fill('Mohon besok dibawa ya, Bu.');
  await page.getByRole('button', { name: 'Kirim' }).click();
  await expect(messages).toContainText('Mohon besok dibawa ya, Bu.');
  await expect(page.getByLabel('Tulis pesan')).toHaveValue('');

  await page.getByRole('link', { name: '← Buku penghubung' }).click();
  await expect(page.getByRole('list', { name: 'Buku penghubung' })).toContainText('ADITYA PRATAMA');
});
