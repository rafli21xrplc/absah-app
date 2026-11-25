import { color } from '@absah/ui/tokens';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

// Tampilan (TL1): the person picks Sistem, Terang or Gelap in the staff menu. The choice beats the OS, stays after a reload and
// shows no flash of the other theme. Colours are read from the page itself, so a token that stopped switching would fail here.
const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
const KAPUR = { light: rgb(color.kapur.light), dark: rgb(color.kapur.dark) };

async function openMenu(page: Page, isMobile: boolean) {
  // The choice is in the account menu: a popover under the side menu on a laptop, the end of the Menu sheet on a phone.
  // A pick leaves it open, so only open it when the switch is not on screen.
  if (await page.getByRole('button', { name: 'Gelap' }).isVisible()) return;
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  else await page.getByRole('button', { name: /Menu akun/ }).click();
  await expect(page.getByRole('button', { name: 'Gelap' })).toBeVisible();
}

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const chosen = (page: Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));

test('tampilan: pilihan Gelap dan Terang mengalahkan pengaturan sistem dan bertahan setelah dimuat ulang', async ({ page, isMobile }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const { inviteUrl, email } = createSchool('SMK Tema E2E', 'smk');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/dasbor');
  await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible();
  expect(await chosen(page)).toBeNull();
  expect(await background(page)).toBe(KAPUR.light);

  await openMenu(page, isMobile);
  await page.getByRole('button', { name: 'Gelap' }).click();
  expect(await chosen(page)).toBe('dark');
  expect(await background(page)).toBe(KAPUR.dark);

  // Reload: the inline head script sets the theme before the first paint.
  await page.reload();
  expect(await chosen(page)).toBe('dark');
  expect(await background(page)).toBe(KAPUR.dark);

  // The OS says dark, the person says Terang: the person wins.
  await page.emulateMedia({ colorScheme: 'dark' });
  await openMenu(page, isMobile);
  await page.getByRole('button', { name: 'Terang' }).click();
  expect(await chosen(page)).toBe('light');
  expect(await background(page)).toBe(KAPUR.light);

  // Sistem hands the decision back to the OS.
  await page.getByRole('button', { name: 'Sistem' }).click();
  expect(await chosen(page)).toBeNull();
  expect(await background(page)).toBe(KAPUR.dark);
});

for (const theme of ['Terang', 'Gelap'] as const) {
  test(`tampilan ${theme} tanpa pelanggaran aksesibilitas, juga bila sistem meminta sebaliknya`, async ({ page, isMobile }) => {
    await page.emulateMedia({ colorScheme: theme === 'Gelap' ? 'light' : 'dark' });
    const { inviteUrl, email } = createSchool(`SMK Tema ${theme}`, 'smk');
    await onboardAdmin(page, inviteUrl, email);
    await page.goto('/dasbor');
    await expect(page.getByRole('heading', { level: 1, name: 'Hari ini' })).toBeVisible();
    await openMenu(page, isMobile);
    await page.getByRole('button', { name: theme }).click();
    if (isMobile) await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
}
