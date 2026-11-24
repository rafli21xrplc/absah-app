import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { EMIS_FIXTURES } from './env';
import { acceptInvite, createSchool, onboardAdmin, otpLogin, randomDigits, releaseFlag } from './helpers';

test('MA: import EMIS, ibadah berjamaah, setoran hafalan dilihat siswa, rekap per jurusan dan ekspor RDM setelah flag dibuka', async ({ page, browser }) => {
  test.slow();
  const { schoolId, inviteUrl, email } = createSchool('MA Golden E2E', 'sma');
  await onboardAdmin(page, inviteUrl, email);
  const headers = { 'x-school-id': schoolId };
  // A madrasah: EMIS, RDM, ibadah and hafalan come with the madrasah preset.
  const profile = await page.request.patch('/api/v1/school/profile', { headers: { ...headers, 'idempotency-key': randomUUID() }, data: { isMadrasah: true } });
  expect(profile.ok()).toBe(true);

  await page.goto('/import');
  await expect(page.getByRole('heading', { name: 'Import data siswa dari EMIS' })).toBeVisible();
  await page.getByLabel('Berkas data siswa EMIS (.xlsx)').setInputFiles(path.join(EMIS_FIXTURES, 'data-siswa.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 6 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  // Sholat dzuhur berjamaah as an activity, attendance on the usual session screen.
  await page.goto('/kegiatan');
  await page.getByLabel('Nama kegiatan').fill('Dzuhur berjamaah');
  await page.getByLabel('Jenis').selectOption({ label: 'Ibadah berjamaah' });
  await page.getByRole('checkbox', { name: 'Sen' }).check();
  await page.getByRole('checkbox', { name: 'Admin E2E' }).check();
  await page.getByRole('button', { name: 'Simpan kegiatan' }).click();
  await page.getByRole('link', { name: /Dzuhur berjamaah/ }).click();
  await page.getByLabel('Tambah siswa').fill('ahmad');
  await page.getByRole('button', { name: '+ AHMAD FAUZAN · X IPA 1' }).click();
  await page.getByRole('button', { name: 'Simpan peserta' }).click();
  await expect(page.getByText('Peserta tersimpan.')).toBeVisible();
  await page.getByRole('button', { name: 'Presensi kegiatan hari ini' }).click();
  await expect(page).toHaveURL(/\/sesi\//);
  await page.getByRole('button', { name: 'Kirim: 1 hadir, 0 tidak hadir' }).click();
  await expect(page.getByText('Presensi tersimpan.')).toBeVisible();

  // The guru tahfidz records Ahmad's setoran.
  const ustadzEmail = `e2e-tahfidz-${randomUUID()}@test.local`;
  const invited = await page.request.post('/api/v1/school/invitations', {
    headers: { ...headers, 'idempotency-key': randomUUID() },
    data: { name: 'Ustadz Hafidz', email: ustadzEmail, role: 'guru_tahfidz' },
  });
  expect(invited.ok()).toBe(true);
  const ustadzContext = await browser.newContext();
  const ustadz = await ustadzContext.newPage();
  await acceptInvite(ustadz, ((await invited.json()) as { inviteUrl: string }).inviteUrl, ustadzEmail);
  await expect(ustadz).not.toHaveURL(/\/masuk/);
  await ustadz.goto('/');
  // The side menu has the same link; the home card sits in the page's main.
  await ustadz.getByRole('main').getByRole('link', { name: 'Setoran hafalan' }).click();
  await ustadz.getByLabel('Cari siswa').fill('ahmad');
  await ustadz.getByRole('button', { name: 'AHMAD FAUZAN · X IPA 1' }).click();
  await ustadz.getByLabel('Surah').selectOption({ label: '67. Al-Mulk (30 ayat)' });
  await ustadz.getByLabel('Ayat awal').fill('1');
  await ustadz.getByLabel('Ayat akhir').fill('15');
  await ustadz.getByLabel(/Nilai/).fill('88');
  await ustadz.getByRole('button', { name: 'Simpan setoran' }).click();
  await expect(ustadz.getByText('Setoran Al-Mulk 1–15 tersimpan.')).toBeVisible();
  await expect(ustadz.getByRole('region', { name: 'Hafalan AHMAD' })).toContainText('disimak Ustadz Hafidz');
  await ustadzContext.close();

  // Ahmad logs in with WhatsApp and sees it in the portal.
  const studentPhone = `0812${randomDigits(8)}`;
  await page.goto('/siswa');
  await page.getByRole('link', { name: 'Kontak WhatsApp AHMAD FAUZAN' }).click();
  await page.getByLabel(/WhatsApp siswa/).fill(studentPhone);
  await page.getByRole('button', { name: 'Simpan kontak' }).click();
  await expect(page.getByText('Kontak tersimpan.')).toBeVisible();
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await otpLogin(student, studentPhone, '/portal');
  await student.getByRole('link', { name: /Hafalan Al-Qur'an/ }).click();
  const history = student.getByRole('region', { name: 'Hafalan AHMAD' });
  await expect(history).toContainText('Al-Mulk 1–15');
  await expect(history).toContainText('nilai 88');
  await studentContext.close();

  // Rekap per jurusan; RDM export waits for the Absah team to open the trial for this madrasah.
  await page.goto('/rekap');
  await page.getByLabel('Jurusan').selectOption({ label: 'IPS' });
  await expect(page.getByRole('link', { name: 'X IPS 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'X IPA 1' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Ekspor semester jurusan IPS' })).toBeVisible();
  await page.getByRole('button', { name: 'Excel untuk RDM (uji coba)' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'masih uji coba' })).toBeVisible();
  releaseFlag(schoolId, 'rdm-export-beta');
  const download = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Excel untuk RDM (uji coba)' }).click();
  expect((await download).suggestedFilename()).toMatch(/^rekap-kehadiran-.*-jurusan-IPS\.xlsx$/);
});
