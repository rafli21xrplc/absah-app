import { expect, test } from '@playwright/test';
import { randomInt, randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, fillSession, generateSessions, onboardAdmin } from './helpers';

test('MBG: admin mengatur jam batas dan PIC, alpa tidak dihitung hadir', async ({ page }) => {
  test.slow(); // onboarding, import and a session
  const { schoolId, inviteUrl, email } = createSchool('SD Negeri MBG E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  await page.goto('/jadwal');
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();

  generateSessions(schoolId);
  await page.goto('/hari-ini');
  await page.getByRole('link', { name: /VII A/ }).click();
  await fillSession(page, [{ name: 'ADITYA PRATAMA', status: 'Alpa' }]);

  // Off by default: the page answers 404 until the school receives MBG.
  await page.goto('/mbg');
  await expect(page.getByRole('alert')).toBeVisible();
  const enabled = await page.request.put('/api/v1/school/capabilities', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { values: { 'mbg.enabled': true } },
  });
  expect(enabled.ok()).toBe(true);

  await page.goto('/mbg');
  // 3 of 4 in VII A present; the alpa student gets no meal. Same before and after the cutoff.
  await expect(page.getByRole('row', { name: /VII A/ }).getByRole('cell').nth(1)).toHaveText('3');
  // The H-3 forecast is computed at 13.00 by the worker job; a new school has none yet.
  await expect(page.getByRole('heading', { name: 'Prakiraan porsi (H-3)' })).toBeVisible();
  await expect(page.getByText(/belum dihitung\. Dihitung pukul 13\.00/)).toBeVisible();

  const phone = `0812${String(randomInt(10_000_000, 99_999_999))}`;
  await page.getByLabel('Jam batas').fill('09:15');
  await page.getByLabel('Nama PIC MBG').fill('Bu Sari SPPG');
  await page.getByLabel(/WhatsApp PIC/).fill(phone);
  await page.getByRole('button', { name: 'Simpan pengaturan' }).click();
  await expect(page.getByText('Pengaturan MBG tersimpan.')).toBeVisible();
  await expect(page.getByText(`(sekarang +62812****${phone.slice(-4)})`)).toBeVisible();

  // Changing only the cutoff keeps the number (the field stays empty).
  await page.getByLabel('Jam batas').fill('09:30');
  await page.getByRole('button', { name: 'Simpan pengaturan' }).click();
  await expect(page.getByText(`(sekarang +62812****${phone.slice(-4)})`)).toBeVisible();
  await expect(page.getByLabel('Jam batas')).toHaveValue('09:30');
});
