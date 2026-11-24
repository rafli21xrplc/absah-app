import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DAPODIK_FIXTURES } from './env';
import { createSchool, fillSession, generateSessions, onboardAdmin, otpLogin, randomDigits } from './helpers';

/** ISO weekday (1 = Senin) of today in Jakarta: the lessons are put on today, whatever day CI runs. */
const todayIsoDay = () => {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(new Date());
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day) + 1;
};

test('SMP: presensi per jam pelajaran, lalu siswa mengisi jurnal 7 kebiasaan dan wali kelas melihat rekap minggu ini', async ({ page, browser }) => {
  test.slow();
  const { schoolId, inviteUrl, email } = createSchool('SMP Golden E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/import');
  await page.getByLabel('Berkas Daftar Peserta Didik (.xlsx)').setInputFiles(path.join(DAPODIK_FIXTURES, 'daftar-pd-awal.xlsx'));
  await page.getByRole('button', { name: 'Unggah dan periksa' }).click();
  await page.getByRole('button', { name: 'Terapkan 10 perubahan' }).click({ timeout: 60_000 });
  await expect(page.getByText(/Import diterapkan ke tahun ajaran/)).toBeVisible();
  await page.goto('/jadwal');
  await page.getByRole('tab', { name: 'Wali kelas' }).click(); // per_period opens on the timetable
  await page.getByLabel('Wali kelas VII A').selectOption({ label: 'Admin E2E' });
  await expect(page.getByText('Wali kelas VII A: Admin E2E.')).toBeVisible();

  // Two lessons for VII A today (the schedule UI has its own spec, jadwal.spec.ts).
  const headers = { 'x-school-id': schoolId };
  const write = (method: 'post' | 'put', url: string, data: object) => page.request[method](url, { headers: { ...headers, 'idempotency-key': randomUUID() }, data });
  const day = todayIsoDay();
  expect((await write('put', '/api/v1/schedule/periods', { days: [{ day, periods: [{ number: 1, startsAt: '00:00', endsAt: '11:59' }, { number: 2, startsAt: '12:00', endsAt: '23:59' }] }] })).ok()).toBe(true);
  const me = (await (await page.request.get('/api/v1/me/context', { headers })).json()) as { user: { id: string } };
  const classes = (await (await page.request.get('/api/v1/classes', { headers })).json()) as { items: { id: string; name: string }[] };
  const viiA = classes.items.find((c) => c.name === 'VII A')?.id ?? '';
  for (const [period, name] of [[1, 'Matematika'], [2, 'IPA']] as const) {
    const subject = (await (await write('post', '/api/v1/subjects', { name })).json()) as { id: string };
    expect((await write('put', '/api/v1/schedule/slots', { ownerType: 'class', ownerId: viiA, day, period, subjectId: subject.id, teacherId: me.user.id })).ok()).toBe(true);
  }

  // Sessions per jam pelajaran: the Matematika teacher fills the first one.
  generateSessions(schoolId);
  await page.goto('/hari-ini');
  await expect(page.getByRole('link', { name: /VII A · IPA/ })).toBeVisible();
  await page.getByRole('link', { name: /VII A · Matematika/ }).click();
  await fillSession(page, [{ name: 'DIMAS ANGGARA', status: 'Alpa' }]);

  // Aditya gets his own login; in SMP he keeps the habits journal himself.
  const studentPhone = `0812${randomDigits(8)}`;
  await page.goto('/siswa');
  await page.getByRole('link', { name: 'Kontak WhatsApp ADITYA PRATAMA' }).click();
  await page.getByLabel(/WhatsApp siswa/).fill(studentPhone);
  await page.getByRole('button', { name: 'Simpan kontak' }).click();
  await expect(page.getByText('Kontak tersimpan.')).toBeVisible();

  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await otpLogin(student, studentPhone, '/portal');
  await student.getByRole('link', { name: /7 Kebiasaan Anak Indonesia Hebat/ }).click();
  const today = student.getByRole('group').first(); // newest first: today
  await today.getByLabel('Bangun pagi').check();
  await today.getByLabel('Gemar belajar').check();
  await today.getByRole('button', { name: 'Simpan' }).click();
  await expect(today.getByText('Tersimpan.')).toBeVisible();
  await student.reload();
  await expect(student.getByRole('group').first().getByLabel('Gemar belajar')).toBeChecked();
  await studentContext.close();

  // The wali kelas sees this week per student.
  await page.goto('/kebiasaan');
  await page.getByLabel('Rombel').selectOption({ label: 'VII A' });
  const row = page.getByRole('row', { name: /ADITYA PRATAMA/ });
  await expect(row).toContainText('1/7');
  await expect(page.getByRole('row', { name: /BUNGA LESTARI/ })).toContainText('0/7');
});
