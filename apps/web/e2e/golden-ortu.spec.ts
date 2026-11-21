import { expect, test, type Browser, type Page } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, onboardAdmin, otpLogin, randomDigits } from './helpers';

/** One school with the fixture roster, set up by its own admin in its own browser context. */
async function schoolWithRoster(browser: Browser, name: string): Promise<Page> {
  const { inviteUrl, email } = createSchool(name, 'sd');
  const page = await (await browser.newContext()).newPage();
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  return page;
}

/** The school's WhatsApp number for a guardian, with portal access, as staff type it on /siswa/kontak. */
async function openPortalFor(page: Page, student: string, guardian: string, phone: string) {
  await page.goto('/siswa');
  await page.getByRole('link', { name: `Kontak WhatsApp ${student}` }).click();
  await page.getByRole('textbox', { name: new RegExp(`^Ibu: ${guardian}`) }).fill(phone);
  await page.getByRole('checkbox', { name: new RegExp(`Akses portal: ${guardian}`) }).check();
  await page.getByRole('button', { name: 'Simpan kontak' }).click();
  await expect(page.getByText('Kontak tersimpan.')).toBeVisible();
}

test('Orang tua dengan anak di dua sekolah: pilih anak di header, hanya data anak itu, preferensi per sekolah (ORT-03/04/05/06)', async ({ browser }) => {
  test.slow(); // two schools, each with an import
  const schoolA = await schoolWithRoster(browser, 'SD Ortu Satu E2E');
  const schoolB = await schoolWithRoster(browser, 'SD Ortu Dua E2E');

  // One parent number, one login: Aditya at school A, Bunga at school B. Their classmates are not hers.
  const phone = `0812${randomDigits(8)}`;
  await openPortalFor(schoolA, 'ADITYA PRATAMA', 'SITI AMINAH', phone);
  await openPortalFor(schoolB, 'BUNGA LESTARI', 'RINA MARLINA', phone);

  const parent = await (await browser.newContext()).newPage();
  await otpLogin(parent, phone, '/portal');

  // The header offers both children, with the school named because there are two.
  const picker = parent.getByRole('navigation', { name: 'Pilih anak' });
  const aditya = picker.getByRole('button', { name: /ADITYA PRATAMA.*SD Ortu Satu E2E/ });
  const bunga = picker.getByRole('button', { name: /BUNGA LESTARI.*SD Ortu Dua E2E/ });
  await expect(aditya).toBeVisible();
  await expect(bunga).toBeVisible();
  await expect(picker.getByRole('button')).toHaveCount(2);

  // Choosing a child shows that child only, and switches the school behind it.
  await aditya.click();
  await expect(parent.getByRole('region', { name: 'Kehadiran ADITYA PRATAMA' })).toBeVisible();
  await expect(parent.getByRole('region', { name: 'Kehadiran BUNGA LESTARI' })).toHaveCount(0);
  await expect(parent.getByText('SD Ortu Satu E2E', { exact: true })).toBeVisible();
  await bunga.click();
  await expect(parent.getByRole('region', { name: 'Kehadiran BUNGA LESTARI' })).toBeVisible();
  await expect(parent.getByRole('region', { name: 'Kehadiran ADITYA PRATAMA' })).toHaveCount(0);
  await expect(parent.getByText('SD Ortu Dua E2E', { exact: true })).toBeVisible();

  // A longer stretch of history is one tap away.
  await parent.getByRole('button', { name: '90 hari' }).click();
  await expect(parent.getByLabel('90 hari terakhir')).toBeVisible();

  // Preferences belong to the school: switch off "Izin disetujui" at school B ...
  await parent.getByRole('link', { name: /Pesan WhatsApp/ }).click();
  await expect(parent.getByText('SD Ortu Dua E2E', { exact: true })).toBeVisible();
  const approved = parent.getByRole('checkbox', { name: 'Izin disetujui' });
  await expect(approved).toBeChecked();
  await approved.uncheck();
  await parent.getByRole('checkbox', { name: /Jangan kirim setelah pukul 19\.00/ }).check();
  await parent.getByRole('button', { name: 'Simpan' }).click();
  await expect(parent.getByText('Pengaturan tersimpan.')).toBeVisible();
  await parent.reload();
  await expect(parent.getByRole('checkbox', { name: 'Izin disetujui' })).not.toBeChecked();
  await expect(parent.getByRole('checkbox', { name: /Jangan kirim setelah pukul 19\.00/ })).toBeChecked();

  // ... and school A still has the defaults.
  await parent.getByRole('navigation', { name: 'Pilih anak' }).getByRole('button', { name: /ADITYA PRATAMA/ }).click();
  await expect(parent.getByText('SD Ortu Satu E2E', { exact: true })).toBeVisible();
  await expect(parent.getByRole('checkbox', { name: 'Izin disetujui' })).toBeChecked();
  await expect(parent.getByRole('checkbox', { name: /Jangan kirim setelah pukul 19\.00/ })).not.toBeChecked();

  // The API agrees: school A's child list holds only Aditya, never Bunga's school or classmates.
  const atA = await parent.request.get('/api/v1/portal/attendance?days=1', { headers: { 'x-school-id': await schoolIdOf(schoolA) } });
  expect(atA.ok()).toBe(true);
  expect(((await atA.json()) as { items: { name: string }[] }).items.map((i) => i.name)).toEqual(['ADITYA PRATAMA']);
});

/** The school id the admin's page works in (from the context the app itself loads). */
async function schoolIdOf(admin: Page): Promise<string> {
  const res = await admin.request.get('/api/v1/me/context');
  const ctx = (await res.json()) as { schools: { id: string }[] };
  const id = ctx.schools[0]?.id;
  if (!id) throw new Error('admin has no school');
  return id;
}
