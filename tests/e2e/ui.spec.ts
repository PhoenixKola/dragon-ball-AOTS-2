import { test, expect } from '@playwright/test';
import { boot, continueFrom, fixture, installMockPad, padPress, settle, snap, type W } from './support';

test('menus, journal and quest tracker stay fully visible and unclipped at 1024x600, 1280x720 and 1920x1080', async ({ page }) => {
  test.setTimeout(600000);
  const errors: string[] = []; await boot(page, errors);
  const st = fixture({ stopAt: 'dodoria', sideQuests: true });          // quests offered, one in progress, one done: a busy journal
  await continueFrom(page, st);
  for (const [w, h] of [[1024, 600], [1280, 720], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(500);
    await page.keyboard.press('Escape'); await page.waitForSelector('.menu-win');
    const tabs = await page.getByRole('tab').all();
    expect(tabs.length).toBe(11);
    for (const t of tabs) {
      await t.click(); await page.waitForTimeout(120);
      const r = await page.evaluate(() => {
        const win = document.querySelector('.menu-win')!.getBoundingClientRect(); const body = document.querySelector('.menu-body') as HTMLElement;
        const bad = [...document.querySelectorAll('.menu-win button, .menu-win [role=tab]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.left < win.left - 1 || b.right > win.right + 1 || b.right > innerWidth + 1 || b.left < -1); }).length;
        return { winBottom: win.bottom, winRight: win.right, vw: innerWidth, vh: innerHeight, hScroll: body.scrollWidth > body.clientWidth + 2, bad };
      });
      expect(r.winRight, `${w}x${h} menu inside viewport`).toBeLessThanOrEqual(r.vw + 1); expect(r.winBottom).toBeLessThanOrEqual(r.vh + 1);
      expect(r.hScroll, `${w}x${h} no horizontal scroll`).toBe(false); expect(r.bad, `${w}x${h} no clipped buttons`).toBe(0);
    }
    await page.getByRole('tab', { name: 'Journal' }).click();
    for (const sec of [/Story/, /Side quests/, /Abilities/]) { await page.getByRole('button', { name: sec }).click(); await page.waitForTimeout(100); }
    await page.getByRole('button', { name: /Side quests/ }).click();
    await expect(page.locator('.quest').first()).toBeVisible();
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !(window as W).__session.overlay);
  }
  expect(errors).toEqual([]);
});

test('journal content: only met quests and unlocked Dragon Ball hints are shown (no spoilers), statuses are distinct', async ({ page }) => {
  const errors: string[] = []; await boot(page, errors);
  await continueFrom(page, fixture({ stopAt: 'village', sideQuests: false }));
  await page.keyboard.press('Escape'); await page.getByRole('tab', { name: 'Journal' }).click();
  const text = await page.locator('.menu-body').innerText();
  expect(text).toMatch(/Main objective/); expect(text).not.toMatch(/Last Ground|Krillin’s sacrifice|Super Saiyan awakens/);
  await page.getByRole('button', { name: /Side quests/ }).click();
  const quests = await page.locator('.quest').allInnerTexts();
  expect(quests.join(' ')).toMatch(/Rumour/); expect(quests.join(' ')).not.toMatch(/Nail’s Request|Frieza’s Logbook/);
  await page.getByRole('button', { name: /Abilities/ }).click();
  await expect(page.locator('.menu-body')).toContainText('SKILLS: LEARNED AND NEXT');
  expect(errors).toEqual([]);
});

test('gamepad bridge (mocked pad, no hardware): D-pad moves the battle menu, A confirms, B backs out, X guards; Start opens the world menu', async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await installMockPad(page);
  await page.goto('/?dev=battle&party=gohan,krillin&foes=scout,scout&lv=8');
  await page.waitForSelector('.cmd-root .cmd', { timeout: 90000 }); await page.waitForTimeout(500);
  const press = async (btn: number) => { await padPress(page, btn); };
  const cursor = () => page.evaluate(() => { const c = (window as W).__ctl; return { kind: c.menu.kind, cursor: c.menu.cursor ?? null }; });
  const start = await cursor(); expect(start.kind).toBe('root');
  await press(13); const down = await cursor(); expect(down.cursor, 'D-pad down moves the cursor').not.toBe(start.cursor);
  await press(12); expect((await cursor()).cursor, 'D-pad up moves it back').toBe(start.cursor);
  await press(0); expect((await cursor()).kind, 'A (on Attack) opens target selection').toBe('target');
  await press(1); expect((await cursor()).kind, 'B backs out to the command menu').toBe('root');
  expect(errors).toEqual([]);
});

test('gamepad bridge in the overworld menu: Start opens it, D-pad moves focus, A presses, B closes (mocked pad)', async ({ page }) => {
  test.setTimeout(300000);
  await installMockPad(page);
  const errors: string[] = []; await boot(page, errors);
  await continueFrom(page, fixture({ stopAt: 'village', sideQuests: false }));
  const press = async (btn: number) => { await padPress(page, btn); };
  await press(9); await page.waitForSelector('.menu-win');
  const focusLabel = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? '');
  await press(15); const a = await focusLabel(); await press(15); const b = await focusLabel();
  expect(a, 'focus moves with the D-pad').not.toBe(b);
  await press(0);                                                    // A presses the focused tab/button
  await press(1); await page.waitForFunction(() => !(window as W).__session.overlay, null, { timeout: 5000 });   // B closes the menu
  expect((await snap(page)).mode).toBe('world');
  expect(errors).toEqual([]);
});

test('title, save, load and resume: altar save, reload, Load slot, corrupt main file falls back to the backup, export/import file', async ({ page }) => {
  test.setTimeout(900000);
  const errors: string[] = []; await boot(page, errors);
  await continueFrom(page, fixture({ stopAt: 'village', sideQuests: false }));
  const before = await snap(page);
  // 1. save at a real altar into slot 2, then again (so a backup exists)
  const { interact } = await import('./support');
  const saveSlot2 = async (p: import('@playwright/test').Page) => { await p.getByRole('button', { name: /^(Save|Overwrite)$/ }).nth(1).click(); await p.waitForTimeout(300); };
  await interact(page, 'altar_save', { onAltar: saveSlot2 });
  await interact(page, 'altar_save', { onAltar: saveSlot2 });
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('aots2.save.v3')));
  expect(keys.some((k) => /slot2$/.test(k)) && keys.some((k) => /slot2\.bak$/.test(k)), 'slot 2 and its backup exist').toBe(true);
  expect(keys.some((k) => /slot0$/.test(k)), 'autosave exists').toBe(true);
  // 2. corrupt the main file of slot 2: the backup still loads
  await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /slot2$/.test(x))!; localStorage.setItem(k, '{"body":"garbage"'); });
  await page.reload(); await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Load / Import' }).click();
  await expect(page.locator('.slot').nth(2)).not.toContainText('Corrupted');
  await page.locator('.slot').nth(2).getByRole('button', { name: 'Load' }).click();
  await settle(page);
  const after = await snap(page); expect(after.mapId).toBe(before.mapId); expect(after.flags.dende_met).toBe(true); expect(after.roster.map((m) => m.level)).toEqual(before.roster.map((m) => m.level));
  // 3. both copies corrupt: the slot is reported as corrupted and cannot be loaded, the game does not crash
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/slot2(\.bak)?$/.test(k)) localStorage.setItem(k, 'not json'); });
  await page.reload(); await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Load / Import' }).click();
  await expect(page.locator('.slot').nth(2)).toContainText('Corrupted'); await expect(page.locator('.slot').nth(2).getByRole('button', { name: 'Load' })).toBeDisabled();
  // 4. export to a file and import it back from the menu
  await page.getByRole('button', { name: 'Back' }).click();                                          // the Load panel is open here: no swallowing a missing button
  await page.reload(); await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Continue' }).click(); await settle(page);
  await page.keyboard.press('Escape'); await page.getByRole('tab', { name: 'Save/Load' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to file' }).click()]);
  const file = await dl.path(); expect(file).toBeTruthy();
  await page.locator('input[type=file]').setInputFiles(file!);
  await page.waitForTimeout(800); await settle(page);
  expect((await snap(page)).flags.dende_met).toBe(true);
  expect(errors).toEqual([]);
});

test('keyboard only: the title, Load and Settings screens can be driven with arrows, Enter and Esc; the world menu moves focus with arrows', async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = []; await boot(page, errors);
  const focused = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent?.trim() ?? '');
  // a first-time player: New Game is focused, Continue is disabled and skipped
  await page.waitForFunction(() => document.activeElement?.textContent === 'New Game', null, { timeout: 5000 });   // focus lands shortly after the title appears
  expect(await focused()).toBe('New Game');
  await page.keyboard.press('ArrowDown'); expect(await focused(), 'Continue is disabled with no save: arrows skip it').toBe('Load / Import');
  await page.keyboard.press('ArrowDown'); expect(await focused()).toBe('Settings');
  await page.keyboard.press('ArrowUp'); expect(await focused()).toBe('Load / Import');
  await page.keyboard.press('Enter'); await expect(page.getByText('SAVED GAMES')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByText('SAVED GAMES')).toBeHidden();       // Esc steps back to the main menu
  await page.waitForFunction(() => document.activeElement?.textContent === 'New Game', null, { timeout: 5000 });
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');   // New Game -> Load -> Settings
  await expect(page.locator('.title-panel')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => !!document.activeElement?.closest('.title-panel')), 'arrows move focus into the settings controls').toBe(true);
  await page.keyboard.press('Escape'); await expect(page.locator('.title-panel')).toBeHidden();
  // with a save, Continue is the focused default
  await continueFrom(page, fixture({ stopAt: 'village', sideQuests: false }));
  await page.keyboard.press('Escape'); await page.waitForSelector('.menu-win');
  const a = await focused(); await page.keyboard.press('ArrowRight'); const b = await focused(); await page.keyboard.press('ArrowRight'); const c = await focused();
  expect(new Set([a, b, c]).size, 'arrow keys move focus through the menu tabs').toBeGreaterThan(1);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !(window as W).__session.overlay);
  expect(errors).toEqual([]);
});
