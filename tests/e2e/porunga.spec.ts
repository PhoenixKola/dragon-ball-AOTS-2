import { test, expect } from '@playwright/test';
import { boot, continueFrom, fixture, interact, enter, settle, snap, routeTo, walkPath, type W } from './support';

/** Real input from the credits: Continue Adventure, walk to the shrine, press E, take wishes with the keyboard / clicks. Fixtures are real headless story routes. */
async function toPostgame(page: import('@playwright/test').Page, errors: string[], balls?: number[]) {
  await boot(page, errors);
  await continueFrom(page, fixture({ stopAt: 'core', balls }));
  await page.evaluate(() => { const s = (window as W).__session; s.state.flags.final_done = true; s.state.flags.frieza_defeated = true; void s.runScript('epilogue'); });
  for (let i = 0; i < 40; i++) { if (await page.locator('.credits-roll').count()) break; await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  await page.waitForSelector('.credits-roll', { timeout: 30000 });
  await page.getByRole('button', { name: /Continue Adventure/ }).click();
  await settle(page);
}
/** Walk to the shrine with real keys and press E; leaves the Porunga screen open (the generic interact() helper would wait for it to close). */
async function openShrine(page: import('@playwright/test').Page) {
  for (let i = 0; i < 3; i++) {
    let r: string = 'interrupted';
    try { r = await walkPath(page, routeTo(await snap(page), 'porunga_shrine', 'interact')); } catch { await page.evaluate(() => { void (window as W).__session.enterMap('guru', 25, 21, true); }); await settle(page); }
    if (r === 'arrived') { await page.keyboard.press('e'); await page.waitForSelector('.dialogue, .porunga', { timeout: 8000 }); break; }
  }
  for (let i = 0; i < 4 && !(await page.locator('.porunga').count()); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
}
/** The headless fixture stops before the last-ground ball: collect it the way a postgame player would (walk back to the Last Ground). */
async function collectSeventh(page: import('@playwright/test').Page) {
  await page.evaluate(() => { void (window as W).__session.enterMap('landing', 20, 12, true); }); await settle(page);
  await enter(page, 'landing_to_core_post'); await settle(page);
  expect((await snap(page)).mapId).toBe('core');
  for (let i = 0; i < 4 && (await page.evaluate(() => (window as W).__session.state.balls)) !== 7; i++) { await interact(page, 'ball7_pick'); await page.waitForTimeout(600); }
  expect(await page.evaluate(() => (window as W).__session.state.balls)).toBe(7);
}
async function gotoShrine(page: import('@playwright/test').Page) {
  await page.evaluate(() => { void (window as W).__session.enterMap('guru', 25, 21, true); });
  await settle(page);
  await openShrine(page);
  await page.waitForSelector('.porunga');
}

test('Porunga: all balls, three wishes with a cancel and a reload in between; Trunks, Hidden Potential and the Dragon Crest are granted exactly once', async ({ page }) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  await toPostgame(page, errors);
  await collectSeventh(page);
  const pre = await page.evaluate(() => { const s = (window as W).__session.state; return { balls: s.balls as number, ending: !!s.flags.ending_seen }; });
  expect(pre.balls).toBe(7); expect(pre.ending).toBe(true);
  await gotoShrine(page);
  await page.keyboard.press('Enter');                                   // skip the ritual
  await expect(page.locator('.wish-card')).toHaveCount(3);
  await expect(page.locator('.porunga')).toContainText('Three wishes remain');
  await page.screenshot({ path: 'evidence/v4/e2e_porunga_cards.png' });
  // cancel: choose a wish, go back, close: nothing is spent
  await page.locator('.wish-card', { hasText: 'Dragon Relic' }).click();
  await expect(page.locator('.porunga-panel')).toContainText('permanent');
  await page.keyboard.press('x');                                       // back to the cards
  await expect(page.locator('.wish-card')).toHaveCount(3);
  await page.keyboard.press('x');                                       // close the ceremony
  await page.waitForFunction(() => !(window as W).__session.overlay);
  expect(await page.evaluate(() => Object.keys((window as W).__session.state.flags).filter((k) => k.startsWith('wish_')))).toEqual([]);
  // wish 1: the relic
  await openShrine(page); await page.waitForSelector('.porunga'); await page.keyboard.press('Enter');
  await page.locator('.wish-card', { hasText: 'Dragon Relic' }).click();
  await page.getByRole('button', { name: 'Make this wish' }).click();
  await expect(page.locator('.porunga-panel')).toContainText('WISH GRANTED');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('.wish-card.done')).toHaveCount(1);
  await page.keyboard.press('x'); await page.waitForFunction(() => !(window as W).__session.overlay);
  // reload in the middle: the committed wish is saved, the others are still pending
  await page.evaluate(() => (window as W).__session.saveTo(1));
  await page.reload(); await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Continue' }).click(); await settle(page);
  let st = await page.evaluate(() => { const s = (window as W).__session.state; return { flags: Object.keys(s.flags).filter((k) => k.startsWith('wish_')), crest: s.inventory.dragoncrest ?? 0 }; });
  expect(st.flags).toEqual(['wish_relic']); expect(st.crest).toBe(1);
  // wishes 2 and 3
  await openShrine(page); await page.waitForSelector('.porunga'); await page.keyboard.press('Enter');
  await expect(page.locator('.wish-card.done')).toHaveCount(1);
  await page.locator('.wish-card', { hasText: 'Hidden Potential' }).click(); await page.getByRole('button', { name: 'Make this wish' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.locator('.wish-card', { hasText: 'Secret Ally' }).click(); await page.getByRole('button', { name: 'Make this wish' }).click();
  await expect(page.locator('.porunga-panel')).toContainText('Trunks');
  await page.screenshot({ path: 'evidence/v4/e2e_porunga_granted.png' });
  await page.getByRole('button', { name: 'Farewell' }).click();
  await page.waitForSelector('.dialogue');                              // Trunks introduces himself (non-canon explanation)
  for (let i = 0; i < 8 && (await page.locator('.dialogue').count()); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(450); }
  await page.waitForFunction(() => !(window as W).__session.overlay);
  st = await page.evaluate(() => { const s = (window as W).__session.state; return { flags: Object.keys(s.flags).filter((k) => k.startsWith('wish_')).sort(), crest: s.inventory.dragoncrest ?? 0, trunks: s.roster.filter((m: { id: string }) => m.id === 'trunks').length, pot: s.roster.every((m: { potential?: boolean }) => m.potential === true), party: s.party as string[] }; });
  expect(st.flags).toEqual(['wish_potential', 'wish_relic', 'wish_trunks']); expect(st.crest).toBe(1); expect(st.trunks).toBe(1); expect(st.pot).toBe(true); expect(st.party.length).toBeLessThanOrEqual(3);
  // a fourth visit: completion acknowledgement, nothing to grant
  const lines4: string[] = [];
  await interact(page, 'porunga_shrine', { lines: lines4 });   // the shrine only speaks: all wishes are used, no ceremony opens
  expect(lines4.join(' ')).toMatch(/All three wishes|sleeps/);
  // Trunks is a real hero in menus: portrait, loadout with four slots
  await page.evaluate(() => (window as W).__session.setOverlay(null));
  await page.keyboard.press('m'); await page.waitForSelector('.menu-win');
  await page.getByRole('tab', { name: 'Loadout' }).click(); await page.getByRole('button', { name: 'Trunks' }).click();
  await expect(page.locator('.slotrow')).toHaveCount(4);
  await expect(page.locator('.menu-body')).toContainText('Burning Attack'); await expect(page.locator('.menu-body')).toContainText('SUPER SAIYAN ONLY');
  await page.screenshot({ path: 'evidence/v4/e2e_trunks_loadout.png' });
  await page.getByRole('tab', { name: 'Journal' }).click();
  await expect(page.locator('.menu-body')).toContainText(/porunga.s wishes \(3\/3\)/i);
  await page.keyboard.press('x'); await page.waitForFunction(() => !(window as W).__session.overlay);
  expect(errors).toEqual([]);
});

test('Porunga: with a Dragon Ball still missing the shrine explains it, the Last Ground can be revisited to collect it, and only then the ceremony opens', async ({ page }) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  await toPostgame(page, errors, [3, 4, 5, 6]);                         // ball 7 skipped
  expect(await page.evaluate(() => (window as W).__session.state.balls)).toBe(6);
  await page.evaluate(() => { void (window as W).__session.enterMap('guru', 25, 21, true); }); await settle(page);
  const lines: string[] = [];
  await interact(page, 'porunga_shrine', { lines });
  expect(lines.join(' ')).toMatch(/seven Dragon Balls/);
  await collectSeventh(page);
  await page.evaluate(() => { void (window as W).__session.enterMap('guru', 25, 21, true); }); await settle(page);
  await openShrine(page);
  await page.waitForSelector('.porunga');
  expect(errors).toEqual([]);
});
