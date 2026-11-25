import { expect, test } from '@playwright/test';
import { choose, createSchool, onboardAdmin } from './helpers';

test('TPPK: admin menunjuk tim, laporan anonim hanya untuk anggota, kode lacak mengikuti penanganan', async ({ page, browser }) => {
  const { schoolId, inviteUrl, email } = createSchool('SMP Lapor E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);

  // Not on the team yet: even the admin cannot open reports.
  const refused = await page.request.get('/api/v1/tppk/reports', { headers: { 'x-school-id': schoolId } });
  expect(refused.status()).toBe(403);

  // The admin forms the team (just themself here: below 3 is warned, not refused) and prints the poster.
  await page.goto('/tppk/tim');
  await expect(page.getByText('Belum ada anggota.')).toBeVisible();
  await page.getByRole('group', { name: 'Pilih anggota TPPK' }).getByLabel('Admin E2E').check();
  await page.getByRole('button', { name: 'Simpan tim' }).click();
  await expect(page.getByText('Tim TPPK tersimpan.')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('minimal 3 orang. Saat ini 1.');
  await expect(page.getByRole('img', { name: 'QR kanal lapor TPPK' })).toBeVisible();
  const posterLink = ((await page.getByTestId('report-link').textContent()) ?? '').trim();
  expect(posterLink).toContain(`/lapor?s=${schoolId}`);

  // A student on a phone, not signed in, from the poster.
  const context = await browser.newContext();
  const student = await context.newPage();
  await student.goto(posterLink);
  await expect(student.getByRole('heading', { name: 'Lapor ke TPPK' })).toBeVisible();
  await expect(student.getByText('SMP Lapor E2E')).toBeVisible();
  await student.getByRole('button', { name: 'Kirim laporan' }).click();
  await expect(student.getByText('Pilih jenis kejadian.')).toBeVisible();
  await student.getByLabel('Perundungan').check();
  await student.getByLabel('Ceritakan kejadiannya').fill('Saya diejek terus di grup kelas dan tidak diajak bermain sejak awal semester.');
  await choose(student.getByLabel('Saya adalah'), { label: 'Siswa' });
  await expect(student.getByLabel('Kirim tanpa nama')).toBeChecked();
  await student.getByRole('button', { name: 'Kirim laporan' }).click();
  await expect(student.getByRole('heading', { name: 'Laporan Anda sudah diterima' })).toBeVisible();
  const code = ((await student.getByTestId('tracking-code').textContent()) ?? '').trim();
  expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);

  await student.getByRole('link', { name: 'Lacak laporan' }).click();
  await student.getByLabel('Kode lacak').fill('ZZZZZ-ZZZZZ');
  await student.getByRole('button', { name: 'Lihat status' }).click();
  await expect(student.getByText('Kode lacak tidak ditemukan.')).toBeVisible();
  const track = async () => {
    await student.getByLabel('Kode lacak').fill(code.toLowerCase());
    await student.getByRole('button', { name: 'Lihat status' }).click();
    return student.getByRole('status', { name: 'Status laporan' });
  };
  await expect(await track()).toContainText('Diterima');

  // The team member reads it, opens a case, records a step and closes it.
  await page.goto('/tppk');
  await page.getByRole('link', { name: 'Perundungan' }).click();
  await expect(page.getByText('diejek terus di grup kelas')).toBeVisible();
  await expect(page.getByText('Anonim. Identitas pelapor tidak disimpan.')).toBeVisible();
  await page.getByLabel('Ringkasan kasus').fill('Perundungan di grup kelas 8');
  await page.getByRole('button', { name: 'Buat kasus' }).click();
  await expect(page.getByRole('heading', { name: 'Perundungan di grup kelas 8' })).toBeVisible();
  await expect(await track()).toContainText('Sedang ditangani');

  await page.getByLabel('Isi').fill('Memanggil siswa yang dilaporkan bersama wali kelas.');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByRole('list', { name: 'Riwayat penanganan' })).toContainText('Memanggil siswa yang dilaporkan');
  await choose(page.getByLabel('Jenis'), { label: 'Tutup kasus' });
  await page.getByLabel('Hasil penanganan').fill('Mediasi selesai, grup kelas diawasi wali kelas.');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Tutup kasus' }).click();
  await expect(page.getByRole('button', { name: 'Buka kembali' })).toBeVisible();
  await expect(await track()).toContainText('Selesai');

  // A wrong school id in a poster link says the channel is not available.
  await student.goto('/lapor?s=bukan-sekolah');
  await expect(student.getByRole('heading', { name: 'Kanal lapor tidak tersedia' })).toBeVisible();
  await context.close();
});
