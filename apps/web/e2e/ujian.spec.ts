import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { choose, createSchool, onboardAdmin } from './helpers';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

test('Ujian: admin membuat ujian hari ini, menata ruang, mengisi rombel dan mencatat kehadiran siswa', async ({ page }) => {
  test.slow();
  const { schoolId, inviteUrl, email } = createSchool('SMP Ujian E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  const enabled = await page.request.put('/api/v1/school/capabilities', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { values: { 'exam.enabled': true } },
  });
  expect(enabled.ok()).toBe(true);

  // A form that is wrong says so before anything is sent; a right one creates the exam.
  await page.goto('/ujian');
  await page.getByLabel('Nama ujian').fill('PTS Ganjil');
  await page.getByRole('button', { name: 'Buat ujian' }).click();
  await expect(page.getByText('Isi tanggal mulai dan selesai.')).toBeVisible();
  await page.getByLabel('Tanggal mulai').fill(today());
  await page.getByLabel('Tanggal selesai').fill(today());
  await page.getByRole('button', { name: 'Buat ujian' }).click();
  await expect(page.getByRole('link', { name: 'PTS Ganjil' })).toBeVisible();

  // With no attendance records and no bills everyone may sit.
  await page.getByRole('link', { name: 'PTS Ganjil' }).click();
  await expect(page.getByRole('heading', { name: 'PTS Ganjil' })).toBeVisible();
  await expect(page.getByText(/10 dari 10 siswa boleh ujian/)).toBeVisible();

  // A room, filled with a whole rombel.
  await page.getByRole('link', { name: 'Ruang ujian →' }).click();
  await page.getByLabel('Nama ruang').fill('R1');
  await page.getByRole('button', { name: 'Tambah ruang' }).click();
  await expect(page.getByRole('listitem', { name: 'R1' })).toContainText('pengawas: belum ada');
  await choose(page.getByLabel('Isi R1 dengan rombel'), { label: 'VII A' });
  await expect(page.getByText(/R1: \d+ siswa ditambahkan/)).toBeVisible();

  // The pengawas (here the admin) records an arrival by hand.
  await page.getByRole('link', { name: 'R1' }).click();
  const row = page.getByRole('listitem', { name: 'ADITYA PRATAMA' });
  await row.getByRole('button', { name: 'Catat hadir' }).click();
  await expect(page.getByText(/ADITYA PRATAMA hadir, tempat nomor \d+/)).toBeVisible();
  await expect(row).toContainText('Hadir');
  await expect(row.getByRole('button', { name: 'Catat hadir' })).toHaveCount(0);
});
