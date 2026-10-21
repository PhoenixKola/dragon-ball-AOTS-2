import { test, expect, type Page } from '@playwright/test';
import { boot, continueFrom, drive, engage, enter, fixture, interact, settle, snap, type W } from './support';

/**
 * Real-browser story tests. Everything the player does is a real key press: walking (arrow keys along a path computed from the
 * game's own collision data), E to interact, Enter through dialogue, Active Guard presses in battle. The headless route in
 * tests/support/storyPlan.ts builds the save at each chapter boundary (so every test starts like a returning player pressing
 * Continue); the test-only world hook `debugNoEncounters()` is used for navigation only. The battle bot only presses Attack and
 * guards on cue. TEST NAMES SAY WHAT KIND OF TEST THEY ARE:
 *   [flow, natural levels]   starts from a save the headless route earned (levels, items and HP are what a player has there)
 *   [flow, BOOSTED levels N] starts from a save whose heroes were raised to level N so the long boss fights stay short. These prove movement,
 *                            scripts, overlays, saves and endings. They are NOT a statement about how hard the game is at earned levels:
 *                            that is tests/unit/naturalPlaythrough.test.ts (and docs/NATURAL_PLAYTHROUGH.md).
 * They use the machine's GPU through ANGLE/D3D11: software GL walks about 10x slower.
 */
test.use({ launchOptions: { args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] } });
test.setTimeout(3600000);

let defeats = 0;
const retry = async (p: Page) => { if (++defeats > 8) throw new Error('the battle bot lost 8 times: raise the fixture levels or improve the bot'); await p.getByRole('button', { name: /Retry/ }).click(); await p.waitForTimeout(400); };
const policy = (o: { lines?: string[]; yes?: (t: string) => boolean } = {}) => ({ onDefeat: retry, lines: o.lines, choose: (t: string) => (o.yes?.(t) ?? true) ? ('yes' as const) : ('no' as const) });
const dismissToast = (p: Page) => p.waitForTimeout(100);
void dismissToast;

const saveToFreeSlot = async (p: Page) => { await p.getByRole('button', { name: 'Save', exact: true }).first().click(); await p.waitForTimeout(300); };

async function newGame(page: Page) {
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.waitForSelector('text=Skip intro'); await page.keyboard.press('Escape');
  await settle(page);
}

test('browser [flow, natural levels]: Stolen Supplies quest chain (offer, patrol fight, sack, reward, journal)', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors);
  await continueFrom(page, fixture({ stopAt: 'scouts', sideQuests: false }));
  let s = await snap(page); expect(s.mapId).toBe('shore'); expect(s.flags.scouts1).toBe(true); expect(s.flags['q:shore_net']).toBeFalsy();
  await interact(page, 'fisher', policy());
  s = await snap(page); expect(s.flags['q:shore_net']).toBe(true);
  await engage(page, 'shore_foe1', policy());
  s = await snap(page); expect(s.flags['foe:shore_foe1']).toBe(true);
  await interact(page, 'shore_sack', policy());
  s = await snap(page); expect(s.flags['qp:shore_sack']).toBe(true);
  const before = await snap(page);
  await interact(page, 'fisher', policy());
  s = await snap(page); expect(s.flags['qd:shore_net']).toBe(true); expect(s.zeni).toBe(before.zeni + 120); expect(s.inventory.senzu ?? 0).toBe((before.inventory.senzu ?? 0) + 1);
  await interact(page, 'fisher', policy()); expect((await snap(page)).zeni, 'talking again pays nothing').toBe(before.zeni + 120);
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Journal' }).click(); await page.getByRole('button', { name: /Side quests/ }).click();
  await expect(page.locator('.quest', { hasText: 'Stolen Supplies' })).toContainText('Done');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('browser [flow, natural levels, from a new game]: Chapter 1 and 2: intro, first contact, Dende, Vegeta joins, Cui, Dragon Ball 1', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors); defeats = 0;
  const lines: string[] = [];
  await newGame(page);
  expect((await snap(page)).mapId).toBe('shore');
  await interact(page, 'ship', policy({ lines }));
  await enter(page, 'shore_scouts', policy({ lines }));
  let s = await snap(page); expect(s.flags.scouts1).toBe(true); expect(s.chapter).toBe(1);
  await enter(page, 'shore_to_village', policy({ lines }));
  expect((await snap(page)).mapId).toBe('village');
  await enter(page, 'village_enter', policy({ lines }));
  s = await snap(page); expect(s.flags.dende_met).toBe(true); expect(s.flags.ball1).toBe(true); expect(s.balls).toBe(1);
  await interact(page, 'dende_npc', policy({ lines }));
  expect(lines.some((l) => /We hold 1 of the 7 Dragon Balls/.test(l)), 'Dende reads the Dragon Radar honestly').toBe(true);
  await enter(page, 'village_to_landing', policy({ lines }));
  expect((await snap(page)).mapId).toBe('landing');
  await enter(page, 'landing_vegeta', policy({ lines }));
  s = await snap(page); expect(s.party).toContain('vegeta'); expect(s.flags.vegeta_joined).toBe(true); expect(s.chapter).toBe(2);
  await enter(page, 'landing_cui', policy({ lines }));
  expect((await snap(page)).flags.cui_done).toBe(true);
  s = await snap(page); expect(s.roster.every((m) => m.level >= 8), 'levels grew from real fights').toBe(true);
  console.log(`chapter 1-2: ${defeats} defeat(s) retried, levels ${s.roster.map((m) => m.id + m.level).join(' ')}`);
  expect(errors).toEqual([]);
});

test('browser [flow, BOOSTED levels 16]: Chapter 2 to 3: Dodoria, Medicine for the Elders (items), the Crystal Grotto, Zarbon, Guru’s gift', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors); defeats = 0;
  await continueFrom(page, fixture({ stopAt: 'cui', sideQuests: false, levelTo: 16 }));   // levels raised: Dodoria is a fight the Attack/Skill bot cannot win at story level
  let s = await snap(page); expect(s.mapId).toBe('landing');
  await enter(page, 'landing_dodoria', policy());
  s = await snap(page); expect(s.flags.dodoria_done).toBe(true); expect(s.chapter).toBe(2);
  await enter(page, 'landing_to_cave', policy());
  expect((await snap(page)).mapId).toBe('cave');
  await interact(page, 'ball2_pick', policy());
  s = await snap(page); expect(s.flags.ball2).toBe(true); expect(s.balls).toBe(2);
  await interact(page, 'ball2_pick', policy());                                                       // the ball is gone: pressing E again must pay nothing
  expect((await snap(page)).balls).toBe(2);
  await enter(page, 'cave_to_landing', policy());
  await enter(page, 'landing_to_village', policy());
  // the elders need two Med Kits: the offer, then the hand-in (items are really consumed)
  const kits0 = (await snap(page)).inventory.medkit ?? 0;
  await interact(page, 'village_npc2', policy());
  expect((await snap(page)).flags['q:aojan_medicine']).toBe(true);
  await interact(page, 'village_npc2', policy());
  s = await snap(page); expect(s.flags['qd:aojan_medicine']).toBe(true); expect(s.inventory.medkit ?? 0).toBe(kits0 - 2); expect(s.inventory.vitalcap).toBe(1);
  await enter(page, 'village_zarbon', policy());                                                      // Zarbon (and his second form)
  expect((await snap(page)).flags.zarbon_done).toBe(true);
  await enter(page, 'village_to_guru', policy());
  const unspent = async () => page.evaluate(() => (window as W).__session.state.roster.map((m: { unspent: number }) => m.unspent));
  const before = await unspent();
  await enter(page, 'guru_trigger', policy());
  s = await snap(page); expect(s.flags.guru_done).toBe(true); expect(s.chapter).toBe(3);
  const after = await unspent(); after.forEach((u: number, i: number) => expect(u).toBe(before[i] + 6));     // +6 training points each, once
  await interact(page, 'ball3_pick', policy());
  expect((await snap(page)).balls).toBe(3);
  console.log(`chapter 2-3: ${defeats} defeat(s) retried`);
  expect(errors).toEqual([]);
});

test('browser [flow, BOOSTED levels 28]: Chapter 4: Guldo, Recoome (survive, Goku arrives), Burter and Jeice, Ginyu', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors); defeats = 0;
  await continueFrom(page, fixture({ stopAt: 'guru', sideQuests: false, levelTo: 28 }));
  expect((await snap(page)).mapId).toBe('guru');
  await enter(page, 'guru_to_village', policy());
  await enter(page, 'village_to_ridge', policy());
  expect((await snap(page)).mapId).toBe('ridge');
  await enter(page, 'ridge_guldo', policy());
  expect((await snap(page)).flags.guldo_done).toBe(true);
  await enter(page, 'ridge_recoome', policy());                                                       // the survive fight, then Goku
  let s = await snap(page); expect(s.flags.recoome_done).toBe(true); expect(s.flags.goku_joined).toBe(true);
  expect(s.party).toEqual(['goku', 'vegeta', 'gohan']); expect(s.combos).toBeUndefined;
  await enter(page, 'ridge_duo', policy());
  await enter(page, 'ridge_ginyu', policy());
  s = await snap(page); expect(s.flags.ginyu_done).toBe(true);
  await interact(page, 'ball4_pick', policy());
  expect((await snap(page)).balls).toBeGreaterThanOrEqual(4);
  console.log(`chapter 4: ${defeats} defeat(s) retried`);
  expect(errors).toEqual([]);
});

test('browser [flow, NATURAL levels]: Chapter 5 to 7 (point of no return, Frieza, Super Saiyan) and the INCOMPLETE ending', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors); defeats = 0;
  await continueFrom(page, fixture({ stopAt: 'ginyu', sideQuests: false, balls: [], natural: true }));
  expect((await snap(page)).mapId).toBe('ridge');
  await enter(page, 'ridge_to_village', policy());
  await enter(page, 'village_to_guru', policy());
  await enter(page, 'nail_fight_trigger', policy());                                                  // Nail's stand, Piccolo fuses, warp to the camp
  let s = await snap(page); expect(s.flags.piccolo_joined).toBe(true); expect(s.mapId).toBe('landing'); expect(s.party).toContain('piccolo');
  // point of no return: first Cancel (nothing may change), then Continue
  const prompts: string[] = []; const pre = s;
  // Cancel is an intended outcome, not a failure: the prompt is answered "Not yet", the script ends, and the player is back in the world. Anything else (a timeout, a thrown error) fails the test.
  await enter(page, 'landing_frieza', { onDefeat: retry, choose: (t) => { prompts.push(t); return 'no'; }, until: (x) => prompts.length >= 1 && x.mode === 'world' && !x.overlay && x.busy === 0, maxMs: 60000 });
  s = await snap(page); expect(prompts[0]).toMatch(/no way back/); expect(prompts[0]).toMatch(/Dragon Balls found: 2\/7/);
  expect(s.flags.frieza3_done).toBeFalsy(); expect(s.mode).toBe('world'); expect(s.chapter).toBe(5);
  expect(prompts, 'exactly one prompt was shown, and it was cancelled').toHaveLength(1);
  expect({ flags: Object.keys(s.flags).sort(), inventory: s.inventory, party: s.party, levels: s.roster.map((m) => [m.id, m.level, m.xp]), zeni: s.zeni }, 'Cancel changed nothing').toEqual({ flags: Object.keys(pre.flags).sort(), inventory: pre.inventory, party: pre.party, levels: pre.roster.map((m) => [m.id, m.level, m.xp]), zeni: pre.zeni });
  await interact(page, 'landing_altar', { ...policy(), onAltar: saveToFreeSlot });                    // heal at the altar and really save
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /aots2\.save\.v3\.slot[23]$/.test(k)).length), 'the altar wrote a save slot').toBeGreaterThan(0);
  await enter(page, 'landing_frieza', { onDefeat: retry, choose: (t) => (/final form/.test(t) ? 'no' : 'yes'), lines: [] });   // forms 1-3, Vegeta falls; "Prepare first" for the final form
  s = await snap(page); expect(s.flags.frieza3_done).toBe(true); expect(s.roster.some((m) => m.id === 'vegeta')).toBe(false); expect(s.flags.krillin_dead).toBeFalsy();
  await interact(page, 'landing_altar', policy());
  await enter(page, 'landing_frieza4', policy());                                                     // final form, Krillin falls, SSJ cutscene, warp
  s = await snap(page); expect(s.flags.krillin_dead).toBe(true); expect(s.flags.ssj).toBe(true); expect(s.mapId).toBe('core'); expect(s.chapter).toBe(7);
  expect(s.roster.find((m) => m.id === 'goku')!.ssj).toBe(true); expect([...s.party].sort()).toEqual(['gohan', 'goku', 'piccolo']);
  const lines: string[] = [];
  await interact(page, 'core_altar', policy());
  await enter(page, 'core_final', { ...policy({ lines }), until: (x) => x.mode === 'credits' || x.overlay === 'credits', maxMs: 1500000 });
  s = await snap(page); expect(s.flags.final_done).toBe(true); expect(s.flags.ending_seen).toBe(true);
  expect(lines.some((l) => /never had all seven/.test(l))).toBe(true); expect(lines.some((l) => /Porunga rose/.test(l))).toBe(false);
  await expect(page.locator('.credits')).toBeVisible(); await expect(page.locator('.credits')).toContainText('THE END');
  for (let i = 0; i < 30 && (await snap(page)).mode !== 'title'; i++) { await page.keyboard.press('x'); await page.waitForTimeout(500); }   // 'Save & Title' (X): Enter now means Continue Adventure; the credits screen starts listening a moment after it appears
  expect((await snap(page)).mode).toBe('title');
  console.log(`chapters 5-7: ${defeats} defeat(s) retried`);
  expect(errors).toEqual([]);
});

test('browser [flow, NATURAL levels]: Chapter 7 with all seven Dragon Balls: the last ball does not start the fight, and the Porunga ending plays', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors); defeats = 0;
  const st = fixture({ stopAt: 'core', sideQuests: false, natural: true });
  expect(st.mapId).toBe('core'); expect(Object.keys(st.flags).filter((f) => /^ball\d$/.test(f))).toHaveLength(6);
  await continueFrom(page, st);
  await interact(page, 'ball7_pick', policy());
  let s = await snap(page); expect(s.balls).toBe(7); expect(s.flags.ball7).toBe(true); expect(s.mode).toBe('world'); expect(s.flags.final_done).toBeFalsy();
  const lines: string[] = [];
  await enter(page, 'core_final', { ...policy({ lines }), until: (x) => x.mode === 'credits' || x.overlay === 'credits', maxMs: 1500000 });
  s = await snap(page); expect(s.flags.ending_seen).toBe(true);
  expect(lines.some((l) => /Porunga rose/.test(l))).toBe(true); expect(lines.some((l) => /never had all seven/.test(l))).toBe(false);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// NATURAL-LEVEL browser tests: the save comes from a route that was really played (training points spent, kits, capsules, HP carried)
// and nothing is raised. The player rests at the altars like a real one. These show the bot can still win with real keys; the odds
// themselves are measured by tests/unit/naturalPlaythrough.test.ts.
// ---------------------------------------------------------------------------------------------------------------------------------
test('browser [flow, NATURAL levels]: Chapter 2 to 3 at earned levels: altar, Dodoria, the Grotto, Zarbon, Guru', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors); defeats = 0;
  const st = fixture({ stopAt: 'cui', sideQuests: false, natural: true });
  const top = Math.max(...st.roster.map((m) => m.level)); expect(top, 'levels are the earned ones, not boosted').toBeLessThan(14);
  await continueFrom(page, st);
  await interact(page, 'landing_altar', policy());                                                    // a player rests before the boss
  await enter(page, 'landing_dodoria', policy());
  let s = await snap(page); expect(s.flags.dodoria_done).toBe(true);
  await enter(page, 'landing_to_cave', policy());
  await interact(page, 'ball2_pick', policy());
  await enter(page, 'cave_to_landing', policy());
  await enter(page, 'landing_to_village', policy());
  await interact(page, 'altar_save', policy());
  await enter(page, 'village_zarbon', policy());
  s = await snap(page); expect(s.flags.zarbon_done).toBe(true);
  await enter(page, 'village_to_guru', policy());
  await enter(page, 'guru_trigger', policy());
  s = await snap(page); expect(s.flags.guru_done).toBe(true); expect(s.chapter).toBe(3);
  console.log(`[natural] chapter 2-3: ${defeats} defeat(s) retried, levels ${s.roster.map((m) => m.id + m.level).join(' ')}`);
  expect(errors).toEqual([]);
});

test('browser [flow, NATURAL levels]: Chapter 4 at earned levels: Guldo, Recoome, Burter and Jeice, Captain Ginyu', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors); defeats = 0;
  const st = fixture({ stopAt: 'guru', sideQuests: false, natural: true });
  expect(Math.max(...st.roster.map((m) => m.level)), 'levels are the earned ones, not boosted').toBeLessThan(18);
  await continueFrom(page, st);
  await enter(page, 'guru_to_village', policy());
  await enter(page, 'village_to_ridge', policy());
  await enter(page, 'ridge_guldo', policy());
  await interact(page, 'ridge_save', policy());
  await enter(page, 'ridge_recoome', policy());
  let s = await snap(page); expect(s.flags.goku_joined).toBe(true);
  await enter(page, 'ridge_duo', policy());
  await interact(page, 'ridge_save', policy());                                                       // rest before the Captain
  await enter(page, 'ridge_ginyu', policy());
  s = await snap(page); expect(s.flags.ginyu_done).toBe(true);
  console.log(`[natural] chapter 4: ${defeats} defeat(s) retried, levels ${s.roster.map((m) => m.id + m.level).join(' ')}`);
  expect(errors).toEqual([]);
});
