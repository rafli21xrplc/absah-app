import { expect, test } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

// Ctrl+K (RF1): one search for the staff area. It opens pages the person can reach and does the small things (theme, sign out)
// without going through the menu. Opened with the keyboard on a laptop and with the Cari button on a phone.
test('pencarian: Ctrl+K membuka halaman, mengganti tema, dan menutup dengan Escape', async ({ page, isMobile }, info) => {
  const { inviteUrl, email } = createSchool('SMK Cari E2E', 'smk');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/dasbor');
  await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible();

  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/dasbor-${info.project.name}.png` });
  const open = async () => {
    if (isMobile) await page.getByRole('button', { name: 'Buka pencarian' }).click();
    else await page.keyboard.press('Control+k');
    return page.getByRole('dialog', { name: 'Pencarian' });
  };

  // A page, found by a word that is not in its label but in its keywords is not needed: the label itself is enough.
  let palette = await open();
  await expect(palette.getByRole('combobox')).toBeFocused();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/palet-${info.project.name}.png` });
  await palette.getByRole('combobox').fill('rekap');
  await expect(palette.getByRole('option', { name: /Rekap dan ekspor/ })).toBeVisible();
  await expect(palette.getByRole('option', { name: /Jadwal pelajaran/ })).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/rekap$/);
  await expect(palette).toHaveCount(0);

  // An action: the theme, by a word of its own.
  palette = await open();
  await palette.getByRole('combobox').fill('gelap');
  await palette.getByRole('option', { name: /Tampilan: Gelap/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Escape closes it and nothing else happens.
  palette = await open();
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
  await expect(page).toHaveURL(/\/rekap$/);

  // Nothing matches: it says so.
  palette = await open();
  await palette.getByRole('combobox').fill('zzzzqq');
  await expect(palette.getByText('Tidak ada yang cocok.')).toBeVisible();
});

test('pencarian: kolom Cari di atas halaman (laptop) membuka palet yang sama', async ({ page, isMobile }) => {
  test.skip(isMobile, 'di HP tombol Cari ada di bilah atas (tes sebelumnya)');
  const { inviteUrl, email } = createSchool('SMK Kolom E2E', 'smk');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/dasbor');
  await page.getByRole('button', { name: /Cari halaman/ }).click();
  await expect(page.getByRole('dialog', { name: 'Pencarian' })).toBeVisible();
});
