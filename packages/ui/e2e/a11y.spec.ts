import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Every story, light and dark, at phone width, with colour contrast switched ON (jsdom unit tests cannot check it).
interface StoryIndex {
  entries: Record<string, { id: string; type: string; title: string; name: string }>;
}

test('every story passes axe', async ({ page, request }) => {
  const index = (await (await request.get('/index.json')).json()) as StoryIndex;
  const stories = Object.values(index.entries).filter((e) => e.type === 'story');
  expect(stories.length).toBeGreaterThan(10);
  // One test walks every story, so its time grows with the number of stories (a slow CI runner needs ~1 s each, light and dark in parallel).
  test.setTimeout(Math.max(60_000, stories.length * 3_000));

  const failures: string[] = [];
  for (const story of stories) {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    await page.waitForSelector('body.sb-show-main');
    await page.evaluate(() => document.fonts.ready);
    // Contrast is read from the painted colours, so wait until entrance animations (toast) have finished (the loading spinner never ends, so it is skipped).
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ),
    );
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    for (const v of result.violations) {
      failures.push(`${story.title} / ${story.name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.html.slice(0, 120) ?? ''}`);
    }
    // axe files "text the same colour as its background" (a 1:1 ratio) under `incomplete`, not `violations`, so a link whose
    // text vanished into its button passed this spec once. A contrast that axe could not decide is a failure here too.
    for (const i of result.incomplete.filter((x) => x.id === 'color-contrast')) {
      failures.push(`${story.title} / ${story.name}: color-contrast undecided (${i.nodes.length}) ${i.nodes[0]?.html.slice(0, 120) ?? ''}`);
    }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

test('no story is wider than the phone (no horizontal scroll)', async ({ page, request }) => {
  const index = (await (await request.get('/index.json')).json()) as StoryIndex;
  const wide: string[] = [];
  for (const story of Object.values(index.entries).filter((e) => e.type === 'story')) {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    await page.waitForSelector('body.sb-show-main');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) wide.push(`${story.title} / ${story.name}: +${overflow}px`);
  }
  expect(wide, wide.join('\n')).toEqual([]);
});

// Tailwind's preflight is not loaded, so a bare <button> keeps the browser's grey face and 2 px outset border. axe cannot see that.
test('no button still wears the browser default look', async ({ page, request }) => {
  const index = (await (await request.get('/index.json')).json()) as StoryIndex;
  const bare: string[] = [];
  for (const story of Object.values(index.entries).filter((e) => e.type === 'story')) {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    await page.waitForSelector('body.sb-show-main');
    const found = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => {
          const s = getComputedStyle(b);
          const faceGrey = s.backgroundColor === 'rgb(239, 239, 239)' || s.backgroundColor === 'rgb(59, 59, 59)';
          const outset = s.borderTopStyle === 'outset' || (s.borderTopWidth === '2px' && s.borderTopColor === 'rgb(118, 118, 118)');
          return faceGrey || outset;
        })
        .map((b) => b.textContent?.trim() || b.getAttribute('aria-label') || 'button'),
    );
    for (const f of found) bare.push(`${story.title} / ${story.name}: ${f}`);
  }
  expect(bare, bare.join('\n')).toEqual([]);
});
