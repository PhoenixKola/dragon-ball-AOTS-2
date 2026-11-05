import { expect, test } from '@playwright/test';
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
    for (const [tab, name] of [['Party', 'party'], ['Loadout', 'loadout'], ['Training', 'training'], ['Capsules', 'capsules'], ['Items', 'items'], ['Combos', 'combos'], ['Journal', 'journal'], ['Map', 'map'], ['Save/Load', 'save'], ['Settings', 'settings'], ['Help', 'help']]) {
      await page.getByRole('tab', { name: tab }).click(); await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/menu_${name}_${w}.png` });
    if (tab === 'Loadout') {
      const scroller = await page.locator('.libscroll').first().evaluate((el) => ({ overflowY: getComputedStyle(el).overflowY, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
      if (scroller.scrollHeight > scroller.clientHeight) expect(scroller.overflowY).toBe('auto');
    }
    }
    await page.keyboard.press('x'); await page.waitForFunction(() => !(window as W).__session.overlay);
    await page.evaluate(() => { const s = (window as W).__session; s.overlay = { kind: 'shop', shop: 'village', done: () => { s.overlay = null; s.emit(); } }; s.emit(); });
    await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/shop_${w}.png` });
    await page.evaluate(() => { const s = (window as W).__session; s.overlay = null; s.emit(); });
    await page.evaluate(() => { const s = (window as W).__session; s.state.balls = 7; s.overlay = { kind: 'porunga', done: () => { s.overlay = null; s.emit(); } }; s.emit(); });
    await page.waitForTimeout(800); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/porunga_${w}.png` });
    await page.evaluate(() => {
      const s = (window as W).__session;
      s.overlay = { kind: 'results', data: { outcome: 'win', scripted: false, title: 'Frieza Scout', exp: 90, zeni: 60, drops: { medkit: 1 }, levelUps: [], members: [{ id: 'piccolo', name: 'Piccolo', level: 8, xp: 120, next: 200 }, { id: 'goku', name: 'Goku', level: 8, xp: 100, next: 200 }, { id: 'gohan', name: 'Gohan', level: 7, xp: 80, next: 180 }], rounds: 4 }, done: () => { s.overlay = null; s.emit(); } };
      s.emit();
    });
    await page.waitForSelector('.results-title'); await page.screenshot({ path: `${OUT}/victory_${w}.png` });
    await page.evaluate(() => { const s = (window as W).__session; s.overlay = { kind: 'defeat', choose: () => {} }; s.emit(); });
    await page.waitForSelector('.results-title'); await page.screenshot({ path: `${OUT}/defeat_${w}.png` });
    await page.evaluate(() => { const s = (window as W).__session; s.overlay = { kind: 'credits' }; s.emit(); });
    await page.waitForSelector('.credits-roll'); await page.screenshot({ path: `${OUT}/credits_${w}.png` });
    await page.goto('/?dev=battle&stage=water&party=piccolo,goku,gohan&foes=frieza2&lv=30');
    await page.waitForSelector('.party-cards'); await page.waitForSelector('.boss-bar');
    await page.screenshot({ path: `${OUT}/battle_hud_${w}.png` });
    console.log('errors', w, errors.join('|'));
  });
}
