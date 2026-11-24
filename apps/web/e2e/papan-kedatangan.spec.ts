import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, onboardAdmin } from './helpers';

test('Papan kedatangan: tampil per rombel dan angka "sudah datang" naik sendiri tanpa muat ulang (GRB-08)', async ({ page }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMP Papan E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  const headers = { 'x-school-id': schoolId, 'idempotency-key': randomUUID() };
  expect((await page.request.put('/api/v1/school/capabilities', { headers, data: { values: { 'gate.enabled': true } } })).ok()).toBe(true);

  await page.goto('/gerbang');
  await page.getByRole('link', { name: /Papan kedatangan/ }).click();
  await expect(page.getByRole('heading', { name: 'Papan kedatangan' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Kedatangan per rombel' });
  await expect(table.getByRole('row', { name: /VII A/ })).toBeVisible();
  const summary = page.getByLabel('Ringkasan sekolah');
  await expect(summary).toContainText('0 sudah datang');

  // Piket records one arrival elsewhere (here: through the API); the open board catches up within a few polls.
  const today = (await (await page.request.get('/api/v1/gate/today', { headers: { 'x-school-id': schoolId } })).json()) as { notArrived: { enrollmentId: string }[] };
  const first = today.notArrived[0];
  if (!first) throw new Error('no student to arrive');
  const arrived = await page.request.post('/api/v1/gate/arrivals', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { enrollmentId: first.enrollmentId, reason: 'Kartu tertinggal di rumah' },
  });
  expect(arrived.ok()).toBe(true);
  await expect(summary).toContainText('1 sudah datang', { timeout: 15_000 });
});
