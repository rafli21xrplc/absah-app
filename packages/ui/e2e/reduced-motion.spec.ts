import { expect, test, type APIRequestContext } from '@playwright/test';

// Motion-UI: with "reduce motion" on, nothing moves. document.getAnimations() lists every running CSS animation and transition,
// so zero means every story is already in its end state.
interface StoryIndex {
  entries: Record<string, { id: string; type: string; title: string }>;
}

const storiesOf = async (request: APIRequestContext, title: string) => {
  const index = (await (await request.get('/index.json')).json()) as StoryIndex;
  return Object.values(index.entries).filter((e) => e.type === 'story' && e.title === title);
};

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the motion stories run no animation', async ({ page, request }) => {
    const stories = await storiesOf(request, 'Gerak/Komponen');
    expect(stories.length).toBeGreaterThanOrEqual(6);
    for (const story of stories) {
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await page.waitForSelector('body.sb-show-main');
      // Only what the story itself draws: Storybook's own frame eases its padding in.
      const running = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => (a.effect as KeyframeEffect | null)?.target?.closest('#storybook-root'))
          .map((a) => (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty),
      );
      expect(running, story.id).toEqual([]);
    }
  });
});

test.describe('motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  // Without this the test above could pass because nothing ever moves.
  test('the same stories do animate', async ({ page, request }) => {
    const [spinners] = await storiesOf(request, 'Gerak/Komponen');
    await page.goto(`/iframe.html?id=${spinners?.id ?? ''}&viewMode=story`);
    await page.waitForSelector('body.sb-show-main');
    const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName));
    expect(names).toContain('absah-spin');
  });
});
