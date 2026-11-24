import { expect, test } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, generateSessions, markStudents, onboardAdmin, pickStatus, sendReview } from './helpers';

// The app's own server stays reachable here (the service worker that keeps the page shells is production-only);
// what drops is the API, which is what "no signal" means for the session screens (PRS-08).
test('Guru mengisi dua sesi tanpa sinyal, lalu terkirim otomatis saat sinyal kembali', async ({ page }) => {
  const { schoolId, inviteUrl, email } = createSchool('SD Negeri Offline E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);

  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  await page.goto('/jadwal');
  for (const rombel of ['VII A', 'VII B']) {
    await page.getByLabel(`Wali kelas ${rombel}`).selectOption({ label: 'Admin E2E' });
    await expect(page.getByText(`Wali kelas ${rombel}: Admin E2E.`)).toBeVisible();
  }
  generateSessions(schoolId);

  // With signal: Hari ini keeps both sessions on the phone.
  await page.goto('/hari-ini');
  await expect(page.getByRole('link', { name: /VII A/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /VII B/ })).toContainText('Belum diisi');
  // Both rosters are kept on the phone before the signal drops (the page keeps polling, so "network idle" never comes).
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const open = indexedDB.open('absah-staff-offline');
            open.onsuccess = () => {
              const keys = open.result.transaction('cache').objectStore('cache').getAllKeys();
              keys.onsuccess = () => resolve((keys.result as string[]).filter((k) => k.startsWith('session:')).length);
            };
            open.onerror = () => resolve(0);
          }),
      ),
    )
    .toBe(2);

  await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));

  await page.getByRole('link', { name: /VII A/ }).click();
  await expect(page.getByRole('heading', { name: 'VII A' })).toBeVisible();
  await expect(page.getByText(/Daftar siswa dari salinan di HP/)).toBeVisible();
  await markStudents(page, [{ name: 'ADITYA PRATAMA', status: 'Alpa' }]);
  await sendReview(page);
  await expect(page.getByText(/Presensi disimpan di HP dan dikirim otomatis saat sinyal kembali/)).toBeVisible();
  await expect(page.getByText('1 sesi menunggu dikirim.')).toBeVisible();

  await page.getByRole('link', { name: 'Kembali ke Hari ini' }).click();
  await expect(page.getByText(/Tanpa sinyal\. Daftar dari salinan di HP/)).toBeVisible();
  await page.getByRole('link', { name: /VII B/ }).click();
  await expect(page.getByRole('heading', { name: 'VII B' })).toBeVisible();
  await page.getByRole('button', { name: /: Belum diisi\. Ketuk untuk mengubah\.$/ }).first().waitFor();
  await page.getByRole('button', { name: /^(Semua hadir|Sisanya hadir)/ }).click();
  const first = await page.getByRole('button', { name: /: Hadir\. Ketuk untuk mengubah\.$/ }).first().getAttribute('aria-label');
  await pickStatus(page, (first ?? '').split(':')[0] ?? '', 'Sakit');
  await sendReview(page);
  await expect(page.getByText('2 sesi menunggu dikirim.')).toBeVisible();

  // Signal is back: nothing to press, the retry (every 15 s) sends both ("Kirim sekarang" only hurries it).
  await page.unroute('**/api/v1/**');
  await expect(page.getByText('VII A: presensi terkirim.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('VII B: presensi terkirim.')).toBeVisible();
  await expect(page.getByText(/sesi menunggu dikirim/)).toHaveCount(0);

  await page.getByRole('link', { name: 'Kembali ke Hari ini' }).click();
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('Terkirim');
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('1 tidak hadir');
  await expect(page.getByRole('link', { name: /VII B/ })).toContainText('Terkirim');
});
