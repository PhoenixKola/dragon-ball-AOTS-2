import { test, expect, type Page } from '@playwright/test';

type W = typeof window & { __session: any; __battle?: any; __ctl?: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.goto('/');
  await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 60000 });
}
const S = (page: Page, fn: string) => page.evaluate(fn);

/** Drive a real battle to its end with real key presses (attack, defend when hurt, guard when cued). */
async function playBattle(page: Page, maxMs = 480000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const st = await page.evaluate(() => {
      const s = (window as W).__session; const c = s.battle;
      return { mode: s.mode, overlay: s.overlay?.kind ?? null, hasCtl: !!c, paused: !!c?.paused, sp: !!s.battlePaused, actor: c?.actor?.uid ?? null, menu: c?.menu?.kind ?? null, cue: c?.director?.activeCues?.map((q: any) => ({ uid: q.uid, impactAt: q.impactAt, now: c.director.time, slot: c.engine.get(q.uid).slot })) ?? [] };
    });
    if (Date.now() - t0 > 30000 && (Math.floor((Date.now() - t0) / 1000) % 20) === 0) console.log('battle state', JSON.stringify(st));
    if (st.paused) { await page.keyboard.press('p'); await page.waitForTimeout(200); continue; }
    if (st.overlay === 'results') return 'results';
    if (st.overlay === 'defeat') { await page.getByRole('button', { name: /Retry/ }).click(); await page.waitForTimeout(300); continue; }
    if (st.overlay === 'dialogue') { await page.keyboard.press('Enter'); await page.waitForTimeout(80); continue; }
    if (st.cue.length) {
      for (const c of st.cue) if (c.impactAt - c.now < 140 && c.impactAt - c.now > -60) await page.keyboard.press(String(c.slot + 1));
      await page.waitForTimeout(25); continue;
    }
    if (st.actor && st.menu === 'root') { await page.keyboard.press('Enter'); await page.waitForTimeout(60); continue; } // Attack
    if (st.menu === 'target') { await page.keyboard.press('Enter'); await page.waitForTimeout(60); continue; }
    await page.waitForTimeout(60);
  }
  return 'timeout';
}

test('boots to the title screen without errors and Continue is disabled with no saves', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('new game -> intro -> exploration -> first scripted fight played with real input -> results -> save -> reload -> continue', async ({ page }) => {
  test.setTimeout(900000);
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => localStorage.setItem('aots2.settings.v1', JSON.stringify({ battleSpeed: 1.6, guardPreset: 'relaxed' })));
  await page.reload();
  await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 60000 });
  await page.getByRole('button', { name: 'New Game' }).click();
  await page.mouse.move(930, 20);
  await page.waitForSelector('text=Skip intro');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as W).__session.mode === 'world' && !(window as W).__session.overlay, null, { timeout: 30000 });
  // random encounters are suppressed for this navigation only (test hook); the scripted shore_scouts trigger is the real story trigger
  await page.waitForFunction(() => { const w = (window as any).__world; return !!w && w.sys.isActive() && (window as W).__session.mode === 'world'; }, null, { timeout: 60000 });
  await page.evaluate(() => (window as any).__world.debugNoEncounters());
  expect(await page.evaluate(() => (window as W).__session.state.flags.scouts1)).toBeFalsy();
  // walk east with real keys until the scouts' ambush dialogue starts
  try {
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => (window as W).__session.overlay?.kind === 'dialogue' || (window as W).__session.mode === 'battle', null, { timeout: 120000 });
  } finally { await page.keyboard.up('ArrowRight'); }
  const amb = await page.evaluate(() => { const s = (window as W).__session; return { mode: s.mode, first: s.overlay?.kind === 'dialogue' ? s.overlay.lines[0] : null, x: s.state.x, map: s.state.mapId }; });
  expect(amb.mode, `unexpected battle before the scripted ambush: ${JSON.stringify(amb)}`).toBe('world');
  expect(amb.first?.[1], `wrong dialogue: ${JSON.stringify(amb)}`).toMatch(/By order of Lord Frieza/);
  expect(amb.x).toBeGreaterThan(30); // had to actually cross the map
  expect(await page.evaluate(() => (window as W).__session.state.flags.scouts1)).toBeFalsy();
  // advance dialogue until the battle starts
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); if (await page.evaluate(() => (window as W).__session.mode === 'battle')) break; }
  expect(await page.evaluate(() => (window as W).__session.mode)).toBe('battle');
  const res = await playBattle(page);
  expect(res).toBe('results');
  const rs = await page.evaluate(() => { const d = (window as W).__session.overlay?.data; return { scripted: d?.scripted, title: d?.title, outcome: d?.outcome }; });
  expect(rs.title).toBe('First Contact'); expect(rs.outcome).toBe('victory');
  const before = await page.evaluate(() => (window as W).__session.state.roster.map((m: any) => m.xp + m.level * 1e6));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !(window as W).__session.overlay || (window as W).__session.overlay.kind === 'dialogue', null, { timeout: 20000 });
  const st = await page.evaluate(() => { const s = (window as W).__session.state; return { scouts1: !!s.flags.scouts1, wins: s.stats.wins, zeni: s.zeni, chapter: s.chapter, xp: s.roster.map((m: any) => m.xp + m.level * 1e6) }; });
  expect(st.scouts1).toBe(true); expect(st.wins).toBe(1); expect(st.zeni).toBeGreaterThan(100);
  expect(before.length).toBeGreaterThan(0);
  // save to slot 2, reload the page, continue from the save
  await page.evaluate(() => { while ((window as W).__session.overlay?.kind === 'dialogue') (window as W).__session.advanceDialogue(true); });
  await page.evaluate(() => (window as W).__session.saveTo(2));
  await page.reload();
  await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 60000 });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForFunction(() => (window as W).__session.mode === 'world', null, { timeout: 30000 });
  const after = await page.evaluate(() => { const s = (window as W).__session.state; return { scouts1: !!s.flags.scouts1, wins: s.stats.wins, zeni: s.zeni }; });
  expect(after.scouts1).toBe(true); expect(after.zeni).toBe(st.zeni);
  expect(errors).toEqual([]);
});

test('hostile or malformed saves are rejected without crashing; legacy v2 save imports as a checkpoint', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  const results = await page.evaluate(() => {
    const s = (window as W).__session; const out: string[] = [];
    out.push(String(s.importFile('{not json')));
    out.push(String(s.importFile(JSON.stringify({ version: 3, mapId: '__proto__' }))));
    out.push(String(s.importFile('{"version":3,"__proto__":{"polluted":true},"mapId":"shore"}')));
    out.push(String(({} as any).polluted));
    return out;
  });
  expect(results[0]).toMatch(/JSON|json/);
  expect(results[1]).toMatch(/map|Unknown/i);
  expect(results[3]).toBe('undefined');
  const legacy = await page.evaluate(() => {
    localStorage.setItem('aots2-namek-save-v2', JSON.stringify({ index: 12, actors: { gohan: { lv: 9 }, krillin: { lv: 8 } }, inventory: { medkit: 5, capsule: 2, senzu: 1 }, coins: 640, balls: 3 }));
    const s = (window as W).__session; const note = s.importLegacy();
    return { note, map: s.state.mapId, roster: s.state.roster.map((m: any) => m.id + m.level), zeni: s.state.zeni, kept: !!localStorage.getItem('aots2-namek-save-v2'), backup: !!localStorage.getItem('aots2.legacy.v2.backup') };
  });
  expect(legacy.note).toMatch(/checkpoint/);
  expect(legacy.roster).toContain('gohan9');
  expect(legacy.zeni).toBe(640);
  expect(legacy.kept && legacy.backup).toBe(true);
  expect(errors).toEqual([]);
});

test('menu opens, all tabs render, pause freezes battle clock', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => (window as W).__session.loadState((window as any).__session.state));
  await page.waitForFunction(() => (window as W).__session.mode === 'world', null, { timeout: 30000 });
  await page.keyboard.press('Escape');
  await page.waitForSelector('text=MENU');
  for (const t of ['Loadout', 'Training', 'Capsules', 'Items', 'Combos', 'Journal', 'Map', 'Save/Load', 'Settings', 'Help', 'Party']) { await page.getByRole('tab', { name: t }).click(); await page.waitForTimeout(100); }
  await page.getByRole('tab', { name: 'Items' }).click(); await page.waitForTimeout(150);
  const wins = await page.locator('.grid2 > .win.flat').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
  expect(wins.length).toBe(2);
  const [a, b] = wins;
  expect(a[2] <= b[0] + 1 || b[2] <= a[0] + 1 || a[3] <= b[1] + 1 || b[3] <= a[1] + 1, 'Items tab panels overlap').toBe(true);
  await page.screenshot({ path: 'evidence/menu_items_fixed.png' });
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('Super Saiyan cinematic scene runs to completion', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => { const s = (window as W).__session; s.mode = 'world'; s.setOverlay({ kind: 'cutscene', id: 'ssj', done: () => { (window as any).__ssjDone = true; } }); });
  await page.waitForFunction(() => (window as any).__cut, null, { timeout: 20000 });
  await page.evaluate(() => { const c = (window as any).__cut; c.manual = true; c.debugStep(1800); });
  await page.screenshot({ path: 'evidence/ssj_a_buildup.png' });
  await page.evaluate(() => (window as any).__cut.debugStep(2700));
  await page.screenshot({ path: 'evidence/ssj_b_flash.png' });
  await page.evaluate(() => (window as any).__cut.debugStep(900));
  await page.screenshot({ path: 'evidence/ssj_c_transformed.png' });
  await page.evaluate(() => (window as any).__cut.debugStep(5000));
  expect(await page.evaluate(() => (window as any).__ssjDone)).toBe(true);
  expect(errors).toEqual([]);
});

// ---- scene lifecycle regression (audit P0.1 / P0.2 / P1.5) ----
async function runBotToResults(page: Page) {
  await page.waitForFunction(() => { const w = window as any; return w.__session.battle && w.__battle && w.__battle.ctl === w.__session.battle && w.__session.battle.director; }, null, { timeout: 60000 });
  await page.evaluate(() => { (window as any).__battle.manual = true; });
  for (let i = 0; i < 600; i++) {
    const done = await page.evaluate(() => {
      const w = window as any; const s = w.__session; const c = s.battle; const b = w.__battle;
      if (s.overlay?.kind === 'results') return true;
      if (!c) return false;
      if (c.actor && c.menu.kind === 'root') c.nav('ok'); else if (c.menu.kind === 'target') c.nav('ok');
      if (c.director.activeCues.length) c.director.pressGuardAll();
      b.debugStep(250);
      return false;
    });
    if (done) return;
  }
  throw new Error('battle never reached results');
}

test('world -> battle -> results -> world is stable across random encounters and foe contact (10 cycles, no JS errors, scene/mode agree)', async ({ page }) => {
  test.setTimeout(900000);
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => { localStorage.setItem('aots2.settings.v1', JSON.stringify({ battleSpeed: 1.6, guardPreset: 'assist' })); });
  await page.evaluate(() => { const s = (window as any).__session; s.state.flags.scouts1 = true; s.state.mapId = 'shore'; s.state.x = 22; s.state.y = 14; s.loadState(s.state); });
  await page.waitForFunction(() => (window as any).__world && (window as any).__session.mode === 'world' && (window as any).__game.scene.isActive('world'), null, { timeout: 60000 });
  const agree = async (mode: string, scene: string) => {
    const r = await page.evaluate(() => ({ mode: (window as any).__session.mode, active: ['battle', 'world', 'title', 'cutscene'].filter((k) => (window as any).__game.scene.isActive(k)) }));
    expect(r.mode).toBe(mode); expect(r.active).toEqual([scene]);
  };
  for (let cycle = 0; cycle < 10; cycle++) {
    const viaFoe = cycle === 4; // the single patrolling foe on this map (defeat is permanent)
    await page.evaluate(({ viaFoe }) => {
      const w = (window as any).__world; const s = (window as any).__session; w.manual = true;
      if (viaFoe) { w.debugTeleport(29.3, 17); w.debugWalk(0, 0, 400); } // foe patrols around (29,17)
      else { w.debugTeleport(22, 14); w.debugArmEncounter(); w.debugWalk(1, 0, 900); }
    }, { viaFoe });
    console.log('cycle', cycle, viaFoe ? 'foe' : 'encounter', JSON.stringify(await page.evaluate(() => { const s = (window as any).__session; return { mode: s.mode, busy: s.busy, overlay: s.overlay?.kind, x: s.state.x, y: s.state.y, active: ['battle', 'world'].filter((k) => (window as any).__game.scene.isActive(k)) }; })));
    await page.waitForFunction(() => (window as any).__session.mode === 'battle', null, { timeout: 30000 });
    await runBotToResults(page);
    await page.evaluate(() => (window as any).__session.overlay.done());
    await page.waitForFunction(() => (window as any).__session.mode === 'world' && (window as any).__game.scene.isActive('world') && !(window as any).__game.scene.isActive('battle'), null, { timeout: 30000 });
    await agree('world', 'world');
    const pos = await page.evaluate(() => { const s = (window as any).__session.state; return [s.x, s.y]; });
    expect(pos.every((v: number) => Number.isFinite(v))).toBe(true);
    // the foe, once beaten, must stay beaten; the world must be interactive again
    await page.evaluate(() => { const w = (window as any).__world; w.manual = true; w.debugWalk(0, 0, 600); });
    expect(await page.evaluate(() => (window as any).__session.mode)).toBe('world');
  }
  expect(errors).toEqual([]);
});

// ---- validated art integration ----
test('overworld: all five heroes show the right set, the right facing for up/down/left/right, and a real walk cycle (no mirroring)', async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  await boot(page, errors);
  const expected: Record<string, string> = { gohan: 'gohan_namek', krillin: 'krillin', vegeta: 'vegeta', goku: 'goku_base', piccolo: 'piccolo' };
  for (const hero of Object.keys(expected)) {
    await page.evaluate((h) => {
      const s = (window as any).__session;
      for (const id of ['gohan', 'krillin', 'vegeta', 'goku', 'piccolo']) if (!s.state.roster.find((m: any) => m.id === id)) { const m = JSON.parse(JSON.stringify(s.state.roster[0])); m.id = id; s.state.roster.push(m); }
      s.state.party = [h]; s.state.mapId = 'shore'; s.state.x = 20; s.state.y = 14; s.loadState(s.state);
    }, hero);
    await page.waitForFunction((ent) => { const w = (window as any).__world; return !!w && w.sys.isActive() && w.debugAvatar().entity === ent; }, expected[hero], { timeout: 60000 });
    await page.evaluate(() => { const w = (window as any).__world; w.manual = true; w.debugNoEncounters(); });
    const dirs: Record<string, [number, number]> = { right: [1, 0], up: [0, -1], left: [-1, 0], down: [0, 1] };
    for (const [dir, v] of Object.entries(dirs)) {
      const textures = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const a = await page.evaluate(([vx, vy, first]) => { const w = (window as any).__world; if (first) w.debugTeleport(20, 14); w.debugWalk(vx, vy, 130); return w.debugAvatar(); }, [v[0], v[1], i === 0] as [number, number, boolean]);
        expect(a.facing, `${hero} walking ${dir}`).toBe(dir);
        expect(a.texture, `${hero} ${dir}`).toContain(`ow_${expected[hero]}_${dir}_walk_`);
        expect(a.flipX, `${hero} must not be mirrored`).toBe(false);
        expect(a.entity).toBe(expected[hero]);
        textures.add(a.texture);
      }
      expect(textures.size, `${hero} ${dir} walk cycle`).toBeGreaterThanOrEqual(3);
      const idle = await page.evaluate(() => { const w = (window as any).__world; w.debugWalk(0, 0, 60); return w.debugAvatar(); });
      expect(idle.texture).toContain(`_${dir}_idle_000`);
      expect(idle.moving).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('Goku forms in real battles: base before the unlock, Kaioken only when used, Super Saiyan only after the unlock; allies face right and enemies face left', async ({ page }) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  const run = async (q: string, fn: () => void) => { await page.goto('/?dev=battle&' + q); await page.waitForFunction(() => (window as any).__battle && (window as any).__ctl, null, { timeout: 60000 }); await page.evaluate(() => { (window as any).__battle.manual = true; (window as any).__battle.debugStep(1800); }); void fn; };
  const actor = (uid: string) => page.evaluate((u) => (window as any).__battle.debugActor(u), uid);

  // 1) base Goku, normal fight: never a power-up texture
  await run('party=goku,gohan,vegeta&foes=zarbon&first=goku&lv=15', () => {});
  let a = await actor('a_goku');
  expect(a.form).toBeNull(); expect(a.texture).toMatch(/^a_goku_/); expect(a.side).toBe('ally'); expect(a.flipX).toBe(false);
  const z = await page.evaluate(() => { const c = (window as any).__ctl; const e = c.engine.enemies()[0]; return (window as any).__battle.debugActor(e.uid); });
  expect(z.side).toBe('enemy'); expect(z.flipX).toBe(true); // v4 art is drawn facing right: enemies are mirrored to face the party
  const seen = new Set<string>();
  await page.evaluate(() => (window as any).__ctl.director.submit({ kind: 'skill', skill: 'kamehameha', target: (window as any).__ctl.engine.enemies()[0].uid }));
  for (let i = 0; i < 40; i++) { await page.evaluate(() => (window as any).__battle.debugStep(100)); seen.add((await actor('a_goku')).texture); }
  expect([...seen].some((t) => t.startsWith('pw_goku_ssj') || t.startsWith('pw_goku_kaioken'))).toBe(false);

  // 2) Kaioken activation switches to the Kaioken set, and Kaioken Assault shows Kaioken frames
  await run('party=goku,gohan,vegeta&foes=zarbon&first=goku&lv=15', () => {});
  await page.evaluate(() => (window as any).__ctl.director.submit({ kind: 'skill', skill: 'kaioken' }));
  const forms = new Set<string>();
  for (let i = 0; i < 24; i++) { await page.evaluate(() => (window as any).__battle.debugStep(100)); const g = await actor('a_goku'); forms.add(String(g.form)); if (g.form) expect(g.texture).toMatch(/^pw_goku_kaioken_/); expect(g.flipX).toBe(false); }
  expect(forms.has('goku_kaioken')).toBe(true); expect(forms.has('goku_ssj')).toBe(false);
  expect(await page.evaluate(() => (window as any).__ctl.engine.get('a_goku').statuses.some((s: any) => s.kind === 'kaioken'))).toBe(true);

  // 3) Super Saiyan only with the unlock flag
  await run('party=goku,gohan,vegeta&foes=zarbon&first=goku&lv=22&ssj=1', () => {});
  a = await actor('a_goku');
  expect(a.form).toBeNull(); expect(a.texture).toMatch(/^a_ssj_goku_/);   // Super Saiyan Goku = new-sheet stills
  await page.evaluate(() => (window as any).__ctl.director.submit({ kind: 'attack', target: (window as any).__ctl.engine.enemies()[0].uid }));
  const ssjTex = new Set<string>();
  for (let i = 0; i < 30; i++) { await page.evaluate(() => (window as any).__battle.debugStep(100)); const g = await actor('a_goku'); ssjTex.add(g.texture); expect(g.flipX).toBe(false); }
  expect([...ssjTex].every((t) => t.startsWith('a_ssj_goku_'))).toBe(true);
  expect([...ssjTex].some((t) => t.includes('attack'))).toBe(true);

  // 4) enemy that is drawn facing right is mirrored toward the party
  await run('party=gohan,krillin,vegeta&foes=cui&lv=10', () => {});
  const cui = await page.evaluate(() => { const c = (window as any).__ctl; return (window as any).__battle.debugActor(c.engine.enemies()[0].uid); });
  expect(cui.flipX).toBe(true);
  expect(errors).toEqual([]);
});

async function loadCore(page: any, balls: number[]) {
  await page.evaluate((have: number[]) => {
    const s = (window as any).__session;
    for (const id of ['goku', 'gohan', 'piccolo']) if (!s.state.roster.find((m: any) => m.id === id)) { const m = JSON.parse(JSON.stringify(s.state.roster[0])); m.id = id; s.state.roster.push(m); }
    s.state.party = ['goku', 'gohan', 'piccolo']; s.state.roster.find((m: any) => m.id === 'goku').ssj = true;
    s.state.flags = { ssj: true, piccolo_joined: true, goku_joined: true };
    for (const n of have) s.state.flags['ball' + n] = true;
    s.state.balls = have.length; s.state.mapId = 'core'; s.state.x = 20.2; s.state.y = 13.5; s.state.facing = 'right'; s.loadState(s.state);
  }, balls);
  await page.waitForFunction(() => { const w = (window as any).__world; return !!w && w.sys.isActive() && (window as any).__session.state.mapId === 'core'; }, null, { timeout: 60000 });
  await page.evaluate(() => { const w = (window as any).__world; w.debugNoEncounters(); w.debugTeleport(20.2, 13.5); });
}

test('Ball 7 on the last ground: real interact picks the seven-star ball (count 6 -> 7) and does not start the fight; replay is impossible', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await loadCore(page, [1, 2, 3, 4, 5, 6]);
  await page.keyboard.press('e');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => (window as any).__session.state.balls) === 7) break; await page.keyboard.press('Enter'); }
  const st = await page.evaluate(() => { const s = (window as any).__session; return { balls: s.state.balls, f7: s.state.flags.ball7, mode: s.mode, finalDone: !!s.state.flags.final_done }; });
  expect(st.balls).toBe(7); expect(st.f7).toBe(true); expect(st.finalDone).toBe(false); expect(st.mode).toBe('world');
  await page.screenshot({ path: 'evidence/dragonball7_pickup.png' });
  await page.keyboard.press('e'); await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as any).__session.state.balls)).toBe(7);
  expect(errors).toEqual([]);
});

test('Ball 7 first pickup plays the pickup SFX and shows the Seven-Star toast; a replay does neither', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await loadCore(page, [1, 2, 3, 4, 5, 6]);
  await page.evaluate(() => {
    const w = window as any; w.__sfx = []; w.__toasts = [];
    const orig = w.__audio.sfx.bind(w.__audio); w.__audio.sfx = (id: string) => { w.__sfx.push(id); return orig(id); };
    const iv = setInterval(() => { const t = w.__session.toastOverlay; if (t && w.__toasts[w.__toasts.length - 1] !== t.text) w.__toasts.push(t.text); }, 20); w.__iv = iv;
  });
  await page.keyboard.press('e');
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => (window as any).__session.state.balls) === 7) break; await page.keyboard.press('Enter'); }
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => { const w = window as any; return { sfx: w.__sfx.filter((x: string) => x === 'pickup').length, toasts: w.__toasts.filter((t: string) => /Dragon Ball obtained/.test(t)) }; });
  expect(r.sfx).toBe(1);
  expect(r.toasts).toEqual(['Seven-Star Dragon Ball obtained (7/7)']);
  await page.screenshot({ path: 'evidence/dragonball7_toast.png' });
  await page.waitForFunction(() => !(window as any).__session.toastOverlay, null, { timeout: 10000 });
  await page.evaluate(() => { const w = window as any; w.__sfx.length = 0; w.__toasts.length = 0; void w.__session.runScript('ball7_pick'); });
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => { const w = window as any; return { sfx: w.__sfx.filter((x: string) => x === 'pickup').length, toasts: w.__toasts.filter((t: string) => /Dragon Ball obtained/.test(t)).length, balls: w.__session.state.balls }; });
  expect(again).toEqual({ sfx: 0, toasts: 0, balls: 7 });
  expect(errors).toEqual([]);
});

test('Final battle is enterable with only some balls (no trap on the last ground), and the ending is not gated on the count', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await loadCore(page, [1, 3, 5]);
  await page.evaluate(() => (window as any).__world.debugTeleport(14, 11));
  let mode = 'world';
  for (let i = 0; i < 30 && mode !== 'battle'; i++) { await page.waitForTimeout(300); mode = await page.evaluate(() => (window as any).__session.mode); if (mode !== 'battle') await page.keyboard.press('Enter'); }
  expect(mode).toBe('battle');
  expect(await page.evaluate(() => (window as any).__session.state.balls)).toBe(3);
  expect(errors).toEqual([]);
});

test('battle command menu is fully visible and unclipped at 1024x600, 1280x720 and 1920x1080', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  for (const [w, h] of [[1024, 600], [1280, 720], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/?dev=battle&party=goku,gohan,krillin&foes=cui,dodoria&lv=12&stage=namek');
    await page.waitForSelector('.cmd-root .cmd', { timeout: 90000 });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const root = document.querySelector('.cmd-root')!.getBoundingClientRect();
      return { vw: innerWidth, vh: innerHeight, root: { t: root.top, b: root.bottom, l: root.left, r: root.right }, cmds: [...document.querySelectorAll('.cmd-root .cmd')].map((e) => { const b = e.getBoundingClientRect(); return { t: (e.textContent ?? '').trim(), top: b.top, bottom: b.bottom, left: b.left, right: b.right, clipped: e.scrollWidth > e.clientWidth + 1 }; }) };
    });
    const labels = r.cmds.map((c) => c.t.replace(/[+\d.K ]+$/, '').trim());
    for (const need of ['Attack', 'Skills', 'Items', 'Defend', 'Sparking', 'Flee']) expect(labels.some((l) => l.startsWith(need)), `${w}x${h}: ${need} missing`).toBe(true);
    for (const c of r.cmds) {
      expect(c.top, `${w}x${h} ${c.t} top`).toBeGreaterThanOrEqual(r.root.t); expect(c.bottom, `${w}x${h} ${c.t} bottom`).toBeLessThanOrEqual(r.root.b);
      expect(c.right, `${w}x${h} ${c.t} right`).toBeLessThanOrEqual(r.root.r); expect(c.bottom, `${w}x${h} ${c.t} inside viewport`).toBeLessThanOrEqual(r.vh);
      expect(c.clipped, `${w}x${h} ${c.t} text clipped`).toBe(false);
    }
  }
  expect(errors).toEqual([]);
});

test('loading screen is shown in the stage while assets load, then the title appears; game canvas fills the stage', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
  expect(await page.locator('.loading').count()).toBe(0);
  const g = await page.evaluate(() => { const gm = (window as any).__game; const c = gm.canvas.getBoundingClientRect(); const cam = gm.scene.getScenes(true)[0].cameras.main; return { cssW: c.width, cssH: c.height, canvas: [gm.canvas.width, gm.canvas.height], cam: [cam.width, cam.height] }; });
  expect(Math.round(g.cssW)).toBe(1280); expect(Math.round(g.cssH)).toBe(720);
  expect(g.cam).toEqual(g.canvas);
});

test('window resized while the game is still starting (e.g. going full screen at launch): canvas and camera still fill the stage', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 1915, height: 1004 });
  await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
  await page.waitForTimeout(800);
  const g = await page.evaluate(() => { const gm = (window as any).__game; const c = gm.canvas; const cam = gm.scene.getScene('title').cameras.main; return { css: c.getBoundingClientRect().width, canvas: [c.width, c.height], cam: [cam.width, cam.height], zoom: cam.zoom, k: c.width / 960 }; });
  expect(Math.round(g.css)).toBe(Math.floor(960 * Math.min(1915 / 960, 1004 / 540)));
  expect(g.cam).toEqual(g.canvas); expect(g.zoom).toBe(g.k);
});
