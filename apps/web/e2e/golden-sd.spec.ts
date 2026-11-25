import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES, KIOSK_URL } from './env';
import { cardToken, choose, createSchool, fillSession, gateFixture, type GateFixture, generateSessions, lastMessage, onboardAdmin, otpLogin, randomDigits, TINY_PNG } from './helpers';

/** A USB scanner types the QR text and Enter, once the Pulang screen waits for a card again. */
async function scan(kiosk: Page, card: GateFixture['cards'][number]) {
  await expect(kiosk.getByText('Pulang: tunjukkan kartu siswa')).toBeVisible();
  const now = await kiosk.evaluate(() => Date.now());
  await kiosk.keyboard.type(cardToken(card, now));
  await kiosk.keyboard.press('Enter');
}

/** The school's WhatsApp number for a guardian, as staff type it on /siswa/kontak. */
async function setGuardianPhone(page: Page, student: string, guardian: string, phone: string, portal: boolean) {
  await page.goto('/siswa');
  await page.getByRole('link', { name: `Kontak WhatsApp ${student}` }).click();
  await page.getByRole('textbox', { name: new RegExp(`^Ibu: ${guardian}`) }).fill(phone);
  if (portal) await page.getByRole('checkbox', { name: new RegExp(`Akses portal: ${guardian}`) }).check();
  await page.getByRole('button', { name: 'Simpan kontak' }).click();
  await expect(page.getByText('Kontak tersimpan.')).toBeVisible();
}

test('SD: sesi harian dan WA alpa, orang tua mendaftarkan penjemput, kios Pulang offline, penjemput tidak terdaftar ditahan sampai orang tua mengizinkan', async ({ page, browser }) => {
  test.slow(); // the whole school day of an SD in one flow
  const { schoolId, inviteUrl, email } = createSchool('SD Golden E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  await page.goto('/jadwal');
  await choose(page.getByLabel('Wali kelas VII A'), { label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();
  // SD preset: daily attendance, penjemputan on, 7 KAIH by parents. The gate itself is the school's choice.
  const enabled = await page.request.put('/api/v1/school/capabilities', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { values: { 'gate.enabled': true } },
  });
  expect(enabled.ok()).toBe(true);

  // Aditya's mother gets a portal login; Bunga's mother only WhatsApp messages.
  const adityaMother = `0812${randomDigits(8)}`;
  const bungaMother = `0812${randomDigits(8)}`;
  await setGuardianPhone(page, 'ADITYA PRATAMA', 'SITI AMINAH', adityaMother, true);
  await setGuardianPhone(page, 'BUNGA LESTARI', 'RINA MARLINA', bungaMother, false);

  // One daily session per rombel, filled by the wali kelas: Dimas is alpa, his family has no number.
  generateSessions(schoolId);
  await page.goto('/hari-ini');
  await page.getByRole('link', { name: /VII A/ }).click();
  await fillSession(page, [{ name: 'DIMAS ANGGARA', status: 'Alpa' }, { name: 'BUNGA LESTARI', status: 'Alpa' }]);
  await expect.poll(() => lastMessage(schoolId)?.templateCode, { timeout: 30_000 }).toBe('absent_marked');

  // Aditya's mother logs in with WhatsApp and names the family driver, with a photo.
  const parentContext = await browser.newContext();
  const parent = await parentContext.newPage();
  await otpLogin(parent, adityaMother, '/portal');
  await parent.getByRole('link', { name: /Penjemput anak/ }).click();
  const children = parent.getByRole('region', { name: /^Penjemput aditya/i });
  await children.getByRole('button', { name: 'Tambah penjemput' }).click();
  await children.getByLabel('Nama penjemput').fill('Pak Darto');
  await choose(children.getByLabel('Hubungan'), 'sopir');
  await children.getByLabel('Nomor WhatsApp penjemput').fill(`0813${randomDigits(8)}`);
  await children.getByLabel('Foto wajah penjemput').setInputFiles({ name: 'darto.png', mimeType: 'image/png', buffer: TINY_PNG });
  await children.getByRole('button', { name: 'Kirim untuk disetujui' }).click();
  await expect(children.getByRole('list', { name: 'Daftar penjemput' })).toContainText('Pak Darto · Sopir');

  // The wali kelas approves him.
  await page.goto('/penjemputan');
  const queue = page.getByRole('region', { name: 'Penjemput baru dari orang tua' });
  await expect(queue).toContainText('Pak Darto');
  await queue.getByRole('button', { name: 'Lihat foto' }).click();
  await expect(queue.getByRole('img', { name: 'Foto Pak Darto' })).toBeVisible();
  await queue.getByRole('button', { name: 'Setujui' }).click();
  await expect(queue.getByText('Tidak ada yang menunggu persetujuan.')).toBeVisible();

  // The gate tablet: cards activated, paired, the morning download (roster + penjemput photos).
  const { cards } = gateFixture(schoolId);
  const students = (await (await page.request.get('/api/v1/students?q=A', { headers: { 'x-school-id': schoolId } })).json()) as { items: { id: string; name: string }[] };
  const cardOf = (name: string) => {
    const id = students.items.find((s) => s.name === name)?.id;
    const card = cards.find((c) => c.studentId === id);
    if (!card) throw new Error(`no card for ${name}`);
    return card;
  };
  await page.goto('/gerbang/kios');
  await page.getByRole('button', { name: 'Buat kode pasang' }).click();
  const pairingCode = (await page.getByTestId('pairing-code').textContent())?.trim() ?? '';
  const kioskContext = await browser.newContext({ serviceWorkers: 'block', permissions: ['camera'] });
  const kiosk = await kioskContext.newPage();
  await kiosk.goto(KIOSK_URL);
  await kiosk.getByLabel('Kode pasang').fill(pairingCode);
  await kiosk.getByLabel('Nama kios').fill('Gerbang depan');
  await kiosk.getByRole('button', { name: 'Pasang', exact: true }).click();
  const status = kiosk.getByTestId('kiosk-status');
  await expect(status).toHaveText('Tersambung');
  await kiosk.getByRole('button', { name: 'Pulang' }).click();

  // Offline at home time: the kiosk still knows Pak Darto (photo stored on the device).
  await kioskContext.setOffline(true);
  await scan(kiosk, cardOf('ADITYA PRATAMA'));
  await expect(kiosk.getByRole('heading', { name: 'Aditya · VII A' })).toBeVisible();
  await kiosk.getByRole('button', { name: /Pak Darto/ }).click();
  await expect(kiosk.getByRole('img', { name: 'Foto Pak Darto', exact: true })).toBeVisible(); // the stored photo, not the placeholder
  await kiosk.getByRole('button', { name: 'Konfirmasi' }).click();
  await expect(kiosk.getByTestId('kiosk-feedback')).toContainText('Hati-hati di jalan');
  await expect(status).toContainText('antrean 1');
  await kioskContext.setOffline(false);
  await expect(status).toHaveText('Tersambung', { timeout: 30_000 });

  // Bunga: a stranger to the school comes. Name and photo, then she waits inside.
  await scan(kiosk, cardOf('BUNGA LESTARI'));
  await expect(kiosk.getByText('Belum ada penjemput resmi yang disetujui.')).toBeVisible();
  await kiosk.getByRole('button', { name: 'Penjemput tidak terdaftar' }).click();
  await kiosk.getByLabel('Nama penjemput').fill('Om Joko');
  await kiosk.getByRole('button', { name: 'Ambil foto penjemput' }).click();
  await expect(async () => {
    await kiosk.getByRole('button', { name: 'Ambil foto', exact: true }).click({ timeout: 2_000 });
    await expect(kiosk.getByRole('img', { name: 'Foto penjemput' })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await kiosk.getByRole('button', { name: 'Minta persetujuan' }).click();
  await expect(kiosk.getByTestId('kiosk-feedback')).toContainText('Menunggu persetujuan');

  // Nothing released yet: the wali kelas sees her held.
  await page.goto('/penjemputan');
  await expect(page.getByRole('region', { name: 'Penjemput tidak terdaftar menunggu' })).toContainText('Om Joko ingin menjemput BUNGA LESTARI');

  // Bunga's mother gets WhatsApp with a link, sees who it is and allows it.
  await expect.poll(() => lastMessage(schoolId)?.templateCode, { timeout: 30_000 }).toBe('unlisted_pickup');
  const mother = await (await browser.newContext()).newPage();
  await mother.goto(lastMessage(schoolId)?.link ?? '');
  const pickups = mother.getByRole('region', { name: 'Penjemputan hari ini' });
  await expect(pickups).toContainText('Om Joko ingin menjemput Bunga');
  await pickups.getByRole('button', { name: 'Lihat foto penjemput' }).click();
  await expect(pickups.getByRole('img', { name: 'Foto Om Joko' })).toBeVisible();
  await pickups.getByRole('button', { name: 'Izinkan Bunga pulang bersama Om Joko' }).click();
  await expect(pickups).toContainText('Sudah pulang');

  // The kiosk learns it by itself.
  await expect(kiosk.getByTestId('kiosk-feedback')).toContainText('Boleh pulang', { timeout: 15_000 });
  await expect(kiosk.getByTestId('kiosk-feedback')).toContainText('disetujui orang tua');

  // Today's check-outs: both, attendance untouched (Bunga stays alpa in the morning session).
  await page.goto('/penjemputan');
  const today = page.getByRole('region', { name: 'Check-out hari ini' });
  await expect(today).toContainText('Pak Darto');
  await expect(today).toContainText('Om Joko');
  await kioskContext.close();
  await parentContext.close();
});
