import { expect, test } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

test('Admin membuka status notifikasi WhatsApp', async ({ page }) => {
  const { inviteUrl, email } = createSchool('SD Notifikasi E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);
  // The home page sends a new admin back to the wizard; the dashboard itself opens directly.
  await page.goto('/notifikasi');
  await expect(page.getByRole('heading', { name: 'Notifikasi WhatsApp' })).toBeVisible();
  await expect(page.getByLabel('Hari ini')).toContainText('0 gagal');
  await expect(page.getByText('Tidak ada pesan gagal.')).toBeVisible();
});
