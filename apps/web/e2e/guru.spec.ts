import { expect, test, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { acceptInvite, createSchool, generateSessions, onboardAdmin } from './helpers';

/** Is today a school day for a school without periods (Monday to Friday on the Jakarta clock)? The API refuses check-in otherwise. */
function schoolDayToday(): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(new Date());
  return !['Sat', 'Sun'].includes(weekday);
}

async function invite(admin: Page, browser: Browser, schoolId: string, name: string, role: 'wali_kelas' | 'guru'): Promise<Page> {
  const email = `e2e-guru-${randomUUID()}@test.local`;
  const res = await admin.request.post('/api/v1/school/invitations', {
    headers: { 'x-school-id': schoolId, 'idempotency-key': randomUUID() },
    data: { name, email, role },
  });
  expect(res.ok()).toBe(true);
  const { inviteUrl } = (await res.json()) as { inviteUrl: string };
  const page = await (await browser.newContext()).newPage();
  await acceptInvite(page, inviteUrl, email);
  return page;
}

test('Guru: absen, izin disetujui, sesi tanpa pengganti tetap tampil, pengganti ditugaskan, laporan bulanan', async ({ page, browser }) => {
  const { schoolId, inviteUrl, email } = createSchool('SD Guru E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  const wali = await invite(page, browser, schoolId, 'Bu Wali', 'wali_kelas');
  await invite(page, browser, schoolId, 'Pak Pengganti', 'guru');

  // SD runs on daily sessions owned by the wali kelas: Bu Wali holds VII A today.
  await page.goto('/jadwal');
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Bu Wali' });
  await expect(page.getByText('Wali kelas VII A: Bu Wali.')).toBeVisible();
  generateSessions(schoolId);

  // Bu Wali checks in (the API only takes check-ins on school days).
  await wali.goto('/absen-guru');
  await expect(wali.getByRole('heading', { name: 'Absen guru' })).toBeVisible();
  if (schoolDayToday()) {
    await wali.getByRole('button', { name: 'Absen masuk' }).click();
    await expect(wali.getByRole('status').filter({ hasText: /^Masuk pukul \d\d\.\d\d, / })).toBeVisible();
    await wali.getByRole('button', { name: 'Absen pulang' }).click();
    await expect(wali.getByRole('status').filter({ hasText: /Pulang pukul/ })).toBeVisible();
  } else {
    await expect(wali.getByText('Hari ini bukan hari sekolah.')).toBeVisible();
    await expect(wali.getByRole('button', { name: 'Absen masuk' })).toHaveCount(0);
  }

  // She is sick today and asks for izin; nothing is covered until the admin (wakasek's role here) approves it.
  await wali.goto('/izin-guru');
  await wali.getByLabel('Alasan').fill('Demam tinggi, kata dokter istirahat');
  await wali.getByRole('button', { name: 'Kirim izin' }).click();
  await expect(wali.getByText('Izin terkirim. Wakasek akan memutuskan.')).toBeVisible();
  await expect(wali.getByRole('listitem').filter({ hasText: 'Demam tinggi' })).toContainText('Menunggu');

  await page.goto('/pengganti');
  await expect(page.getByText('Tidak ada sesi yang gurunya sedang izin.')).toBeVisible();

  await page.goto('/izin-guru');
  const waiting = page.getByRole('listitem', { name: 'Izin Bu Wali' });
  await expect(waiting).toContainText('Sakit');
  await waiting.getByRole('button', { name: 'Setujui' }).click();
  await expect(page.getByText('Tidak ada izin guru yang menunggu.')).toBeVisible();

  // The session of a teacher on izin stays on the wakasek's screen until someone covers it.
  await page.goto('/pengganti');
  const session = page.getByRole('listitem', { name: /VII A/ });
  await expect(page.getByText('1 sesi belum punya pengganti')).toBeVisible();
  await expect(session).toContainText('Bu Wali (Sakit)');
  await expect(session).toContainText('Belum ada pengganti');
  await session.getByRole('button', { name: 'Pilih pengganti' }).click();
  const candidates = session.getByRole('group', { name: 'Guru yang kosong' });
  await expect(candidates.getByRole('listitem').filter({ hasText: 'Pak Pengganti' })).toContainText('Belum mengganti bulan ini');
  await expect(candidates.getByText('Bu Wali')).toHaveCount(0);
  await candidates.getByRole('button', { name: 'Tugaskan Pak Pengganti' }).click();
  await expect(session).toContainText('Pengganti: Pak Pengganti');
  await expect(page.getByText('1 sesi belum punya pengganti')).toHaveCount(0);

  // The kepala sekolah's monthly report counts both teachers and the substitution.
  await page.goto('/laporan-guru');
  await expect(page.getByRole('heading', { name: 'Kehadiran guru' })).toBeVisible();
  const row = page.getByRole('row', { name: /Pak Pengganti/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell').last()).toHaveText('1');
  await page.getByRole('button', { name: 'Rincian Bu Wali' }).click();
  await expect(page.getByRole('heading', { name: 'Bu Wali' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Rincian harian' })).toBeVisible();
  await page.getByRole('button', { name: '← Semua guru' }).click();
  await expect(page.getByRole('table', { name: /Kehadiran guru/ })).toBeVisible();
});
