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

  // One handler for the whole run: no signal drops every call; once the signal is back, the first three sends of the waiting
  // presensi still get no answer (a flaky network), and every try is logged with its Idempotency-Key.
  const tries: { session: string; key: string; answered: boolean }[] = [];
  let signal = false;
  let failuresLeft = 3;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const sync = /\/sessions\/([^/]+)\/sync$/.exec(new URL(request.url()).pathname);
    if (sync) {
      const failing = !signal || failuresLeft > 0;
      if (signal && failuresLeft > 0) failuresLeft -= 1;
      tries.push({ session: sync[1] ?? '', key: request.headers()['idempotency-key'] ?? '', answered: !failing });
      if (failing) return route.abort('internetdisconnected');
      return route.continue();
    }
    if (!signal) return route.abort('internetdisconnected');
    return route.continue();
  });

  await page.getByRole('link', { name: /VII A/ }).click();
  await expect(page.getByRole('heading', { name: 'VII A' })).toBeVisible();
  await expect(page.getByText(/Daftar siswa dari salinan di HP/)).toBeVisible();
  // The yellow banner says what happens, and the main button is now "Simpan presensi di HP".
  await expect(page.getByText(/Presensi disimpan di HP dan dikirim otomatis saat sinyal kembali/)).toBeVisible();
  await markStudents(page, [{ name: 'ADITYA PRATAMA', status: 'Alpa' }]);
  await expect(page.getByRole('button', { name: 'Simpan presensi di HP' })).toBeVisible();
  await sendReview(page);
  await expect(page.getByRole('heading', { name: 'Presensi VII A tersimpan di HP' })).toBeVisible();
  await expect(page.locator('main').getByText('Menunggu · 1')).toBeVisible();
  await expect(page.getByText('1 presensi menunggu dikirim.')).toBeVisible();

  await page.getByRole('link', { name: 'Kembali ke Hari ini' }).click();
  await expect(page.getByText(/Tanpa sinyal\. Daftar dari salinan di HP/)).toBeVisible();
  // On Hari ini the card of VII A says it waits.
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('Menunggu dikirim');
  await page.getByRole('link', { name: /VII B/ }).click();
  await expect(page.getByRole('heading', { name: 'VII B' })).toBeVisible();
  await page.getByRole('button', { name: /: Belum diisi\. Ketuk untuk mengubah\.$/ }).first().waitFor();
  await page.getByRole('button', { name: /^(Semua hadir|Sisanya hadir)/ }).click();
  const first = await page.getByRole('button', { name: /: Hadir\. Ketuk untuk mengubah\.$/ }).first().getAttribute('aria-label');
  await pickStatus(page, (first ?? '').split(':')[0] ?? '', 'Sakit');
  await sendReview(page);
  await expect(page.getByRole('heading', { name: 'Presensi VII B tersimpan di HP' })).toBeVisible();
  await expect(page.locator('main').getByText('Menunggu · 2')).toBeVisible();
  await expect(page.getByText('2 presensi menunggu dikirim.')).toBeVisible();

  // Signing out with something waiting says how many are still on the phone, and does not lose them.
  await page.goto('/');
  // The button is the last thing on a long page and the Next dev-tools badge sits over it on a phone: the click is sent to the button itself.
  await page.getByRole('button', { name: 'Keluar' }).dispatchEvent('click');
  await expect(page.getByRole('alertdialog', { name: 'Ada presensi yang belum terkirim' })).toContainText('2 presensi masih di HP ini');
  await page.getByRole('button', { name: 'Tetap di sini' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  // Signal is back, but the first three sends get no answer: "Kirim sekarang" tries at once each time (the automatic wait would
  // be 15 s, 30 s, 1 min). The fourth goes through. Every try carried the same Idempotency-Key, and each presensi was answered once.
  signal = true;
  for (let n = 1; n <= 3; n += 1) {
    await page.getByRole('button', { name: 'Kirim sekarang' }).click();
    await expect.poll(() => tries.filter((x) => !x.answered).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(n);
  }
  const sendNow = page.getByRole('button', { name: 'Kirim sekarang' });
  if (await sendNow.isVisible()) await sendNow.click();
  await expect(page.getByText(/VII A: presensi terkirim\./)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/VII B: presensi terkirim\./)).toBeVisible();
  await expect(page.getByText(/presensi menunggu dikirim/)).toHaveCount(0);

  const sessions = [...new Set(tries.map((x) => x.session))];
  expect(sessions).toHaveLength(2);
  for (const session of sessions) {
    const mine = tries.filter((x) => x.session === session);
    expect(new Set(mine.map((x) => x.key)).size).toBe(1);
    expect(mine.filter((x) => x.answered)).toHaveLength(1);
  }
  expect(tries.filter((x) => !x.answered).length).toBeGreaterThanOrEqual(3);

  await page.goto('/hari-ini');
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('Terkirim');
  await expect(page.getByRole('link', { name: /VII A/ })).toContainText('1 tidak hadir');
  await expect(page.getByRole('link', { name: /VII B/ })).toContainText('Terkirim');
});
