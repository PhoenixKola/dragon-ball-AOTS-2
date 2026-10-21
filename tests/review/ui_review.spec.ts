import { test } from '@playwright/test';
import { boot, continueFrom, fixture, settle, type W } from '../e2e/support';

const SIZES: [number, number][] = [[1024, 600], [1280, 720], [1920, 1080]];
const OUT = 'evidence/beta3/ui';

for (const [w, h] of SIZES) {
  test(`ui review ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const errors: string[] = [];
    await boot(page, errors);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/title_${w}.png` });
    await continueFrom(page, fixture({ stopAt: 'ginyu' }));
    await page.keyboard.press('Escape'); await page.waitForSelector('.menu-win');
    for (const [tab, name] of [['Party', 'party'], ['Loadout', 'loadout'], ['Training', 'training'], ['Capsules', 'capsules'], ['Items', 'items']]) {
      await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/menu_${name}_${w}.png` });
    }
    await page.keyboard.press('x'); await page.waitForFunction(() => !(window as W).__session.overlay);
    await page.evaluate(() => { const s = (window as W).__session; s.overlay = { kind: 'shop', shop: 'village', done: () => { s.overlay = null; s.emit(); } }; s.emit(); });
    await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/shop_${w}.png` });
    await page.evaluate(() => { const s = (window as W).__session; s.overlay = null; s.emit(); });
    await page.evaluate(() => { const s = (window as W).__session; s.state.balls = 7; s.overlay = { kind: 'porunga', done: () => { s.overlay = null; s.emit(); } }; s.emit(); });
    await page.waitForTimeout(800); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/porunga_${w}.png` });
    console.log('errors', w, errors.join('|'));
  });
}
