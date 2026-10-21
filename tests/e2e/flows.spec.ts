import { test, expect, type Page } from '@playwright/test';
import { boot, continueFrom, enter, fixture, interact, settle, snap, type W } from './support';
import { serialize } from '../../src/systems/save';

/**
 * Alpha 4.1 flow tests (real keys, real scenes). They cover the paths that used to have no browser test:
 * defeat -> Retry / Load latest save / Return to title, a save and reload at a chapter boundary, and importing old saves.
 */
test.use({ launchOptions: { args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] } });
test.setTimeout(900000);

const fullState = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as W).__session.state)) as Record<string, unknown>);
const stable = (s: Record<string, unknown>) => { const { savedAt, playMs, ...rest } = s; void savedAt; void playMs; return rest; };
/** A defeat on purpose, not by luck: the whole party is knocked out, then the game's own defeat flow runs. (The guard-aware bot can beat Dodoria even at level 1.) */
const loseOnPurpose = async (page: Page) => {
  await page.evaluate(() => { const c = (window as W).__session.battle; for (const f of c.engine.allies(false)) { f.hp = 0; f.alive = false; } });
  await page.waitForFunction(() => (window as W).__session.overlay?.kind === 'defeat', null, { timeout: 60000 });
  return 'defeat';
};
const toTitle = (page: Page) => page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });

test('defeat screen: Retry restores the fight, Load latest save returns to the last save and the game stays playable, Return to title works', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors);
  // Every battle in this test is lost on purpose (see loseOnPurpose), so the defeat flow is exercised for certain.
  const st = fixture({ stopAt: 'cui', sideQuests: false, levelTo: 1 });
  await continueFrom(page, st);
  const saved = await snap(page);
  expect(saved.mapId).toBe('landing'); expect(saved.flags.dodoria_done).toBeFalsy();

  const log: string[] = [];
  const bagBefore = JSON.stringify(saved.inventory); let nDefeats = 0;
  // 1st defeat: Retry (the verified path). 2nd defeat: Load latest save.
  await enter(page, 'landing_dodoria', {
    battle: loseOnPurpose,
    onDefeat: async (p) => {
      log.push('defeat'); nDefeats++;
      if (nDefeats === 1) {
        await expect(p.getByRole('button', { name: /Retry/ })).toBeVisible(); await expect(p.getByRole('button', { name: /Load latest save/ })).toBeVisible(); await expect(p.getByRole('button', { name: /Return to title/ })).toBeVisible();
        await p.getByRole('button', { name: /Retry/ }).click();
        await p.waitForFunction(() => { const s = (window as W).__session; return s.mode === 'battle' && !s.overlay; }, null, { timeout: 30000 });
        const mid = await p.evaluate(() => { const s = (window as W).__session; return { inv: JSON.stringify(s.state.inventory), hp: s.state.roster.map((m: { hp: number }) => m.hp) as number[] }; });
        expect(mid.inv, 'Retry gives back the bag the fight started with').toBe(bagBefore);
        expect(mid.hp.every((h) => h > 0), 'nobody starts the retried fight down').toBe(true);
        log.push('retried');
      } else if (nDefeats === 2) {
        await p.getByRole('button', { name: /Load latest save/ }).click(); log.push('loaded');
      } else throw new Error('a third defeat: the load did not return to the saved state');
    },
  });
  expect(log).toEqual(['defeat', 'retried', 'defeat', 'loaded']);
  let s = await snap(page);
  expect(s.mode).toBe('world'); expect(s.overlay).toBeNull(); expect(s.busy, 'the busy counter is back at zero (a stuck counter blocks every exit and trigger)').toBe(0);
  expect(s.mapId).toBe(saved.mapId); expect(s.flags.dodoria_done).toBeFalsy(); expect(s.party).toEqual(saved.party); expect(s.roster.map((m) => m.level)).toEqual(saved.roster.map((m) => m.level));
  await page.waitForTimeout(600);

  // Playable after the load: an exit works, then the boss trigger starts the fight again.
  await enter(page, 'landing_to_village', {});
  expect((await snap(page)).mapId).toBe('village');
  await enter(page, 'village_to_landing', {});
  expect((await snap(page)).mapId).toBe('landing');

  // Third path: Return to title, then Continue.
  let toTitleDone = false;
  await enter(page, 'landing_dodoria', { battle: loseOnPurpose, onDefeat: async (p) => { await p.getByRole('button', { name: /Return to title/ }).click(); toTitleDone = true; }, until: (x) => x.mode === 'title' || toTitleDone, maxMs: 300000 });
  expect(toTitleDone, 'the defeat screen offered Return to title and it was used').toBe(true);
  await toTitle(page);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue' }).click(); await settle(page);
  s = await snap(page); expect(s.mode).toBe('world'); expect(s.busy).toBe(0); expect(s.flags.dodoria_done).toBeFalsy();
  await enter(page, 'landing_to_village', {});
  expect((await snap(page)).mapId).toBe('village');
  expect(errors).toEqual([]);
});

test('save at a chapter boundary, reload the page, load the slot: the game is identical and the story continues', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors);
  await continueFrom(page, fixture({ stopAt: 'guru', sideQuests: false, natural: true }));      // just after Guru: chapter 3 begins
  let s = await snap(page); expect(s.flags.guru_done).toBe(true); expect(s.chapter).toBe(3);
  const saveSlot3 = async (p: Page) => { await p.getByRole('button', { name: /^(Save|Overwrite)$/ }).nth(2).click(); await p.waitForTimeout(300); };
  await interact(page, 'guru_save', { onAltar: saveSlot3 });
  const before = stable(await fullState(page));
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => /aots2\.save\.v3\.slot3$/.test(k))), 'slot 3 was written').toBe(true);

  await page.reload(); await toTitle(page);
  await page.getByRole('button', { name: 'Load / Import' }).click();
  await page.locator('.slot').nth(3).getByRole('button', { name: 'Load' }).click(); await settle(page);
  const after = stable(await fullState(page));
  expect(after, 'every flag, item, level, training point and position survived the reload').toEqual(before);

  s = await snap(page); expect(s.busy).toBe(0);
  await enter(page, 'guru_to_village', {});
  expect((await snap(page)).mapId).toBe('village');
  expect(errors).toEqual([]);
});

test('old saves: a prototype (v2) save and an Alpha 3f-shaped save file both import and continue; a damaged file is refused without breaking the title', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors);

  // 1. prototype v2 save (the only thing in storage): imported as a checkpoint
  await page.evaluate(() => localStorage.setItem('aots2-namek-save-v2', JSON.stringify({ index: 12, actors: { gohan: { lv: 12 }, krillin: { lv: 11 } }, inventory: { medkit: 4, capsule: 2, senzu: 1 }, coins: 500, balls: 2 })));
  await page.reload(); await toTitle(page);
  await page.getByRole('button', { name: 'Load / Import' }).click();
  await page.getByRole('button', { name: /Import prototype \(v2\) save/ }).click(); await settle(page);
  let s = await snap(page);
  expect(s.flags.zarbon_done).toBe(true); expect(s.mapId).toBe('guru'); expect(s.roster.map((m) => m.id)).toEqual(['gohan', 'krillin', 'vegeta']); expect(s.zeni).toBe(500);
  expect(await page.evaluate(() => localStorage.getItem('aots2.legacy.v2.backup')), 'the original v2 data is kept untouched').not.toBeNull();
  await enter(page, 'guru_trigger', {});
  expect((await snap(page)).flags.guru_done, 'the imported checkpoint continues the story').toBe(true);

  // 2. an Alpha 3f-shaped save file (same version number, quests in flags): import from a file
  const st = fixture({ stopAt: 'guru', sideQuests: false });
  st.party = ['gohan', 'krillin', 'vegeta'];                                                       // the 3f lineup: Piccolo/Goku not yet in the party
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('aots2.save')) localStorage.removeItem(k); });
  await page.reload(); await toTitle(page);
  await page.getByRole('button', { name: 'Load / Import' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'alpha3f.json', mimeType: 'application/json', buffer: Buffer.from(serialize({ ...st, savedAt: Date.now() })) });
  await settle(page);
  s = await snap(page); expect(s.flags.guru_done).toBe(true); expect(s.party).toEqual(['gohan', 'krillin', 'vegeta']); expect(s.busy).toBe(0);
  await enter(page, 'guru_to_village', {});
  expect((await snap(page)).mapId).toBe('village');

  // 3. a damaged file is refused: the title stays usable
  await page.reload(); await toTitle(page);
  await page.getByRole('button', { name: 'Load / Import' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"version":3,"flags":') });
  await page.waitForTimeout(500);
  expect((await snap(page)).mode, 'a broken file never starts a game').toBe('title');
  await expect(page.locator('.title-screen')).toBeVisible();
  expect(errors.filter((e) => !/Failed to load resource|SyntaxError/.test(e))).toEqual([]);
});
