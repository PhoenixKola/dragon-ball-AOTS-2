import { expect, test } from '@playwright/test';
import { MAPS } from '../../src/data/maps';
import { newGameState } from '../../src/systems/gameState';
import { boot, continueFrom, fixture, settle, snap, type W } from './support';

test.use({ launchOptions: { args: ['--use-angle=d3d11', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] } });

test('Namek field ambience renders and patrols use directional walk cycles', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  await boot(page, errors);
  await page.screenshot({ path: 'evidence/overhaul/title_current.png' });
  const state = fixture({ stopAt: 'ginyu' });
  state.mapId = 'shore'; state.x = 20; state.y = 13; state.flags.scouts1 = true; delete state.flags['foe:shore_foe1'];
  await continueFrom(page, state);
  await settle(page);
  await expect(page.getByRole('img', { name: 'Minimap of Azure Shore; gold arrow marks your position and facing' })).toBeVisible();
  const minimap = await page.locator('.hud-minimap').evaluate((el) => {
    const player = el.querySelector<SVGGElement>('.minimap-player')!;
    const [, x, y] = (player.getAttribute('transform') ?? '').match(/translate\(([-\d.]+)\s+([-\d.]+)\)/) ?? [];
    const st = (window as W).__session.state;
    return { terrainCells: el.querySelectorAll('svg rect').length, x: Number(x), y: Number(y), expectedX: st.x * 4, expectedY: st.y * 4 };
  });
  expect(minimap.terrainCells).toBeGreaterThan(100);
  expect(Math.abs(minimap.x - minimap.expectedX)).toBeLessThan(0.02);
  expect(Math.abs(minimap.y - minimap.expectedY)).toBeLessThan(0.02);
  await page.screenshot({ path: 'evidence/overhaul/world/shore_minimap_1280.png' });

  const initial = await page.evaluate(() => {
    const w = (window as W).__world;
    const foe = w.ents.find((e: any) => e.ent.id === 'shore_foe1');
    return { texture: foe.img.texture.key, x: foe.x, motes: w.ambient.length, ambientDepth: w.ambientG.depth, grassTexture: w.textures.exists('t_grass_namek_v2') };
  });
  expect(initial.motes).toBeGreaterThan(0);
  expect(initial.ambientDepth).toBe(0);
  expect(initial.grassTexture).toBe(true);

  await page.evaluate(() => { const w = (window as W).__world; w.manual = true; w.debugWalk(0, 0, 900); });
  const after = await page.evaluate(() => {
    const w = (window as W).__world;
    const foe = w.ents.find((e: any) => e.ent.id === 'shore_foe1');
    return { texture: foe.img.texture.key, x: foe.x };
  });
  expect(Math.abs(after.x - initial.x)).toBeGreaterThan(10);
  expect(after.texture).toContain('ow_soldier_');
  expect(after.texture).not.toBe(initial.texture);
  const beforeWalkX = (await snap(page)).x;
  await page.evaluate(() => { const w = (window as W).__world; w.manual = true; w.debugWalk(1, 0, 500); });
  await page.waitForFunction((oldX) => (window as W).__session.state.x !== oldX, beforeWalkX, { timeout: 5000 });
  const markerAfterWalk = await page.locator('.minimap-player').getAttribute('transform');
  const stateAfterWalk = await page.evaluate(() => ({ x: (window as W).__session.state.x, y: (window as W).__session.state.y }));
  expect(markerAfterWalk).toContain(`${stateAfterWalk.x * 4} ${stateAfterWalk.y * 4}`);
  await expect(page.locator('.minimap-player polygon')).toHaveAttribute('points', '2,0 -2,-2 -2,2');
  await page.waitForTimeout(1000);
  const fps = await page.evaluate(() => (window as W).__game.loop.actualFps);
  const rafFps = await page.evaluate(() => new Promise<number>((resolve) => {
    let frames = 0; const start = performance.now();
    const tick = (now: number) => { frames++; if (now - start >= 900) resolve(frames * 1000 / (now - start)); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  console.log('shore field FPS sample', { phaser: fps, browserRaf: rafFps });
  expect(fps).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'evidence/overhaul/world/shore_patrol_1280.png' });
});

test('Namek battle stages render a separate animated atmosphere layer', async ({ page }) => {
  await page.goto('/?dev=battle&stage=water&party=goku,gohan,piccolo&foes=zarbon&title=Zarbon&intro=Zarbon%20transforms%20at%20half%20health.%20Watch%20his%20Ki.');
  await page.waitForFunction(() => !!(window as W).__battle && !!(window as W).__ctl, null, { timeout: 60000 });
  await expect(page.locator('.encounter-intro')).toContainText('ZARBON');
  const layer = await page.evaluate(() => {
    const b = (window as W).__battle;
    b.bg.update(300);
    return b.bg.objects.map((o: any) => o.type);
  });
  expect(layer).toContain('Image');
  expect(layer).toContain('Graphics');
  await page.screenshot({ path: 'evidence/overhaul/battle/water-stage-960.png' });
  await page.getByRole('button', { name: 'Dismiss encounter briefing' }).click();
  await expect(page.locator('.encounter-intro')).toHaveCount(0);
});

test('opening voyage stages the capsule landing before handing over Namek', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  await boot(page, errors);
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.waitForSelector('text=Skip intro');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'evidence/overhaul/cinematics/namek_orbit_approach_1280.png' });
  for (let line = 0; line < 6; line++) { await page.keyboard.press('Enter'); await page.waitForTimeout(90); }
  await expect(page.locator('.dlg-text')).toContainText('capsule settles');
  await expect(page.locator('.dlg-foot')).toContainText('Landing in progress');
  await expect(page.locator('.dlg-foot')).toContainText('Enter Namek', { timeout: 15000 });
  await page.screenshot({ path: 'evidence/overhaul/cinematics/namek_landing_1280.png' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as W).__session?.mode === 'world' && !(window as W).__session.overlay, null, { timeout: 30000 });
  expect(errors).toEqual([]);
});

test('Dende rescue is staged in the village before its existing dialogue and battle', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  await boot(page, errors);
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  const state = fixture({ stopAt: 'ginyu' }); state.mapId = 'village'; state.x = 3; state.y = 15; state.flags.scouts1 = true; delete state.flags.dende_met;
  await continueFrom(page, state);
  await page.evaluate(() => { void (window as W).__session.runScript('village_enter'); });
  await expect(page.locator('.dlg-text')).toContainText('cornered Dende');
  await expect(page.locator('.dlg-text')).toContainText('rush in', { timeout: 5000 });
  await page.screenshot({ path: 'evidence/overhaul/cinematics/dende_rescue_1280.png' });
  await page.waitForFunction(() => (window as W).__session.overlay?.kind === 'dialogue', null, { timeout: 10000 });
  await expect(page.locator('.dlg-text')).toContainText('Come out');
  expect(errors).toEqual([]);
});

test('opening Cooler’s postgame rift lights the Namek Highlands route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  await boot(page, errors);
  const state = fixture({ stopAt: 'credits' }); state.mapId = 'ridge'; state.x = 45; state.y = 10.6;
  state.flags.postgame_unlocked = true; state.flags.cooler_trail_open = true;
  await page.evaluate((s) => (window as W).__session.loadState(s), state);
  await page.waitForFunction(() => {
    const w = (window as W).__world;
    return (window as W).__session?.mode === 'world' && w?.map.id === 'ridge' && w.ents.some((e: any) => e.ent.id === 'ridge_rift');
  }, null, { timeout: 30000 });
  await page.waitForTimeout(2800);
  const effect = await page.evaluate(() => {
    const w = (window as W).__world, rift = w.ents.find((e: any) => e.ent.id === 'ridge_rift');
    return { commands: w.riftG.commandBuffer.length, depth: w.riftG.depth, markerY: rift.y };
  });
  expect(effect.commands).toBeGreaterThan(0); expect(effect.depth).toBeLessThan(effect.markerY);
  await page.screenshot({ path: 'evidence/overhaul/world/ridge_rift_open_1280.png' });
  expect(errors).toEqual([]);
});

test('Ginyu’s final Body Change is intercepted by the Namekian frog', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => (window as W).__session.setOverlay({ kind: 'cutscene', id: 'ginyu_frog', done: () => {} }));
  await expect(page.locator('.dlg-text')).toContainText('last Body Change');
  await expect(page.locator('.dlg-text')).toContainText('frog leaps', { timeout: 5000 });
  await page.waitForTimeout(850);
  await page.screenshot({ path: 'evidence/overhaul/cinematics/ginyu_frog_intercept_1280.png' });
  await expect(page.locator('.dlg-text')).toContainText('Ginyu is a frog', { timeout: 6000 });
  await expect(page.locator('canvas')).toHaveCount(2);
  await page.screenshot({ path: 'evidence/overhaul/cinematics/ginyu_frog_aftermath_1280.png' });
  expect(errors).toEqual([]);
});

test('Frieza’s final-form reveal uses the actual old and new form art', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => (window as W).__session.setOverlay({ kind: 'cutscene', id: 'frieza_final', done: () => {} }));
  await expect(page.locator('.dlg-text')).toContainText('body contracts');
  await expect(page.locator('.dlg-text')).toContainText('sleek final form', { timeout: 5000 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'evidence/overhaul/cinematics/frieza_final_form_1280.png' });
  await expect(page.locator('canvas')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('Cooler appears in the Frozen Ruins before the fight choice', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => (window as W).__session.setOverlay({ kind: 'cutscene', id: 'cooler_reveal', done: () => {} }));
  await expect(page.locator('.dlg-text')).toContainText('frost falls silent');
  await expect(page.locator('.dlg-text')).toContainText('Cooler steps forward', { timeout: 5000 });
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'evidence/overhaul/cinematics/cooler_reveal_1280.png' });
  await expect(page.getByText('Fight')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Reduce Flash freezes overworld ambience without removing its visible detail', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors, { settings: { reducedFlash: true } });
  const state = fixture({ stopAt: 'ginyu' }); state.mapId = 'shore'; state.x = 20; state.y = 13;
  await page.evaluate((s) => (window as W).__session.loadState(s), state);
  await page.waitForFunction(() => (window as W).__session?.mode === 'world' && (window as W).__world?.sys.isActive());
  await page.waitForTimeout(180);
  const npcStep = await page.evaluate(() => {
    const w = (window as W).__world, npc = w.ents.find((e: any) => e.ent.id === 'ship');
    w.t = 6800 + 4700 - npc.idlePhaseMs; w.draw(0);
    const stepping = npc.img.texture.key;
    w.t = 6800 + 1000 - npc.idlePhaseMs; w.draw(0);
    return { stepping, resting: npc.img.texture.key };
  });
  expect(npcStep.stepping).toContain('ow_bulma_down_walk_');
  expect(npcStep.resting).toContain('ow_bulma_down_idle_');
  const before = await page.evaluate(() => (window as W).__world.ambient.map((p: any) => [p.x, p.y]));
  const visible = await page.evaluate(() => (window as W).__world.ambientG.active);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as W).__world.ambient.map((p: any) => [p.x, p.y]));
  expect(visible).toBe(true); expect(after).toEqual(before); expect(errors).toEqual([]);
});

test('selected registered world maps render at their real spawns with terrain and ambience', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  await boot(page, errors);
  const mapId = process.env.WORLD_MAP_ID;
  const maps = Object.values(MAPS).filter((map) => !mapId || map.id === mapId);
  expect(maps.length, `Unknown WORLD_MAP_ID ${mapId}`).toBeGreaterThan(0);
  for (const map of maps) {
    const state = newGameState(); state.mapId = map.id; state.x = map.spawn.x; state.y = map.spawn.y;
    await page.evaluate((s) => (window as W).__session.loadState(s), state);
    await page.waitForFunction((id) => {
      const w = (window as W).__world, s = (window as W).__session;
      return s?.mode === 'world' && s.state.mapId === id && !!w && w.sys.isActive();
    }, map.id, { timeout: 30000 });
    await page.waitForTimeout(2800);
    const scene = await page.evaluate(() => {
      const w = (window as W).__world;
      return { map: w.map.id, motes: w.ambient.length, cameraZoom: w.cameras.main.zoom, ambient: w.ambientG.active };
    });
    expect(scene.map).toBe(map.id); expect(scene.motes).toBeGreaterThan(0); expect(scene.ambient).toBe(true);
    await page.screenshot({ path: `evidence/overhaul/world/${map.id}_1280.png` });
    if (map.id === 'village') {
      const villagers = await page.evaluate(() => {
        const w = (window as W).__world;
        return ['village_trader', 'village_healer', 'village_npc1', 'village_npc2'].map((id) => {
          const e = w.ents.find((entity: any) => entity.ent.id === id);
          return { id, texture: e?.img?.texture.key };
        });
      });
      expect(villagers.map((e) => e.texture)).toEqual([
        expect.stringContaining('ow_namek_trader_'), expect.stringContaining('ow_namek_elder_'),
        expect.stringContaining('ow_namek_child_'), expect.stringContaining('ow_namek_villager_'),
      ]);
      const merchant = await page.evaluate(() => {
        const w = (window as W).__world;
        const e = w.ents.find((entity: any) => entity.ent.id === 'village_trader');
        if (!e) return null;
        w.px = e.x - 90; w.py = e.y + 18;
        w.t = (((5000 - e.idlePhaseMs) % 6800) + 6800) % 6800;
        w.draw(0);
        return { key: e.img.texture.key, phase: e.idlePhaseMs };
      });
      expect(merchant?.key).toContain('ow_namek_trader_left_walk_');
      await page.screenshot({ path: 'evidence/overhaul/world/village_trader_fidget_1280.png' });
    }
    if (map.id === 'ridge') {
      const villager = await page.evaluate(() => (window as W).__world.ents.find((e: any) => e.ent.id === 'hurt_namek')?.img?.texture.key);
      expect(villager).toContain('ow_namek_villager_');
    }
  }
  expect(errors).toEqual([]);
});
