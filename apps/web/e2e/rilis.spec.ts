import { expect, test } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

test('Catatan rilis: halaman /rilis menampilkan rilis terbaru dari berkas Markdown (PLT-08)', async ({ page }) => {
  const { inviteUrl, email } = createSchool('SD Negeri Rilis E2E', 'sd');
  await onboardAdmin(page, inviteUrl, email);

  // Open it directly: the home page sends an admin of a school still in setup to /setup.
  await page.goto('/rilis');
  await expect(page.getByRole('heading', { level: 1, name: 'Yang baru di Absah' })).toBeVisible();
  const release = page.getByRole('article', { name: 'Dasbor, penilaian PKL, dan kabar alumni' });
  await expect(release).toBeVisible();
  await expect(release.getByText('Dasbor kepala sekolah', { exact: false }).first()).toBeVisible();
  await expect(release.locator('strong').first()).toBeVisible(); // **bold** became an element, not literal asterisks
  await expect(release).not.toContainText('**');
});
