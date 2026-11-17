import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { KIOSK_URL } from './env';
import { createSchool, onboardAdmin } from './helpers';

test('Buku tamu di kios: tamu mengisi form, orang yang dituju dicatat, kios offline tidak mencatat ganda', async ({ page, browser }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMP Buku Tamu E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  const enabled = await page.request.put('/api/v1/school/capabilities', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { values: { 'gate.enabled': true } },
  });
  expect(enabled.ok()).toBe(true);

  await page.goto('/gerbang');
  await page.getByRole('link', { name: 'Kelola kios gerbang' }).click();
  await page.getByRole('button', { name: 'Buat kode pasang' }).click();
  await expect(page.getByRole('img', { name: 'QR kode pasang kios' })).toBeVisible();
  const pairingCode = (await page.getByTestId('pairing-code').textContent())?.trim() ?? '';

  const kioskContext = await browser.newContext({ serviceWorkers: 'block' });
  const kiosk = await kioskContext.newPage();
  await kiosk.goto(KIOSK_URL);
  await kiosk.getByLabel('Kode pasang').fill(pairingCode);
  await kiosk.getByLabel('Nama kios').fill('Gerbang depan');
  await kiosk.getByRole('button', { name: 'Pasang', exact: true }).click();
  await expect(kiosk.getByTestId('kiosk-status')).toHaveText('Tersambung');

  // The guest book button appears once the kiosk knows the school uses it.
  await kiosk.getByRole('button', { name: 'Tamu' }).click({ timeout: 15_000 });
  await expect(kiosk.getByRole('heading', { name: 'Buku tamu' })).toBeVisible();
  await kiosk.getByRole('button', { name: 'Kirim' }).click();
  await expect(kiosk.getByText('Tulis nama Anda.')).toBeVisible();

  await kiosk.getByLabel('Nama', { exact: true }).fill('Pak Hendra');
  await kiosk.getByLabel('Instansi (boleh dikosongkan)').fill('Dinas Pendidikan');
  await kiosk.getByLabel('Tujuan kunjungan').fill('Monitoring BOS');
  await kiosk.getByLabel('Bertemu dengan (boleh dikosongkan)').selectOption({ label: 'Admin E2E' });

  // The connection drops: the form says so, keeps what was typed, and nothing is recorded.
  await kioskContext.setOffline(true);
  await kiosk.getByRole('button', { name: 'Kirim' }).click();
  await expect(kiosk.getByText('Tidak ada sambungan internet')).toBeVisible();
  await expect(kiosk.getByLabel('Nama', { exact: true })).toHaveValue('Pak Hendra');
  await kioskContext.setOffline(false);
  await kiosk.getByRole('button', { name: 'Kirim' }).click();
  await expect(kiosk.getByText('Terima kasih. Admin E2E sudah diberi tahu.')).toBeVisible();

  // Exactly one visit, with the host, still inside.
  const list = await page.request.get('/api/v1/visitors', { headers: { 'x-school-id': schoolId } });
  expect(list.ok()).toBe(true);
  const body = (await list.json()) as { inside: number; items: { name: string; organization: string | null; host: { name: string } | null; leftAt: string | null }[] };
  expect(body.inside).toBe(1);
  expect(body.items).toMatchObject([{ name: 'Pak Hendra', organization: 'Dinas Pendidikan', host: { name: 'Admin E2E' }, leftAt: null }]);

  // Back to scanning after the thank-you.
  await kiosk.getByRole('button', { name: 'Selesai' }).click();
  await expect(kiosk.getByTestId('kiosk-feedback')).toBeVisible();
  await kioskContext.close();
});
