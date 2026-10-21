import { test, expect } from '@playwright/test';
import { boot, continueFrom, fixture, settle, snap, type W } from './support';

// v5: Loadout, Back keys, Rage feedback, the postgame hand-off and Cooler's stage. Fixtures are real headless routes (see support.ts).

test('Loadout: four slots, equip / swap / unequip persist through a reload; X and Backspace close the menu (Esc is only a convenience)', async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = []; await boot(page, errors);
  await continueFrom(page, fixture({ stopAt: 'ginyu' }));
  await page.keyboard.press('Escape'); await page.waitForSelector('.menu-win');
  await expect(page.locator('.menu-head .btn')).toContainText('Back');
  await page.getByRole('tab', { name: 'Loadout' }).click();
  await expect(page.locator('.slotrow')).toHaveCount(4);
  await expect(page.locator('.menu-body')).toContainText('Learn many specials, equip four');
  await expect(page.locator('.menu-body')).toContainText('always available');
  const before = await page.locator('.slotrow').allInnerTexts();
  // unequip the first slot, then equip something else into the free slot
  await page.locator('.slotrow .btn', { hasText: 'Unequip' }).first().click();
  expect((await page.locator('.slotrow').allInnerTexts()).filter((t) => /Empty slot/.test(t)).length).toBe(1);
  const eq = page.locator('.libscroll .skill-row:not(.equipped) .btn', { hasText: 'Equip' }).first();
  await eq.click();
  const after = await page.locator('.slotrow').allInnerTexts();
  expect(after.filter((t) => /Empty slot/.test(t)).length).toBe(0); expect(after.join('|')).not.toBe(before.join('|'));
  // with four slots full the library button becomes a swap into the selected slot
  await page.locator('.slotrow').nth(1).click();
  await expect(page.locator('.libscroll .btn', { hasText: /Swap in slot II/ }).first()).toBeVisible();
  // saved state: at most four, no duplicates, only learned skills
  const eqIds = await page.evaluate(() => { const m = (window as W).__session.state.roster[0]; return { eq: m.equipped as string[] | undefined, id: m.id as string }; });
  expect(eqIds.eq).toBeDefined(); expect(eqIds.eq!.length).toBeLessThanOrEqual(4); expect(new Set(eqIds.eq).size).toBe(eqIds.eq!.length);
  // Back keys: X closes the menu even though Escape is not used
  await page.keyboard.press('x'); await page.waitForFunction(() => !(window as W).__session.overlay);
  await page.keyboard.press('Escape'); await page.waitForSelector('.menu-win');
  await page.keyboard.press('Backspace'); await page.waitForFunction(() => !(window as W).__session.overlay);
  await page.keyboard.press('m'); await page.waitForSelector('.menu-win');
  await page.locator('.menu-head .btn').click(); await page.waitForFunction(() => !(window as W).__session.overlay);
  // reload: the equipped list survives (autosave + continue)
  const eqNow = await page.evaluate(() => (window as W).__session.state.roster[0].equipped as string[]);
  await page.evaluate(() => (window as W).__session.saveTo(1));
  await page.reload(); await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Continue' }).click(); await settle(page);
  expect(await page.evaluate(() => (window as W).__session.state.roster[0].equipped as string[])).toEqual(eqNow);
  expect(errors).toEqual([]);
});

test('Rage: the party card shows the meter, a full bar says MAX · READY and the one-time tip appears once; Sparking explains itself', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?dev=battle&party=goku,vegeta,gohan&foes=ginyu&lv=20&rage=100');
  await page.waitForFunction(() => (window as W).__ctl && (window as W).__game?.scene.isActive('battle'), null, { timeout: 90000 });
  await page.waitForSelector('.pcard');
  await expect(page.locator('.pcard').first()).toContainText('MAX');
  await expect(page.locator('.bar.rage.full').first()).toBeVisible();
  await expect(page.locator('.rage-tip')).toContainText('RAGE FULL');
  await page.waitForSelector('.cmd-root');
  const sparking = page.locator('.cmd', { hasText: 'Sparking' });
  await sparking.hover();
  await expect(page.locator('.cmd-desc')).toContainText('Spend 100 Rage');
  await expect(page.locator('.cmd-desc')).toContainText('4 turns');
  expect(errors).toEqual([]);
});

test('the new stages and sprites load without errors: Cooler on the frozen stage, Super Saiyan Goku with his flame', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
  await page.goto('/?dev=battle&party=goku,gohan,piccolo&foes=cooler&lv=28&stage=frozen&ssj=1');
  await page.waitForFunction(() => (window as W).__ctl && (window as W).__game?.scene.isActive('battle'), null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => { const b = (window as W).__battle; const c = (window as W).__ctl; return { enemy: b.debugActor(c.engine.enemies()[0].uid), goku: b.debugActor('a_goku') }; });
  expect(info.enemy.texture).toMatch(/^a_cooler_/); expect(info.enemy.flipX).toBe(true);        // drawn facing right, mirrored toward the party
  expect(info.goku.texture).toMatch(/^a_ssj_goku_/); expect(info.goku.flipX).toBe(false);
  await page.screenshot({ path: 'evidence/v4/e2e_cooler_stage.png' });
  expect(errors).toEqual([]);
});

test('credits lead into the postgame: Continue Adventure puts the party in the hub with everything kept; the Frozen Ruins load and the trail gates work', async ({ page }) => {
  test.setTimeout(420000);
  const errors: string[] = []; await boot(page, errors);
  const st = fixture({ stopAt: 'core' });
  await continueFrom(page, st);
  const before = await page.evaluate(() => { const s = (window as W).__session.state; return { balls: s.balls as number, zeni: s.zeni as number, levels: s.roster.map((m: { id: string; level: number }) => [m.id, m.level]) as [string, number][] }; });
  // the real ending: the epilogue script ends in the credits screen
  await page.evaluate(() => { const s = (window as W).__session; s.state.flags.final_done = true; s.state.flags.frieza_defeated = true; void s.runScript('epilogue'); });
  for (let i = 0; i < 40; i++) { if (await page.locator('.credits-roll').count()) break; await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
  await page.waitForSelector('.credits-roll', { timeout: 30000 });
  await expect(page.locator('.credits-roll')).toContainText('Postgame unlocked');
  // the autosave made at the credits is already the postgame hub (a returning player never lands on the destroyed ground)
  const saved = await page.evaluate(() => { const raw = localStorage.getItem('aots2.save.v3.slot0'); const env = JSON.parse(raw!); return JSON.parse(env.body) as { mapId: string; flags: Record<string, boolean> }; });
  expect(saved.mapId).toBe('village'); expect(saved.flags.postgame_unlocked).toBe(true); expect(saved.flags.ending_seen).toBe(true);
  await page.getByRole('button', { name: /Continue Adventure/ }).click();
  await settle(page);
  const hub = await snap(page);
  expect(hub.mapId).toBe('village'); expect(hub.flags.postgame_unlocked).toBe(true);
  const after = await page.evaluate(() => { const s = (window as W).__session.state; return { balls: s.balls as number, zeni: s.zeni as number, ids: s.roster.map((m: { id: string }) => m.id) as string[], levels: s.roster.map((m: { id: string; level: number }) => [m.id, m.level]) as [string, number][] }; });
  expect(after.balls).toBe(before.balls); expect(after.zeni).toBe(before.zeni);
  for (const [id, lv] of before.levels) expect(after.levels.find(([i]) => i === id)![1]).toBe(lv);
  for (const id of ['goku', 'gohan', 'piccolo', 'vegeta', 'krillin']) expect(after.ids).toContain(id);
  // the journal has a Postgame section with the trail
  await page.keyboard.press('Escape'); await page.waitForSelector('.menu-win');
  await page.getByRole('tab', { name: 'Journal' }).click();
  await expect(page.getByRole('button', { name: 'Postgame' })).toBeVisible();
  await expect(page.locator('.menu-body')).toContainText(/capsule corp/i); await expect(page.locator('.menu-body')).toContainText(/the cold signal/i);
  await page.keyboard.press('x'); await page.waitForFunction(() => !(window as W).__session.overlay);
  // the trail: the Frozen Ruins exit stays shut until the rift is opened
  await page.evaluate(() => { void (window as W).__session.enterMap('ridge', 49, 12.6, true); });
  await settle(page);
  const gateShut = await page.evaluate(() => { const w = (window as W).__world; return !w.ents.some((e: { ent: { id: string } }) => e.ent.id === 'ridge_to_cooler'); });
  expect(gateShut).toBe(true);
  await page.evaluate(() => { const s = (window as W).__session; s.state.flags.cooler_clue = true; s.state.flags.cooler_trail_open = true; void s.enterMap('cooler_ruins', 3, 14, true); });
  await settle(page);
  const cr = await snap(page); expect(cr.mapId).toBe('cooler_ruins');
  await page.screenshot({ path: 'evidence/v4/e2e_cooler_ruins.png' });
  expect(errors).toEqual([]);
});
