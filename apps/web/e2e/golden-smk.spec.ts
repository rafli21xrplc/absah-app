import { expect, test, type Browser, type Page } from '@playwright/test';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, onboardAdmin, otpLogin, randomDigits, TINY_PNG } from './helpers';

const DUDI = { latitude: -6.2383, longitude: 106.9756 };
// About 900 m north of the DUDI gate: outside the 150 m radius.
const FAR = { latitude: -6.2302, longitude: 106.9756 };

/** The student's own login number, as staff type it on /siswa/kontak. */
async function setStudentPhone(page: Page, student: string, phone: string) {
  await page.goto('/siswa');
  await page.getByRole('link', { name: `Kontak WhatsApp ${student}` }).click();
  await page.getByRole('textbox', { name: /^WhatsApp siswa/ }).fill(phone);
  await page.getByRole('button', { name: 'Simpan kontak' }).click();
  await expect(page.getByText('Kontak tersimpan.')).toBeVisible();
}

/** A phone at a given place: geolocation granted, the browser reports that point. */
async function phoneAt(browser: Browser, point: { latitude: number; longitude: number }): Promise<Page> {
  const context = await browser.newContext({ geolocation: { ...point, accuracy: 15 }, permissions: ['geolocation'] });
  return context.newPage();
}

/** Today's opening time so that a check-in now is on time: half an hour from now (school clock). */
function openingSoon(): { day: string; startsAt: string; late: boolean } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(Date.now() + 30 * 60_000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = { Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab', Sun: 'Min' }[get('weekday')] ?? 'Sen';
  const startsAt = `${get('hour')}:${get('minute')}`;
  // Past 23.29 the opening would wrap to tomorrow: open at midnight instead, so the check-in is late (T).
  return startsAt < '00:30' ? { day, startsAt: '00:00', late: true } : { day, startsAt, late: false };
}

test('SMK: DUDI dan penempatan, check-in di lokasi dikonfirmasi pembimbing industri sekali klik, check-in di luar radius diputuskan guru pembimbing, jurnal disetujui', async ({ page, browser }) => {
  test.slow();
  await createSchoolWithStudents(page);
  const aditya = `0813${randomDigits(8)}`;
  const bunga = `0813${randomDigits(8)}`;
  const mentor = `0814${randomDigits(8)}`;
  await setStudentPhone(page, 'ADITYA PRATAMA', aditya);
  await setStudentPhone(page, 'BUNGA LESTARI', bunga);

  // Humas PKL work (here the admin): the DUDI with its gate point and today's hours.
  const opening = openingSoon();
  await page.goto('/pkl');
  await page.getByRole('link', { name: 'Mitra DUDI' }).click();
  await page.getByRole('button', { name: 'Tambah DUDI' }).click();
  await page.getByLabel('Nama DUDI').fill('PT Maju Jaya');
  await page.getByLabel('Alamat').fill('Jl. Industri 12, Bekasi');
  await page.getByLabel('Titik lokasi').fill(`${DUDI.latitude}, ${DUDI.longitude}`);
  const today = page.getByRole('checkbox', { name: opening.day, exact: true });
  if (!(await today.isChecked())) await today.check();
  await page.getByLabel(`Mulai ${opening.day}`).fill(opening.startsAt);
  await page.getByLabel(`Selesai ${opening.day}`).fill('23:59');
  await page.getByRole('button', { name: 'Simpan DUDI' }).click();
  await expect(page.getByRole('row', { name: /PT Maju Jaya/ })).toContainText('150 m');

  // Aditya and Bunga go to PT Maju Jaya with the admin as guru pembimbing and a pembimbing industri.
  await page.goto('/pkl/penempatan');
  await page.getByRole('combobox', { name: 'DUDI', exact: true }).selectOption({ label: 'PT Maju Jaya' });
  for (const name of ['ADITYA', 'BUNGA']) {
    await page.getByLabel('Cari siswa').fill(name);
    await page.getByRole('button', { name: new RegExp(`^\\+ ${name}`) }).click();
  }
  // Ends in 10 days: the DUDI assessment form opens 14 days before the end (PKL-04).
  const end = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel('Selesai').fill(end);
  await page.getByLabel('Guru pembimbing').selectOption({ label: 'Admin E2E' });
  await page.getByLabel('Nama pembimbing industri (boleh nanti)').fill('Pak Hendra');
  await page.getByLabel('Nomor WhatsApp pembimbing industri').fill(mentor);
  await page.getByRole('button', { name: 'Tempatkan 2 siswa' }).click();
  await expect(page).toHaveURL(/\/pkl$/);
  await expect(page.getByRole('row', { name: /ADITYA PRATAMA/ })).toContainText('Pak Hendra');

  // Aditya checks in at the gate and writes the day's journal with a photo.
  const adityaPhone = await phoneAt(browser, DUDI);
  await otpLogin(adityaPhone, aditya, '/portal/pkl');
  await expect(adityaPhone.getByText('PT Maju Jaya')).toBeVisible();
  await adityaPhone.getByRole('button', { name: 'Check-in sekarang' }).click();
  await expect(adityaPhone.getByRole('status').filter({ hasText: /^Datang/ })).toContainText('Menunggu pembimbing industri');
  await adityaPhone.getByLabel('Kegiatan').fill('Memasang kabel LAN di lantai 2 bersama teknisi.');
  await adityaPhone.getByLabel('Foto atau PDF (boleh kosong)').setInputFiles({ name: 'kerja.png', mimeType: 'image/png', buffer: TINY_PNG });
  await adityaPhone.getByRole('button', { name: 'Kirim jurnal' }).click();
  await expect(adityaPhone.getByText('Jurnal hari ini tersimpan.')).toBeVisible();

  // Bunga presses check-in 900 m away: it goes to the guru pembimbing, not the industry supervisor.
  const bungaPhone = await phoneAt(browser, FAR);
  await otpLogin(bungaPhone, bunga, '/portal/pkl');
  await bungaPhone.getByRole('button', { name: 'Check-in sekarang' }).click();
  await expect(bungaPhone.getByRole('status').filter({ hasText: /^Datang/ })).toContainText('di luar radius');

  // Pak Hendra (WhatsApp OTP) sees statuses only and confirms Aditya with one tap, then the journal.
  const hendra = await (await browser.newContext()).newPage();
  await otpLogin(hendra, mentor, '/dudi');
  const students = hendra.getByRole('list', { name: 'Siswa PKL' });
  await expect(students.getByRole('listitem', { name: 'BUNGA LESTARI' })).toContainText('Perlu ditinjau guru');
  await expect(students).not.toContainText(/-6\.2|106\.9| m dari/);
  await hendra.getByRole('button', { name: 'Konfirmasi 1 siswa hadir' }).click();
  await expect(students.getByRole('listitem', { name: 'ADITYA PRATAMA' })).toContainText(opening.late ? 'Terlambat' : 'Hadir');
  await hendra.getByRole('link', { name: 'Jurnal siswa' }).click();
  const journal = hendra.getByRole('listitem', { name: /Jurnal ADITYA PRATAMA/ });
  await expect(journal.getByRole('button', { name: 'Lihat lampiran' })).toBeVisible();
  await journal.getByRole('button', { name: 'Setujui' }).click();
  await expect(journal).toContainText('Disetujui');

  // PKL-04: the humas sets the aspects, Pak Hendra grades Aditya near the end of the placement, the results download as Excel.
  await page.goto('/pkl/penilaian');
  await page.getByRole('button', { name: 'Tambah aspek' }).click();
  await page.getByLabel('Nama aspek 1').fill('Disiplin');
  await page.getByLabel('Bobot aspek 1').fill('2');
  await page.getByRole('button', { name: 'Tambah aspek' }).click();
  await page.getByLabel('Nama aspek 2').fill('Keterampilan teknis');
  await page.getByRole('button', { name: 'Simpan aspek' }).click();
  await expect(page.getByText('Aspek penilaian tersimpan.')).toBeVisible();
  await hendra.goto('/dudi/penilaian');
  await hendra.getByRole('listitem', { name: 'ADITYA PRATAMA' }).getByRole('link', { name: 'Isi penilaian' }).click();
  await hendra.getByLabel('Disiplin (0-100)').fill('90');
  await hendra.getByLabel('Keterampilan teknis (0-100)').fill('70');
  await hendra.getByRole('button', { name: 'Simpan penilaian' }).click();
  await expect(hendra.getByText('Penilaian tersimpan.')).toBeVisible();
  await page.goto('/pkl/penilaian');
  await expect(page.getByRole('row', { name: /ADITYA PRATAMA/ })).toContainText('83,3'); // (90 x 2 + 70 x 1) / 3
  const results = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Unduh Excel' }).click();
  expect((await results).suggestedFilename()).toMatch(/^penilaian-dudi-\d{4}-\d{2}-\d{2}\.xlsx$/);

  // The guru pembimbing decides Bunga's day; the queue is then empty.
  await page.goto('/pkl/tinjauan');
  const item = page.getByRole('listitem', { name: /BUNGA LESTARI/ });
  await expect(item).toContainText('di luar radius');
  await item.getByRole('button', { name: 'Hadir' }).click();
  await expect(page.getByText('Tidak ada yang perlu ditinjau.')).toBeVisible();

  // Both students see their day's status.
  await adityaPhone.reload();
  await expect(adityaPhone.getByRole('status').filter({ hasText: /^Datang/ })).toContainText(opening.late ? 'Terlambat' : 'Hadir');
  await expect(adityaPhone.getByRole('listitem', { name: /Jurnal ADITYA PRATAMA/ })).toContainText('Disetujui');
  await bungaPhone.reload();
  await expect(bungaPhone.getByRole('status').filter({ hasText: /^Datang/ })).toContainText('Hadir');
});

async function createSchoolWithStudents(page: Page) {
  const { inviteUrl, email } = createSchool('SMK Golden E2E', 'smk');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
}
