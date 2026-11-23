import { expect, test } from '@playwright/test';
import { createSchool, lastMessage, onboardAdmin, randomDigits } from './helpers';

test('Tracer study: BKK menambah alumni dan mengundang, alumni mengisi lewat tautan, rekap BMW terbarui (PKL-05)', async ({ page, browser }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMK Tracer E2E', 'smk');
  await onboardAdmin(page, inviteUrl, email);

  // Open it directly: the home page sends an admin of a school still in setup to /setup.
  await page.goto('/pkl/tracer');
  await expect(page.getByText('Belum ada alumni.')).toBeVisible();

  const year = new Date().getFullYear();
  const add = page.getByRole('form', { name: 'Tambah alumni' });
  await add.getByLabel('Nama', { exact: true }).fill('Rina Maharani Putri');
  await add.getByLabel('Angkatan (tahun lulus)').fill(String(year));
  await add.getByLabel(/Nomor WhatsApp/).fill(`0812${randomDigits(8)}`);
  await add.getByRole('button', { name: 'Tambah alumni' }).click();
  await expect(page.getByText('Alumni ditambahkan.')).toBeVisible();
  await expect(page.getByRole('row', { name: /Rina Maharani Putri/ })).toContainText('Belum mengisi');

  // The invitation goes through the worker: nothing is sent from the request.
  const invite = page.getByRole('form', { name: 'Kirim undangan' });
  await invite.getByLabel('Angkatan').selectOption(String(year));
  await invite.getByRole('button', { name: 'Kirim undangan' }).click();
  await expect(page.getByText('1 undangan dikirim lewat WhatsApp.')).toBeVisible();

  let link: string | null = null;
  await expect
    .poll(
      () => {
        const message = lastMessage(schoolId);
        link = message?.templateCode === 'tracer_invitation' ? message.link : null;
        return link;
      },
      { timeout: 60_000 },
    )
    .not.toBeNull();

  // The alumnus has no account: a fresh browser context opens the link.
  const context = await browser.newContext();
  const alumnus = await context.newPage();
  await alumnus.goto(link ?? '');
  await expect(alumnus.getByRole('heading', { name: 'Halo Rina, apa kabar?' })).toBeVisible();
  await expect(alumnus.getByText('Maharani')).toHaveCount(0); // first name only
  await alumnus.getByLabel('Bekerja', { exact: true }).check();
  await alumnus.getByLabel('Nama perusahaan').fill('PT Maju E2E');
  await alumnus.getByRole('button', { name: 'Kirim' }).click();
  await expect(alumnus.getByText(/Terima kasih, jawaban Anda sudah tersimpan/)).toBeVisible();
  await context.close();

  await page.reload();
  const row = page.getByRole('row', { name: /Rina Maharani Putri/ });
  await expect(row).toContainText('Bekerja: PT Maju E2E');
  await expect(row).toContainText('Diisi alumni');
  await expect(page.getByRole('row', { name: new RegExp(`^${year}`) }).first()).toContainText('100,0%');
});
