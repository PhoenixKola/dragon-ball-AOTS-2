import { test, expect } from '@playwright/test';

test('every story battle location draws its distinct reviewed Namek background', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const kind of ['plain', 'water', 'village', 'ship', 'cave', 'ruin', 'final', 'frozen']) {
    await page.goto(`/?dev=battle&party=goku,gohan,vegeta&foes=zarbon&first=goku&lv=15&stage=${kind}`);
    await page.waitForFunction(() => (window as any).__battle?.bg?.objects?.length, null, { timeout: 90000 });
    const key = await page.evaluate(() => (window as any).__battle.bg.objects[0].texture.key as string);
    expect(key).toBe(`bg_${kind}_namek`);
    await page.screenshot({ path: `evidence/overhaul/stage-${kind}-960x540.png` });
  }
  expect(errors).toEqual([]);
});
