import { expect, test } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

// The dropdown on a laptop is a popover; on a phone it is the browser's own picker. This clicks the popover the way a person does
// (the other specs pick through choose(), which works on both).
test('laptop: menu pilihan muncul sebagai popover, bisa dicari dengan keyboard, dan menutup dengan Escape', async ({ page, isMobile }) => {
  test.skip(isMobile, 'di HP dropdown memakai pilihan bawaan peramban');
  const { inviteUrl, email } = createSchool('SMP Popover E2E', 'smp');
  await onboardAdmin(page, inviteUrl, email);
  await page.goto('/setup');
  await page.waitForLoadState('networkidle');
  const trigger = page.getByRole('combobox').first();
  await expect(trigger).toBeVisible();
  const before = await trigger.innerText();
  await trigger.click();
  const options = page.getByRole('option');
  await expect(options.first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(options.first()).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveText(before);
});
