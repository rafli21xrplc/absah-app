import { expect, test } from '@playwright/test';
import { createSchool, onboardAdmin, randomDigits } from './helpers';

type Level = 'sd' | 'smk';

interface Case {
  level: Level;
  label: string;
  school: string;
  mbg: boolean;
  /** Text expected in the preset summary of step 2. */
  expectSummary: string;
  menuOn: string;
  menuOff: string;
  /** Spot checks of the preset (the full matrix is snapshot-tested in @absah/capabilities). */
  spot: Record<string, unknown>;
}

const cases: Case[] = [
  {
    level: 'sd',
    label: 'SD/MI',
    school: 'SD Negeri E2E',
    mbg: true,
    expectSummary: 'Penjemputan dengan penjemput resmi',
    menuOn: 'Penjemputan',
    menuOff: 'PKL',
    spot: { 'attendance.mode': 'daily', 'gate.pickup': true, 'card.holder': 'parent', 'pkl.enabled': false, 'mbg.enabled': true },
  },
  {
    level: 'smk',
    label: 'SMK/MAK',
    school: 'SMK Negeri E2E',
    mbg: false,
    expectSummary: 'Praktik Kerja Lapangan (PKL)',
    menuOn: 'PKL',
    menuOff: 'Penjemputan',
    spot: { 'attendance.mode': 'per_period', 'pkl.enabled': true, 'pkl.tracer': true, 'gate.pickup': false, 'mbg.enabled': false },
  },
];

for (const c of cases) {
  test(`setup wizard for ${c.level.toUpperCase()} ends with the ${c.level} preset`, async ({ page }) => {
    const { schoolId, inviteUrl, email } = createSchool(`${c.school} (draf)`);
    await onboardAdmin(page, inviteUrl, email);

    // 1. Profile
    await expect(page.getByRole('heading', { name: 'Profil sekolah' })).toBeVisible();
    await page.getByLabel('Nama sekolah').fill(c.school);
    await page.getByLabel('NPSN').fill(randomDigits(8));
    await page.getByLabel('Zona waktu').selectOption('Asia/Jakarta');
    await page.getByRole('button', { name: 'Simpan dan lanjut' }).click();

    // 2. Level, with the feature summary shown before saving
    await expect(page.getByRole('heading', { name: 'Jenjang sekolah' })).toBeVisible();
    await page.getByRole('radio', { name: c.label }).check();
    await page.getByRole('radio', { name: 'Bukan' }).check();
    await expect(page.getByTestId('preset-summary')).toContainText(c.expectSummary);
    await page.getByRole('button', { name: 'Simpan dan lanjut' }).click();

    // 3. MBG
    await expect(page.getByRole('heading', { name: 'Penerima Makan Bergizi Gratis?' })).toBeVisible();
    await page.getByRole('radio', { name: c.mbg ? 'Ya' : 'Tidak' }).check();
    await page.getByRole('button', { name: 'Simpan dan lanjut' }).click();

    // 4. Import (skipped; the import flow arrives in prompt 2.1)
    await expect(page.getByRole('heading', { name: 'Data siswa' })).toBeVisible();
    await expect(page.getByText('Import dari Dapodik')).toBeVisible();
    await page.getByRole('button', { name: 'Lewati dulu' }).click();

    // 5. Gate
    await expect(page.getByRole('heading', { name: 'Presensi gerbang' })).toBeVisible();
    await page.getByRole('radio', { name: 'Tidak' }).check();
    await page.getByRole('button', { name: 'Simpan dan lanjut' }).click();

    // 6. Invite one teacher, then finish
    await expect(page.getByRole('heading', { name: 'Undang staf' })).toBeVisible();
    await page.getByLabel('Nama').fill('Guru E2E');
    await page.getByRole('textbox', { name: 'Email' }).fill(`guru-${randomDigits(10)}@test.local`);
    await page.getByLabel('Peran').selectOption('guru');
    await page.getByRole('button', { name: 'Undang' }).click();
    await expect(page.getByRole('list', { name: 'Sudah diundang' })).toContainText('/undangan#');
    await page.getByRole('button', { name: 'Selesai' }).click();

    // Home with the menu filtered by capabilities
    await expect(page.getByRole('heading', { name: 'Halo, Admin E2E' })).toBeVisible();
    // The side menu repeats the school name, so look inside the page itself.
    await expect(page.getByRole('main').getByText(c.school)).toBeVisible();
    await expect(page.getByRole('main').getByRole('navigation', { name: 'Menu', exact: true }).getByText(c.menuOn, { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('navigation', { name: 'Menu', exact: true }).getByText(c.menuOff, { exact: true })).toHaveCount(0);

    // Every capability equals the level preset, except the MBG answer; nothing is pending.
    const res = await page.request.get('/api/v1/school/capabilities', { headers: { 'x-school-id': schoolId } });
    expect(res.ok()).toBe(true);
    const { items } = (await res.json()) as {
      items: { key: string; preset: unknown; effective: unknown; pending: unknown; override: unknown }[];
    };
    for (const item of items) {
      const expected = item.key === 'mbg.enabled' && c.mbg ? true : item.preset;
      expect(item.effective, item.key).toEqual(expected);
      expect(item.pending, item.key).toBeNull();
    }
    const effective = Object.fromEntries(items.map((i) => [i.key, i.effective]));
    expect(effective).toMatchObject(c.spot);
    const me = await page.request.get('/api/v1/me/context', { headers: { 'x-school-id': schoolId } });
    expect(((await me.json()) as { active: { capabilities: unknown } }).active.capabilities).toEqual(effective);

    // Setup is finished and kept on the server.
    const setup = await page.request.get('/api/v1/school/setup', { headers: { 'x-school-id': schoolId } });
    expect(((await setup.json()) as { completedAt: string | null }).completedAt).not.toBeNull();
  });
}
