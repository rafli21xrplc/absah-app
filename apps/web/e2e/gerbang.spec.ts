import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES, KIOSK_URL } from './env';
import { cardToken, createSchool, gateFixture, onboardAdmin, type GateFixture } from './helpers';

/** Late after 07.00 (no jam pelajaran in this school), by the Jakarta clock. */
const arrivalLabel = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms) <= '07:00' ? 'Hadir' : 'Terlambat';

/** A USB scanner types the QR text and Enter; the kiosk makes no difference with the camera. */
async function scan(kiosk: Page, card: GateFixture['cards'][number]) {
  const now = await kiosk.evaluate(() => Date.now());
  await kiosk.keyboard.type(cardToken(card, now));
  await kiosk.keyboard.press('Enter');
  return now;
}

test('Kios offline satu jam lalu online: setiap scan tercatat tepat sekali; piket mencatat manual', async ({ page, browser }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMP Gerbang E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  const enabled = await page.request.put('/api/v1/school/capabilities', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { values: { 'gate.enabled': true } },
  });
  expect(enabled.ok()).toBe(true);
  // Students activate their cards on their phones (test phones with today's device keys).
  const { cards } = gateFixture(schoolId);
  const [first, second, third] = cards;
  if (!first || !second || !third) throw new Error('fixture has too few cards');

  // The admin makes a one-time pairing code; the gate tablet uses it.
  await page.goto('/gerbang');
  await page.getByRole('link', { name: 'Kelola kios gerbang' }).click();
  await page.getByRole('button', { name: 'Buat kode pasang' }).click();
  await expect(page.getByRole('img', { name: 'QR kode pasang kios' })).toBeVisible();
  const pairingCode = (await page.getByTestId('pairing-code').textContent())?.trim() ?? '';

  // Service workers blocked so page.route sees the kiosk's API calls.
  const kioskContext = await browser.newContext({ serviceWorkers: 'block' });
  const kiosk = await kioskContext.newPage();
  await kiosk.clock.install();
  await kiosk.goto(KIOSK_URL);
  await kiosk.getByLabel('Kode pasang').fill(pairingCode);
  await kiosk.getByLabel('Nama kios').fill('Gerbang depan');
  await kiosk.getByRole('button', { name: 'Pasang', exact: true }).click();
  const status = kiosk.getByTestId('kiosk-status');
  await expect(status).toHaveText('Tersambung');

  // The network drops. The kiosk still answers every scan from its morning download.
  await kioskContext.setOffline(true);
  const feedback = kiosk.getByTestId('kiosk-feedback');
  for (const card of [first, second, third]) {
    const at = await scan(kiosk, card);
    await expect(feedback).toContainText(arrivalLabel(at));
  }
  await kiosk.clock.fastForward(6_000);
  await scan(kiosk, first);
  await expect(feedback).toContainText('Sudah tercatat');
  await expect(status).toHaveText('Offline · antrean 4');

  // An hour without network: the queue waits.
  await kiosk.clock.fastForward('01:00:00');
  await expect(status).toContainText('antrean 4');

  // Back online. The first answer is lost after the server stored the batch; the resend must not double.
  let lost = false;
  await kiosk.route('**/api/v1/kiosk/scans', async (route) => {
    if (lost) return route.continue();
    lost = true;
    await route.fetch();
    await route.abort('connectionreset');
  });
  await kioskContext.setOffline(false);
  await expect.poll(() => lost).toBe(true);
  await kiosk.clock.fastForward(16_000);
  await expect(status).toHaveText('Tersambung');

  await page.goto('/gerbang');
  const summary = page.getByLabel('Ringkasan');
  await expect(summary).toContainText('3 sudah datang');
  await expect(summary).toContainText(`${cards.length - 3} belum datang`);

  // A student without a phone: piket records the arrival with a reason.
  const someone = page.getByRole('listitem', { name: /^Belum datang / }).first();
  await someone.getByRole('button', { name: 'Catat datang' }).click();
  await someone.getByLabel('Alasan tanpa kartu').fill('HP orang tua tertinggal');
  await someone.getByRole('button', { name: 'Simpan kedatangan' }).click();
  await expect(page.getByRole('status')).toContainText('tercatat datang pukul');
  await expect(summary).toContainText('4 sudah datang');

  // The admin sees the kiosk online with an empty queue, then revokes it: the kiosk asks for pairing.
  await page.goto('/gerbang/kios');
  const row = page.getByRole('listitem', { name: 'Kios Gerbang depan' });
  await expect(row).toContainText('Online');
  await expect(row).not.toContainText('antrean');
  page.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Cabut' }).click();
  await expect(row).toHaveCount(0);
  await kiosk.clock.fastForward(61_000);
  await expect(kiosk.getByRole('heading', { name: 'Pasang kios' })).toBeVisible();
  await expect(kiosk.getByText('Kios ini dicabut oleh admin.')).toBeVisible();
  await kioskContext.close();
});
