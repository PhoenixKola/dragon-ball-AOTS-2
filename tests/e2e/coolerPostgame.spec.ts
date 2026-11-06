import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { preparePostgame } from '../../src/systems/postgame';
import { boot, continueFrom, enter, fixture, interact, playBattle, settle, snap, type W } from './support';

test.use({ launchOptions: { args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] } });
test.setTimeout(1800000);

test('browser [natural full-story save]: credits hub to Cooler postgame, including the real arena fight', async ({ page }) => {
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  await boot(page, errors, { settings: { battleSpeed: 1.6, guardPreset: 'relaxed', fullscreen: false } });

  // Build a legitimate end-of-story state by walking and playing the full normal route in the
  // shared story/combat engine. Credits unlock the simulation and restore its approved roster.
  const naturalEnd = fixture({ natural: true, seed: 1 });
  expect(naturalEnd.flags.ending_seen).toBe(true);
  expect(naturalEnd.roster.every((m) => m.level < 30)).toBe(true);
  preparePostgame(naturalEnd);
  await continueFrom(page, naturalEnd);
  await settle(page);
  expect((await snap(page)).mapId).toBe('village');
  await expect(page.locator('.hud-obj')).toContainText('Ask Bulma at the Capsule Comm');
  mkdirSync('evidence/overhaul/postgame', { recursive: true });
  await page.screenshot({ path: 'evidence/overhaul/postgame/natural_hub_1280.png' });

  await interact(page, 'village_comm', { choose: (text) => /training simulation now/.test(text) ? 'no' : 'yes' });
  console.log('postgame clue', { map: (await snap(page)).mapId, clue: (await snap(page)).flags.cooler_clue });
  expect((await snap(page)).flags.cooler_clue).toBe(true);
  await enter(page, 'village_to_ridge');
  console.log('ridge reached', { map: (await snap(page)).mapId });
  await interact(page, 'ridge_rift', { choose: () => 'yes' });
  console.log('rift examined', { map: (await snap(page)).mapId, open: (await snap(page)).flags.cooler_trail_open });
  expect((await snap(page)).flags.cooler_trail_open).toBe(true);
  await page.screenshot({ path: 'evidence/overhaul/postgame/natural_rift_1280.png' });
  await enter(page, 'ridge_to_cooler');
  expect((await snap(page)).mapId).toBe('cooler_ruins');
  await page.screenshot({ path: 'evidence/overhaul/postgame/natural_cooler_ruins_1280.png' });

  let retries = 0;
  const onDefeat = async (p: typeof page) => {
    if (++retries > 8) throw new Error('Cooler could not be cleared after 8 natural-state attempts');
    await p.getByRole('button', { name: /Retry/ }).click();
    await p.waitForTimeout(400);
  };
  const battle = async (p: Page) => {
    const title = await p.evaluate(() => (window as W).__session.battle?.opts.title as string | undefined);
    if (title === 'Cooler') await p.screenshot({ path: 'evidence/overhaul/postgame/natural_cooler_battle_1280.png' });
    return playBattle(p);
  };
  let result = await snap(page);
  for (let attempt = 0; attempt < 8 && !result.flags.cooler_defeated; attempt++) {
    await enter(page, 'cooler_arena', { choose: () => 'yes', onDefeat, battle });
    await settle(page);
    result = await snap(page);
    console.log('ruins encounter resolved', { attempt: attempt + 1, defeated: !!result.flags.cooler_defeated, battles: result.flags.cooler_defeated ? 'Cooler' : 'patrol or no trigger', retries });
  }
  expect(result.flags.cooler_defeated).toBe(true);
  expect(result.flags.cooler_reward).toBe(true);
  expect(result.inventory.frostcore).toBe(1);
  expect(result.mode).toBe('world');
  await expect(page.locator('.hud-obj')).toContainText('Cooler defeated');
  await page.screenshot({ path: 'evidence/overhaul/postgame/natural_cooler_cleared_1280.png' });
  expect(errors).toEqual([]);
  console.log('natural postgame clear', { levels: naturalEnd.party.map((id) => naturalEnd.roster.find((m) => m.id === id)?.level), retries });
});
