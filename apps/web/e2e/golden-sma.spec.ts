import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, fillSession, generateSessions, onboardAdmin } from './helpers';

/** ISO weekday (1 = Senin) of today in Jakarta: the lesson is put on today, whatever day CI runs. */
const todayIsoDay = () => {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(new Date());
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day) + 1;
};

test('SMA: kelompok belajar lintas rombel, sesi kelompok, jam siswa, dan rekap kembali ke rombel asal', async ({ page }) => {
  test.slow();
  const { schoolId, inviteUrl, email } = createSchool('SMA Golden E2E', 'sma');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();

  // One jam pelajaran all day today and the mapel Fisika (the schedule UI has its own spec).
  const headers = { 'x-school-id': schoolId };
  const write = (method: 'post' | 'put', url: string, data: object) => page.request[method](url, { headers: { ...headers, 'idempotency-key': randomUUID() }, data });
  const day = todayIsoDay();
  expect((await write('put', '/api/v1/schedule/periods', { days: [{ day, periods: [{ number: 1, startsAt: '00:00', endsAt: '23:59' }] }] })).ok()).toBe(true);
  expect((await write('post', '/api/v1/subjects', { name: 'Fisika' })).ok()).toBe(true);

  // Mapel pilihan: Fisika A takes Aditya from VII A and Eka from VII B.
  await page.goto('/jadwal');
  await page.getByRole('tab', { name: 'Wali kelas' }).click();
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();
  await page.getByRole('tab', { name: 'Kelompok belajar' }).click();
  const form = page.getByRole('form', { name: 'Kelompok baru' });
  await form.getByLabel('Nama kelompok').fill('Fisika A');
  await form.getByRole('combobox', { name: 'Mapel', exact: true }).selectOption({ label: 'Fisika' });
  await form.getByRole('combobox', { name: 'Guru', exact: true }).selectOption({ label: 'Admin E2E' });
  await form.getByRole('button', { name: 'Buat kelompok' }).click();
  const members = page.getByRole('region', { name: 'Anggota Fisika A' });
  await members.getByLabel('Tambah dari rombel').selectOption({ label: 'VII A' });
  await members.getByRole('checkbox', { name: 'ADITYA PRATAMA' }).check();
  await members.getByLabel('Tambah dari rombel').selectOption({ label: 'VII B' });
  await members.getByRole('checkbox', { name: 'EKA PUTRI RAHAYU' }).check();
  await members.getByRole('button', { name: 'Simpan anggota' }).click();
  await expect(members.getByText('Anggota tersimpan: 2 siswa.')).toBeVisible();
  await expect(page.getByRole('row', { name: /Fisika A/ })).toContainText('2');

  // The group's lesson today, then its session: Aditya is alpa there.
  const groups = (await (await page.request.get('/api/v1/learning-groups', { headers })).json()) as { items: { id: string; subject: { id: string } }[] };
  const group = groups.items[0];
  const me = (await (await page.request.get('/api/v1/me/context', { headers })).json()) as { user: { id: string } };
  expect((await write('put', '/api/v1/schedule/slots', { ownerType: 'group', ownerId: group?.id, day, period: 1, subjectId: group?.subject.id, teacherId: me.user.id })).ok()).toBe(true);
  generateSessions(schoolId);
  await page.goto('/hari-ini');
  await page.getByRole('link', { name: /Fisika A · Fisika/ }).click();
  await fillSession(page, [{ name: 'ADITYA PRATAMA', status: 'Alpa' }]);

  // The wali kelas of VII A sees the group lesson in each student's day.
  await page.goto('/jam-siswa');
  await page.getByLabel('Rombel').selectOption({ label: 'VII A' });
  await expect(page.getByRole('columnheader', { name: 'Jam 1 · Fisika · Fisika A' })).toBeVisible();
  await expect(page.getByRole('row', { name: /ADITYA PRATAMA/ })).toContainText('Alpa');
  await expect(page.getByRole('row', { name: /BUNGA LESTARI/ })).toContainText('—');

  // The rekap counts the group session in the home rombel: one A in VII A, none in VII B.
  await page.goto('/rekap');
  const cells = (rombel: string) => page.getByRole('row', { name: new RegExp(`^${rombel}`) }).getByRole('cell');
  await expect(cells('VII A').nth(6)).toHaveText('1');
  await expect(cells('VII B').nth(6)).toHaveText('0');
  await expect(cells('VII B').nth(3)).toHaveText('100%');
});
