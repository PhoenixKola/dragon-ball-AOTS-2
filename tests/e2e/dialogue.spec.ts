import { test, expect } from '@playwright/test';

type W = typeof window & { __session: { mode: string; overlay: { kind: string; idx: number } | null; say: (lines: [string, string][]) => Promise<void>; advanceDialogue: () => void } };

test('advancing dialogue never paints the next line fully revealed', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 60000 });
  const first = 'The first line is long enough to reveal every character before advancing.';
  const next = 'The next line should start hidden and type in.';
  await page.evaluate(([a, b]) => { void (window as W).__session.say([['Narrator', a], ['Narrator', b]]); }, [first, next] as const);
  await expect(page.locator('.dlg-text')).toBeVisible();
  await page.locator('.dialogue').click();
  await expect(page.locator('.dlg-text')).toHaveText(first);
  const frames = await page.evaluate(async () => {
    const w = window as W;
    const seen: string[] = [];
    w.__session.advanceDialogue();
    await new Promise<void>((resolve) => {
      let n = 0;
      const tick = () => {
        seen.push(document.querySelector('.dlg-text')?.textContent ?? '');
        if (++n < 3) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    return seen;
  });
  expect(frames[0].length, `first painted frame: ${JSON.stringify(frames)}`).toBeLessThan(next.length);
  expect(await page.evaluate(() => (window as W).__session.overlay?.idx)).toBe(1);
});
