import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, fillSession, generateSessions, lastActionLink, onboardAdmin, randomDigits } from './helpers';

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
  await fillSession(page, [{ name: 'ADITYA PRATAMA', status: 'Alpa' }]);
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
  await expect(request).toHaveCount(0); // the list shows pending requests by default
  await page.getByRole('button', { name: 'Semua' }).click();
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

test('Aplikasi siswa bisa dipasang: manifest, ikon, service worker, masuk dengan WhatsApp', async ({ page, request }) => {
  const manifest = (await (await request.get('/manifest.webmanifest')).json()) as { start_url: string; display: string; icons: { src: string; purpose?: string }[] };
  expect(manifest).toMatchObject({ start_url: '/portal', display: 'standalone' });
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).headers()['content-type']).toBe('image/png');
  expect((await request.get('/portal-sw.js')).headers()['cache-control']).toContain('no-store');

  // Without a session the PWA asks for the WhatsApp number.
  await page.goto('/portal');
  await expect(page).toHaveURL(/\/masuk\/hp\?lanjut=%2Fportal$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(0); // only portal pages carry it
  await page.getByLabel('Nomor WhatsApp').fill('0812 0000 0000');
  await page.getByRole('button', { name: 'Kirim kode' }).click();
  await expect(page.getByLabel('Kode dari WhatsApp')).toBeVisible();
});
