import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Structure and name checks (labels, roles, aria). Colour contrast needs real layout, so jsdom skips it here and
 * Playwright checks it on every story (e2e/stories.a11y.spec.ts, @axe-core/playwright).
 */
export async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([]);
}
