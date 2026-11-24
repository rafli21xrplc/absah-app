import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { acceptInvite, createSchool, fillSession, onboardAdmin } from './helpers';

test('Kegiatan: admin membuat ekskul, pembina mengatur peserta dan mengisi presensi kegiatan', async ({ page, browser }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMP Ekskul E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  const coachEmail = `e2e-pembina-${randomUUID()}@test.local`;
  const invited = await page.request.post('/api/v1/school/invitations', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { name: 'Pak Pembina', email: coachEmail, role: 'guru' },
  });
  expect(invited.ok()).toBe(true);
  const { inviteUrl: coachInvite } = (await invited.json()) as { inviteUrl: string };
  const context = await browser.newContext();
  const coach = await context.newPage();
  await acceptInvite(coach, coachInvite, coachEmail);
  await coach.goto('/kegiatan');
  await expect(coach.getByText('Belum ada kegiatan yang Anda bina.')).toBeVisible();

  // The admin creates Pramuka and appoints the coach.
  await page.goto('/kegiatan');
  await page.getByLabel('Nama kegiatan').fill('Pramuka');
  await page.getByRole('checkbox', { name: 'Jum' }).check();
  await page.getByRole('button', { name: 'Simpan kegiatan' }).click();
  await expect(page.getByText('Pilih minimal satu pembina.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Pak Pembina' }).check();
  await page.getByRole('button', { name: 'Simpan kegiatan' }).click();
  await expect(page.getByRole('link', { name: /Pramuka/ })).toContainText('Pembina: Pak Pembina');

  // The coach adds a member, saves, and takes today's attendance on the usual session screen.
  await coach.reload();
  await coach.getByRole('link', { name: /Pramuka/ }).click();
  await coach.getByLabel('Tambah siswa').fill('aditya');
  await coach.getByRole('button', { name: '+ ADITYA PRATAMA · VII A' }).click();
  await coach.getByRole('button', { name: 'Simpan peserta' }).click();
  await expect(coach.getByText('Peserta tersimpan.')).toBeVisible();
  await expect(coach.getByRole('heading', { name: 'Peserta (1)' })).toBeVisible();
  await coach.getByRole('button', { name: 'Presensi kegiatan hari ini' }).click();
  await expect(coach).toHaveURL(/\/sesi\//);
  await fillSession(coach, [{ name: 'ADITYA PRATAMA', status: 'Alpa' }]);

  // The rekap kegiatan counts it, separate from the class rekap.
  await coach.goBack();
  await expect(coach.getByText(/1 pertemuan/)).toBeVisible();
  await expect(coach.getByRole('row', { name: /ADITYA PRATAMA/ })).toContainText('0%');
  await context.close();
});
