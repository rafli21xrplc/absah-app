import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { acceptInvite, createSchool, onboardAdmin } from './helpers';

test('Kesiswaan: aturan, poin melewati ambang, tugas tindak lanjut, pembatalan, catatan BK', async ({ page, browser }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMP Kesiswaan E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  // The admin writes a rule and a threshold.
  await page.goto('/poin/aturan');
  await expect(page.getByText('Belum ada aturan poin.')).toBeVisible();
  await page.getByLabel('Kategori', { exact: true }).fill('Kedisiplinan');
  await page.getByLabel('Nama aturan').fill('Membolos');
  await page.getByLabel('Jumlah poin').fill('30');
  await page.getByRole('button', { name: 'Tambah aturan' }).click();
  await expect(page.getByRole('listitem', { name: 'Membolos' })).toContainText('-30');
  await page.getByLabel('Mulai dari (poin)').fill('25');
  await page.getByLabel('Nama tingkat').fill('Peringatan 1');
  await page.getByLabel('Tindak lanjut', { exact: true }).fill('Panggil orang tua');
  await page.getByRole('button', { name: 'Tambah ambang' }).click();
  await expect(page.getByRole('listitem', { name: 'Peringatan 1' })).toContainText('25 poin');

  // Recording a pelanggaran asks first, then crosses the threshold.
  await page.goto('/poin');
  await page.getByLabel('Cari siswa').fill('aditya');
  await page.getByRole('button', { name: 'ADITYA PRATAMA · VII A' }).click();
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Pilih aturannya.')).toBeVisible();
  await page.getByRole('combobox').selectOption({ label: 'Kedisiplinan · Membolos (-30)' });
  await page.getByLabel('Catatan (boleh dikosongkan)').fill('Tidak masuk setelah istirahat');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText(/Tersimpan: ADITYA PRATAMA, Membolos/)).toBeVisible();

  await page.getByRole('link', { name: 'Lihat poin siswa' }).click();
  await expect(page.getByRole('heading', { name: 'ADITYA PRATAMA' })).toBeVisible();
  await expect(page.getByText('-30 poin', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('listitem', { name: /Membolos/ })).toContainText('Tidak masuk setelah istirahat');

  // The follow-up task exists and is closed with a note.
  await page.goto('/tindak-lanjut');
  const task = page.getByRole('listitem', { name: 'ADITYA PRATAMA Peringatan 1' });
  await expect(task).toBeVisible({ timeout: 30_000 });
  await task.getByRole('button', { name: 'Selesaikan' }).click();
  await task.getByLabel('Yang sudah dilakukan (boleh dikosongkan)').fill('Orang tua dipanggil Senin');
  await task.getByRole('button', { name: 'Tandai selesai' }).click();
  await expect(page.getByText('Tidak ada tugas yang menunggu.')).toBeVisible();
  await page.getByLabel('Selesai', { exact: true }).check();
  await expect(page.getByRole('listitem', { name: 'ADITYA PRATAMA Peringatan 1' })).toContainText('Orang tua dipanggil Senin');

  // A wrong entry is reversed, never deleted.
  await page.goto('/poin');
  await page.getByLabel('Cari siswa').fill('aditya');
  await page.getByRole('button', { name: 'ADITYA PRATAMA · VII A' }).click();
  await page.getByRole('combobox').selectOption({ label: 'Kedisiplinan · Membolos (-30)' });
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.getByRole('link', { name: 'Lihat poin siswa' }).click();
  await page.getByRole('button', { name: 'Batalkan', exact: true }).first().click();
  await page.getByRole('button', { name: 'Batalkan catatan' }).click();
  await expect(page.getByText('Tulis alasan pembatalan.')).toBeVisible();
  await page.getByLabel('Alasan pembatalan').fill('Salah siswa');
  await page.getByRole('button', { name: 'Batalkan catatan' }).click();
  await expect(page.getByText('Dibatalkan').first()).toBeVisible();
  await expect(page.getByText('Pembatalan', { exact: true })).toBeVisible();

  // The guru BK writes a note and closes its follow-up; the admin reads it.
  const bkEmail = `e2e-bk-${randomUUID()}@test.local`;
  const invited = await page.request.post('/api/v1/school/invitations', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { name: 'Bu Guru BK', email: bkEmail, role: 'guru_bk' },
  });
  expect(invited.ok()).toBe(true);
  const { inviteUrl: bkInvite } = (await invited.json()) as { inviteUrl: string };

  const context = await browser.newContext();
  const bk = await context.newPage();
  await acceptInvite(bk, bkInvite, bkEmail);
  await bk.goto('/bk');
  await expect(bk.getByRole('heading', { name: 'Catatan BK' })).toBeVisible();
  await bk.getByLabel('Cari siswa').fill('aditya');
  await bk.getByRole('button', { name: 'ADITYA PRATAMA · VII A' }).click();
  await bk.getByLabel('Catatan', { exact: true }).fill('Bicara soal sering bolos, ada masalah di rumah');
  await bk.locator('form').getByRole('radio', { name: 'Tindak lanjut direncanakan' }).check();
  await bk.getByRole('button', { name: 'Simpan catatan' }).click();
  await expect(bk.getByText('Tersimpan: catatan untuk ADITYA PRATAMA.')).toBeVisible();
  const planned = bk.getByRole('listitem').filter({ hasText: 'Bicara soal sering bolos' });
  await expect(planned).toContainText('Tindak lanjut direncanakan');
  await planned.getByRole('button', { name: 'Tandai tindak lanjut selesai' }).click();
  await expect(bk.getByText('Tidak ada catatan.')).toBeVisible();
  await bk.getByRole('group', { name: 'Tampilkan' }).getByLabel('Tindak lanjut selesai').check();
  await expect(bk.getByRole('listitem').filter({ hasText: 'Bicara soal sering bolos' })).toContainText('Tindak lanjut selesai');
  await context.close();

  await page.goto('/bk');
  await page.getByRole('group', { name: 'Tampilkan' }).getByLabel('Semua').check();
  await expect(page.getByRole('listitem').filter({ hasText: 'Bicara soal sering bolos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Catatan baru' })).toHaveCount(0);
});
