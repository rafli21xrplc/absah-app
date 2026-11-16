import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, generateSessions, lastActionLink, onboardAdmin, randomDigits } from './helpers';

test('Orang tua membuka tautan aksi, mengajukan izin, wali kelas menyetujui, status sesi berubah', async ({ page, browser }) => {
  test.slow(); // onboarding, import, session, link, approval and the worker in one flow
  const { schoolId, inviteUrl, email } = createSchool('SD Negeri Tautan E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  await page.goto('/jadwal');
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();

  // The parent's WhatsApp number, entered by the school.
  await page.goto('/siswa');
  await page.getByRole('link', { name: 'Kontak WhatsApp ADITYA PRATAMA' }).click();
  const parentPhone = `0812${randomDigits(8)}`;
  await page.getByRole('textbox', { name: /^Ibu:/ }).fill(parentPhone);
  await page.getByRole('button', { name: 'Simpan kontak' }).click();
  await expect(page.getByText('Kontak tersimpan.')).toBeVisible();
  await expect(page.getByText(/Ibu: .*\(sekarang \+62812\*\*\*\*/)).toBeVisible();

  // Alpa in today's session -> the worker queues a WhatsApp message with an action link.
  generateSessions(schoolId);
  await page.goto('/hari-ini');
  await page.getByRole('link', { name: /VII A/ }).click();
  await page.getByRole('button', { name: 'ADITYA PRATAMA: Alpa' }).click();
  await page.getByRole('button', { name: 'Kirim: 3 hadir, 1 tidak hadir' }).click();
  await expect(page.getByText('Presensi tersimpan.')).toBeVisible();
  const sessionUrl = page.url();
  let link: string | null = null;
  await expect(async () => {
    link = lastActionLink(schoolId);
    expect(link).toMatch(/\/t#/);
  }).toPass({ timeout: 30_000 });

  // The parent, on another phone without an account.
  const parentContext = await browser.newContext();
  const parent = await parentContext.newPage();
  await parent.goto(link ?? '');
  await expect(parent.getByRole('heading', { name: 'Aditya · VII A' })).toBeVisible();
  await expect(parent).toHaveURL(/\/t$/); // the token left the address bar
  await expect(parent.getByRole('region', { name: /Hari ini/ })).toContainText('Alpa');
  await expect(parent.getByText('PRATAMA')).toHaveCount(0);
  await parent.getByLabel('Alasan').fill('Demam sejak semalam');
  await parent.getByRole('button', { name: 'Kirim ke wali kelas' }).click();
  await expect(parent.getByRole('list', { name: 'Izin terakhir' })).toContainText('Menunggu');
  await expect(parent.getByText(/Tautan ini sudah dipakai/)).toBeVisible();

  // The wali kelas approves.
  await page.goto('/izin');
  const request = page.getByRole('listitem', { name: 'Izin ADITYA PRATAMA' });
  await expect(request).toContainText('tautan WhatsApp');
  await request.getByRole('button', { name: 'Setujui' }).click();
  await expect(request).toContainText('Disetujui');

  // The worker applies the izin: the session shows Sakit, and so does the parent's page.
  await expect(async () => {
    await page.goto(sessionUrl);
    await expect(page.getByText('Sakit · Izin disetujui')).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await parent.reload();
  await expect(parent.getByRole('region', { name: /Hari ini/ })).toContainText('Sakit');
  await expect(parent.getByRole('list', { name: 'Izin terakhir' })).toContainText('Disetujui');
  await parentContext.close();
});

