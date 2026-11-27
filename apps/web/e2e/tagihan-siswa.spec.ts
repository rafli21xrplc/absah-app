import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { choose, createSchool, onboardAdmin, pickDate } from './helpers';

test('Tagihan siswa: admin membuat jenis, menerbitkan ke rombel dua kali, membatalkan satu tagihan, melihat rekap', async ({ page }) => {
  test.slow();
  const { schoolId, inviteUrl, email } = createSchool('SMP Tagihan Siswa E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  const enabled = await page.request.put('/api/v1/school/capabilities', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { values: { 'student.billing': true } },
  });
  expect(enabled.ok()).toBe(true);

  // A fee type with a default amount.
  await page.goto('/tagihan-siswa/jenis');
  await page.getByLabel('Nama jenis tagihan').fill('SPP');
  await page.getByLabel(/^Nominal bawaan/).fill('250.000');
  await page.getByRole('button', { name: 'Tambah jenis' }).click();
  await expect(page.getByRole('listitem', { name: 'SPP' })).toContainText(/Rp250\.000/);

  // Issue it to one rombel; issuing it again creates nothing twice.
  await page.goto('/tagihan-siswa/terbitkan');
  await choose(page.getByLabel('Jenis tagihan'), { label: 'SPP (Rp250.000)' });
  await page.getByLabel(/^Periode/).fill('2026-11');
  await choose(page.getByRole('combobox', { name: /^Rombel/ }), { index: 1 });
  await pickDate(page.getByLabel('Jatuh tempo', { exact: true }), '2099-12-10');
  await page.getByRole('button', { name: 'Terbitkan' }).click();
  await expect(page.getByRole('status').filter({ hasText: /tagihan dibuat, total/ })).toBeVisible();
  // The same click again replays the same answer (one Idempotency-Key per form state); a changed form is a new request.
  await page.getByLabel(/^Judul/).fill('SPP November');
  await page.getByRole('button', { name: 'Terbitkan' }).click();
  await expect(page.getByRole('status').filter({ hasText: /sudah punya tagihan ini/ })).toBeVisible();

  // The list holds the bills; cancelling one asks for a reason and takes it off the unpaid list.
  await page.goto('/tagihan-siswa');
  const rows = page.getByRole('row').filter({ hasText: 'SPP' });
  await expect(rows.first()).toContainText(/Rp250\.000/);
  const before = await rows.count();
  expect(before).toBeGreaterThan(0);
  page.once('dialog', (dialog) => void dialog.accept('Salah terbit'));
  await rows.first().getByRole('button', { name: 'Batalkan' }).click();
  await expect(rows).toHaveCount(before - 1);
  await choose(page.getByLabel('Status'), { label: 'Dibatalkan' });
  await expect(page.getByRole('row').filter({ hasText: 'Salah terbit' })).toHaveCount(1);

  // The recap opens for the month and shows what is still owed per rombel.
  await page.getByRole('link', { name: 'Rekap pembayaran' }).click();
  await expect(page.getByRole('heading', { name: 'Rekap pembayaran' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Belum dibayar per rombel' })).toBeVisible();
  // The rombel has several bills of Rp250.000 (one cancelled), so its row shows the sums, not one bill.
  await expect(page.getByRole('row').filter({ hasText: /VII/ }).first()).toContainText(/Rp[\d.]+/);
});
