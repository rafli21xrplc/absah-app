import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { acceptInvite, createSchool, onboardAdmin } from './helpers';

test('UKS: petugas mencatat siswa dipulangkan; admin tidak membaca catatan UKS', async ({ page, browser }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMP UKS E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  // The admin invites the school nurse (petugas UKS).
  const petugasEmail = `e2e-uks-${randomUUID()}@test.local`;
  const invited = await page.request.post('/api/v1/school/invitations', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { name: 'Bu Petugas UKS', email: petugasEmail, role: 'petugas_uks' },
  });
  expect(invited.ok()).toBe(true);
  const { inviteUrl: petugasInvite } = (await invited.json()) as { inviteUrl: string };

  const context = await browser.newContext();
  const petugas = await context.newPage();
  await acceptInvite(petugas, petugasInvite, petugasEmail);
  await expect(petugas).not.toHaveURL(/\/masuk/);
  await petugas.goto('/uks');
  await expect(petugas.getByRole('heading', { name: 'UKS', exact: true })).toBeVisible();
  await expect(petugas.getByText('Belum ada kunjungan.')).toBeVisible();

  await petugas.getByLabel('Cari siswa').fill('aditya');
  await petugas.getByRole('button', { name: 'ADITYA PRATAMA · VII A' }).click();
  await petugas.getByRole('button', { name: 'Simpan kunjungan' }).click();
  await expect(petugas.getByText('Tulis keluhan siswa.')).toBeVisible();
  await petugas.getByLabel('Keluhan').fill('Demam 38,5');
  await petugas.getByLabel('Tindakan (boleh dikosongkan)').fill('Kompres, hubungi orang tua');
  await petugas.getByLabel('Dipulangkan').check();
  petugas.once('dialog', (d) => void d.accept());
  await petugas.getByRole('button', { name: 'Simpan kunjungan' }).click();
  await expect(petugas.getByText(/ADITYA PRATAMA dicatat dipulangkan/)).toBeVisible();
  const visit = petugas.getByRole('listitem', { name: 'Kunjungan ADITYA PRATAMA' });
  await expect(visit).toContainText('Demam 38,5');
  await expect(visit).toContainText('Dipulangkan');
  await context.close();

  // The notes are for the petugas only: the admin is refused.
  await page.goto('/uks');
  await expect(page.getByText('UKS dicatat oleh petugas UKS.')).toBeVisible();
});
