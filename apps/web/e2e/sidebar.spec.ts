import { expect, test } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

// The staff side menu: brand and school on top, menu groups that fold, the account and Keluar pinned at the foot.
test('laptop: menu samping punya merek, sekolah, grup yang bisa dilipat, dan akun dengan Keluar', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'di HP menu ada di lembar Menu (tes berikutnya)');
  const { inviteUrl, email } = createSchool('SMK Samping E2E', 'smk');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/dasbor');
  await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible();
  const aside = page.locator('aside');
  await expect(aside.getByText('Absah', { exact: true })).toBeVisible();
  await expect(aside.getByText('SMK Samping E2E')).toBeVisible();
  const menu = aside.getByRole('navigation', { name: 'Menu utama' });
  await expect(menu.getByRole('link', { name: 'Dasbor sekolah' })).toHaveAttribute('aria-current', 'page');

  // Groups other than the one holding the current page start shut; a tap opens one, and a visit keeps it open.
  const data = menu.getByRole('button', { name: 'DATA SEKOLAH' });
  await expect(data).toHaveAttribute('aria-expanded', 'false');
  await expect(menu.getByRole('link', { name: 'Siswa', exact: true })).toHaveCount(0);
  await data.click();
  await expect(menu.getByRole('link', { name: 'Siswa', exact: true })).toBeVisible();
  await menu.getByRole('link', { name: 'Siswa', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Siswa' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Siswa', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(menu.getByRole('button', { name: 'DATA SEKOLAH' })).toHaveAttribute('aria-expanded', 'true');

  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/sidebar-menu-${info.project.name}.png` });

  // The account stays in reach at the foot, however long the menu is.
  await page.getByRole('button', { name: /Menu akun/ }).click();
  const account = page.getByRole('dialog', { name: 'Menu akun' });
  await expect(account.getByText(email)).toBeVisible();
  await expect(account.getByRole('link', { name: 'Notifikasi di HP ini' })).toBeVisible();
  await expect(account.getByRole('link', { name: 'Catatan rilis' })).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/sidebar-laptop-${info.project.name}.png` });
  await account.getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/masuk/);
});

test('HP: lembar Menu memuat menu, akun, dan Keluar', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'tes ini untuk HP');
  const { inviteUrl, email } = createSchool('SMK Lembar E2E', 'smk');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/dasbor');
  await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  const sheet = page.getByRole('dialog', { name: /Menu/ });
  await expect(sheet.getByRole('button', { name: 'LAPORAN' })).toHaveAttribute('aria-expanded', 'false');
  await expect(sheet.getByRole('link', { name: 'Notifikasi di HP ini' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/masuk/);
  void email;
});
