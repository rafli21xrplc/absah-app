import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createSchool, onboardAdmin } from './helpers';

// WCAG 2.1 A and AA on the pages moved to the design system, in the real app (real data, real fonts, real layout), light and dark.
// Storybook's axe run checks components alone; this one catches what only shows when they are put together (two landmarks with
// the same name, a label that points nowhere, contrast on a tinted background).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page: Page) {
  const { violations: found } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return found.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

// Admin pages of a SMK (per-period attendance shows Mapel and Jadwal too). Opened right after onboarding: setup is not required to view them.
const ADMIN_PAGES: [string, string][] = [
  ['/setup', 'Profil sekolah'],
  ['/dasbor', 'Hari ini'],
  ['/siswa', 'Siswa'],
  ['/rombel', 'Rombel'],
  ['/mapel', 'Mata pelajaran'],
  ['/jadwal', 'Jadwal'],
  ['/staf', 'Guru dan staf'],
];

for (const scheme of ['light', 'dark'] as const) {
  test(`halaman admin tanpa pelanggaran aksesibilitas (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const { inviteUrl, email } = createSchool(`SMK A11y ${scheme}`, 'smk');
    await onboardAdmin(page, inviteUrl, email);
    const report: Record<string, string[]> = {};
    for (const [path, heading] of ADMIN_PAGES) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      // Let skeletons settle into the real state before measuring.
      await page.waitForLoadState('networkidle');
      const found = await violations(page);
      if (found.length > 0) report[path] = found;
    }
    expect(report).toEqual({});
  });

  test(`halaman publik tanpa pelanggaran aksesibilitas (${scheme})`, async ({ page }) => {
    // The sample board on /masuk fades its rows in and out in a loop; axe would measure a row halfway through its fade.
    // Reduced motion shows the end state, which is what the contrast has to hold for (the animation never changes a colour).
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const report: Record<string, string[]> = {};
    for (const path of ['/masuk', '/lapor?s=bukan-sekolah', '/lapor/lacak']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const found = await violations(page);
      if (found.length > 0) report[path] = found;
    }
    expect(report).toEqual({});
  });
}
