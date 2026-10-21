import { test } from '@playwright/test';
import { boot, continueFrom, fixture, type W } from '../e2e/support';
test('loadout + shop recheck', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  const errors: string[] = []; await boot(page, errors);
  await continueFrom(page, fixture({ stopAt: 'ginyu' }));
  await page.keyboard.press('Escape'); await page.waitForSelector('.menu-win');
  await page.getByRole('tab', { name: 'Loadout' }).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: 'evidence/beta3/ui/loadout_after_1024.png' });
  await page.keyboard.press('x'); await page.waitForFunction(() => !(window as W).__session.overlay);
  await page.evaluate(() => { const s = (window as W).__session; s.overlay = { kind: 'shop', shop: 'village', done: () => { s.overlay = null; s.emit(); } }; s.emit(); });
  await page.waitForTimeout(500); await page.screenshot({ path: 'evidence/beta3/ui/shop_after_1024.png' });
  console.log('errors', errors.join('|'));
});
