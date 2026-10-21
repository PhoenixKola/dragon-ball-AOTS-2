import type { Page } from '@playwright/test';
import { MAPS } from '../../src/data/maps';
import { TILE } from '../../src/engine/world/mapTypes';
import { condMet, type GameState } from '../../src/systems/gameState';
import { serialize } from '../../src/systems/save';
import { statsOf } from '../../src/systems/party';
import { StoryDriver } from '../support/storyDriver';
import { playStory, type PlanOptions } from '../support/storyPlan';
import { findPath, solidsFor, type Pt } from '../support/pathing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type W = typeof window & { __session: any; __battle?: any; __ctl?: any; __world?: any; __game?: any };

export async function boot(page: Page, errors: string[], opts: { settings?: Record<string, unknown> } = {}) {
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('CONSOLE ' + m.text()); });
  await page.goto('/');
  await page.evaluate((s) => localStorage.setItem('aots2.settings.v1', JSON.stringify({ battleSpeed: 1.6, guardPreset: 'relaxed', fullscreen: false, ...s })), opts.settings ?? {});
  await page.reload();
  await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
}

/**
 * A save made by the headless route at a story milestone.
 *  - default: the cheap model (every fight auto-won, party rested). Flags and levels are what a player has there, but training points are unspent.
 *  - `natural: true`: the route is really PLAYED with the combat engine and ordinary player upkeep (training points spent, capsules worn, kits carried, HP/Ki carried over).
 *  - `levelTo`: BOOSTED fixture. Every hero is set to that level (used only where the browser bot would otherwise lose a long boss fight); tests that use it say so in their name.
 */
export function fixture(plan: PlanOptions & { seed?: number; levelTo?: number; natural?: boolean } = {}): GameState {
  const d = new StoryDriver({ seed: plan.seed ?? 11, ...(plan.natural ? { fights: 'play' as const, style: { name: 'e2e', perfect: 0.15, good: 0.3, maxRetries: 60 } } : {}) }); playStory(d, plan);
  if (plan.levelTo) for (const m of d.s.roster) { m.level = plan.levelTo; const st = statsOf(m); m.hp = st.hp; m.ki = st.ki; }
  return d.s;
}

/** Writes the fixture into a save slot, reloads the page and presses Continue, like a returning player. */
export async function continueFrom(page: Page, state: GameState, slot = 1) {
  const text = serialize({ ...state, savedAt: Date.now() });
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`aots2.save.v3.slot${slot}`, text] as [string, string]);
  await page.reload();
  await page.waitForFunction(() => (window as W).__session?.mode === 'title', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await settle(page);
}

export async function snap(page: Page) {
  return page.evaluate(() => {
    const s = (window as W).__session; const st = s.state;
    return { mode: s.mode as string, overlay: (s.overlay?.kind ?? null) as string | null, mapId: st.mapId as string, x: st.x as number, y: st.y as number, flags: { ...st.flags } as Record<string, boolean>, chapter: st.chapter as number, party: [...st.party] as string[], roster: st.roster.map((m: { id: string; level: number; xp: number; ssj?: boolean }) => ({ id: m.id, level: m.level, xp: m.xp, ssj: !!m.ssj })), zeni: st.zeni as number, inventory: { ...st.inventory } as Record<string, number>, balls: st.balls as number, toast: (s.toastOverlay?.text ?? null) as string | null, busy: (s.busy ?? 0) as number };
  });
}
export type Snap = Awaited<ReturnType<typeof snap>>;
const asState = (s: Snap) => ({ flags: s.flags, inventory: s.inventory } as unknown as GameState);

/** Wait until the world scene is live and no overlay is open, then stop random encounters for the test's own navigation (the test-only hook). */
export async function settle(page: Page, noEnc = true) {
  await page.waitForFunction(() => { const w = (window as W).__world; const s = (window as W).__session; return s.mode === 'world' && !s.overlay && !s.busy && !!w && w.sys.isActive(); }, null, { timeout: 120000 });
  await page.waitForTimeout(450);   // spawn grace
  if (noEnc) await page.evaluate(() => (window as W).__world?.debugNoEncounters());
}

const zoneInside = (e: { x: number; y: number; w?: number; h?: number }, p: Pt) => { const w = (e.w ?? 1) * TILE, h = (e.h ?? 1) * TILE; return p.x >= e.x * TILE - w / 2 && p.x <= e.x * TILE + w / 2 && p.y >= e.y * TILE - h / 2 && p.y <= e.y * TILE + h / 2 + 6; };

/** Plan a walkable route to an entity on the current map (interaction range, or inside its zone for triggers/exits). */
export function routeTo(s: Snap, id: string, kind: 'interact' | 'enter', engage = false): Pt[] {
  const m = MAPS[s.mapId]; const e = m.ents.find((x) => x.id === id); if (!e) throw new Error(`No ${id} on ${s.mapId}`);
  const st = asState(s);
  const solids = solidsFor(m, st);
  const accept = kind === 'enter' ? (p: Pt) => zoneInside(e, p) : engage ? (p: Pt) => Math.hypot(e.x * TILE - p.x, (e.y * TILE - p.y) * 1.4) < 26 : (p: Pt) => Math.hypot(e.x * TILE - p.x, (e.y * TILE - p.y) * 1.3) < 50;
  const avoid = (p: Pt) => m.ents.some((o) => (o.kind === 'trigger' || o.kind === 'exit') && o.id !== id && condMet(st, o.when) && zoneInside(o, p));
  const from = { x: s.x * TILE, y: s.y * TILE }; const goal = { x: e.x * TILE, y: e.y * TILE };
  // walk a little way INTO a zone (8px margin) so real key presses reliably cross its edge
  const deep = (p: Pt) => zoneInside({ x: e.x, y: e.y, w: Math.max(0.2, (e.w ?? 1) - 0.5), h: Math.max(0.2, (e.h ?? 1) - 0.5) }, p);
  const tries: ((p: Pt) => boolean)[] = kind === 'enter' ? [deep, accept] : [accept];
  let p: Pt[] | null = null;
  // real key presses wander a few pixels off the planned line: prefer routes with clearance, then fall back to tighter ones
  for (const a of tries) { for (const margin of [8, 4, 0]) { p = findPath(m, solids, from, goal, 20, a, avoid, margin) ?? findPath(m, solids, from, goal, 20, a, undefined, margin); if (p) break; } if (p) break; }
  if (!p) throw new Error(`no path to ${id}`);
  return p;
}

/** Real arrow-key walking along a path. Returns 'arrived' or 'interrupted' (a scene/overlay took over: dialogue, battle, map change). */
export async function walkPath(page: Page, path: Pt[]): Promise<'arrived' | 'interrupted'> {
  const held = new Set<string>();
  const hold = async (want: string[]) => { for (const k of [...held]) if (!want.includes(k)) { await page.keyboard.up(k); held.delete(k); } for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); } };
  const startMap = (await snap(page)).mapId;
  try {
    for (let i = 1; i < path.length; i++) {
      let stuck = 0, last = Infinity; const t0 = Date.now();
      for (;;) {
        const s = await snap(page);
        if (s.mode !== 'world' || s.overlay || s.mapId !== startMap) return 'interrupted';
        const dx = path[i].x - s.x * TILE, dy = path[i].y - s.y * TILE; const d = Math.hypot(dx, dy);
        if (d < (i === path.length - 1 ? 5 : 8)) break;
        const keys: string[] = []; if (dx > 2.5) keys.push('ArrowRight'); else if (dx < -2.5) keys.push('ArrowLeft'); if (dy > 2.5) keys.push('ArrowDown'); else if (dy < -2.5) keys.push('ArrowUp');
        await hold(keys);
        if (d > last - 0.5) { if (++stuck > 40) return 'interrupted'; } else stuck = 0;
        last = d;
        if (Date.now() - t0 > 40000) throw new Error('walking timed out');
        await page.waitForTimeout(35);
      }
    }
    return 'arrived';
  } finally { await hold([]); }
}

/** Dialogue / prompt / cutscene / results handling with real keys until the player is back in free exploration (or `until` holds). */
export async function drive(page: Page, o: { onAltar?: (p: Page) => Promise<void>; lines?: string[]; onDefeat?: (p: Page) => Promise<void>; choose?: (text: string) => 'yes' | 'no'; maxMs?: number; until?: (s: Snap) => boolean; battle?: (p: Page) => Promise<string>; onBattle?: () => void } = {}) {
  const t0 = Date.now(); let quiet = 0;
  while (Date.now() - t0 < (o.maxMs ?? 900000)) {
    const s = await snap(page);
    if (o.until?.(s)) return s;
    if (s.mode === 'world' && !s.overlay && !s.busy) { if (++quiet >= 4) return s; await page.waitForTimeout(120); continue; }
    quiet = 0;
    if (s.overlay === 'dialogue') {
      if (o.lines) { const t = await page.evaluate(() => { const ov = (window as W).__session.overlay; return ov?.kind === 'dialogue' ? `${ov.lines[ov.idx][0]}: ${ov.lines[ov.idx][1]}` : ''; }); if (t && o.lines[o.lines.length - 1] !== t) o.lines.push(t); }
      await page.keyboard.press('Enter'); await page.waitForTimeout(70);
    }
    else if (s.overlay === 'confirm') {
      const text = await page.evaluate(() => (window as W).__session.overlay.text as string);
      if (o.choose?.(text) === 'yes') await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(80); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
    }
    else if (s.overlay === 'altar') { await (o.onAltar ?? (async () => undefined))(page); await page.getByRole('button', { name: 'Close' }).click(); await page.waitForTimeout(300); }
    else if (s.overlay === 'shop') { await page.getByRole('button', { name: /Close|Leave|Done|Back/ }).first().click(); await page.waitForTimeout(300); }
    else if (s.overlay === 'cutscene') { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
    else if (s.overlay === 'results') { await page.keyboard.press('Enter'); await page.waitForTimeout(400); }
    else if (s.overlay === 'defeat') { if (!o.onDefeat) throw new Error('unexpected defeat'); await o.onDefeat(page); }
    else if (s.mode === 'battle') { o.onBattle?.(); const r = await (o.battle ?? playBattle)(page); if (r === 'timeout') throw new Error('battle timed out'); }
    else if (s.mode === 'credits' || s.overlay === 'credits') return s;
    else await page.waitForTimeout(120);
  }
  throw new Error('drive() timed out');
}

/** Walk to something and use it with real keys (E), then drive the resulting scene. */
export async function interact(page: Page, id: string, o: Parameters<typeof drive>[1] = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const s = await settleSnap(page);
    const r = await walkPath(page, routeTo(s, id, 'interact'));
    if (r === 'arrived') { await page.keyboard.press('e'); await page.waitForTimeout(250); return drive(page, o).then(async (x) => { await settle(page); return x; }); }
    await drive(page, o); await settle(page);
  }
  throw new Error('could not reach ' + id);
}
/** Walk into a trigger or exit zone and drive whatever starts. */
export async function enter(page: Page, id: string, o: Parameters<typeof drive>[1] = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const s = await settleSnap(page);
    const startMap = s.mapId;
    const r = await walkPath(page, routeTo(s, id, 'enter'));
    if (process.env.E2E_TRACE) { const q = await snap(page); console.log(`enter ${id}: walk=${r} at ${q.mapId} ${q.x.toFixed(1)},${q.y.toFixed(1)} mode=${q.mode} overlay=${q.overlay} busy=${q.busy}`); }
    // the zone starts its script on the next frame: wait for something to take over the screen
    const started = await page.waitForFunction((m) => { const q = (window as W).__session; return q.busy > 0 || !!q.overlay || q.mode !== 'world' || q.state.mapId !== m; }, startMap, { timeout: r === 'arrived' ? 4000 : 1500 }).then(() => true).catch(() => false);
    if (started) { const x = await drive(page, o); if (x.mode === 'world') await settle(page); return x; }
    if (r === 'arrived') throw new Error(`${id}: reached the zone but nothing started`);
  }
  throw new Error('could not enter ' + id);
}
/** Walk onto a patrol and fight it for real. */
export async function engage(page: Page, id: string, o: Parameters<typeof drive>[1] = {}) {
  const s = await settleSnap(page); const path = routeTo(s, id, 'interact', true);
  await walkPath(page, path);
  // the contact starts the fight on the next frame: wait for it to take over the screen (fails loudly if the patrol never engages)
  await page.waitForFunction(() => { const q = (window as W).__session; return q.busy > 0 || !!q.overlay || q.mode !== 'world'; }, null, { timeout: 8000 });
  const x = await drive(page, o); await settle(page); return x;
}
async function settleSnap(page: Page) { await settle(page); return snap(page); }

/**
 * Drive a real battle with real key presses. The decisions come from the same competent-player model the simulator uses
 * (`BattleController.debugSuggestCommand`: heals, items, Rage Arts, best skills, charge interrupts, combos); this function only turns
 * them into menu navigation with real keys, and presses Active Guard keys on cue.
 */
// Guard cues carry the defender's uid and the battle-clock time of impact: the key to press is that fighter's slot + 1.
export async function playBattle(page: Page, maxMs = 900000) {
  const t0 = Date.now();
  const view = () => page.evaluate(() => {
    const c = (window as W).__ctl ?? (window as W).__session?.battle; if (!c) return null;
    const m = c.menu;
    return { kind: m.kind as string, cursor: (m.cursor ?? 0) as number, index: (m.index ?? 0) as number, cands: (m.candidates ?? []) as string[], rows: (c.actor && m.kind !== 'target' && m.kind !== 'none' ? c.currentRows().map((x: { id: string; disabled?: string }) => ({ id: x.id, dis: !!x.disabled })) : []) as { id: string; dis: boolean }[], cmd: c.actor ? c.debugSuggestCommand() : null };
  });
  const goRow = async (id: string) => { for (let i = 0; i < 14; i++) { const v = await view(); if (!v) return; const want = v.rows.findIndex((r) => r.id === id); if (want < 0 || want === v.cursor) return; await page.keyboard.press(want > v.cursor ? 'ArrowDown' : 'ArrowUp'); await page.waitForTimeout(40); } };
  const goTarget = async (uid: string | undefined) => { for (let i = 0; i < 8; i++) { const v = await view(); if (!v || v.kind !== 'target') return; if (!uid || v.cands[v.index] === uid) return; await page.keyboard.press('ArrowRight'); await page.waitForTimeout(40); } };
  while (Date.now() - t0 < maxMs) {
    const st = await page.evaluate(() => {
      const s = (window as W).__session ?? { mode: 'battle', overlay: null, battle: (window as W).__ctl, battlePaused: false }; const c = s.battle;
      return { mode: s.mode, overlay: s.overlay?.kind ?? null, sp: !!s.battlePaused, actor: c?.actor?.uid ?? null, menu: c?.menu?.kind ?? null, cue: (c?.director?.activeCues ?? []).map((q: { uid: string; impactAt: number }) => ({ slot: c.engine.get(q.uid).slot as number, impactAt: q.impactAt, now: c.director.time as number })), out: (window as W).__session ? 'ongoing' : (c?.engine.outcome as string) };
    });
    if (st.sp) { await page.keyboard.press('p'); await page.waitForTimeout(200); continue; }
    if (st.out !== 'ongoing') return st.out;
    if (st.overlay === 'results') return 'results';
    if (st.overlay === 'defeat') return 'defeat';
    if (st.overlay === 'dialogue') { await page.keyboard.press('Enter'); await page.waitForTimeout(80); continue; }
    if (st.mode !== 'battle' && !st.overlay) return 'world';
    if (st.cue.length) { for (const c of st.cue) if (c.impactAt - c.now < 75 && c.impactAt - c.now > -50) await page.keyboard.press(String(c.slot + 1)); await page.waitForTimeout(10); continue; }
    if (!st.actor || st.menu === 'none') { await page.waitForTimeout(60); continue; }
    const v = await view(); if (!v) continue;
    const cmd = v.cmd as { kind: string; skill?: string; item?: string; combo?: string; target?: string } | null;
    if (v.kind === 'root') {
      let row = 'attack';
      if (cmd) { if (cmd.kind === 'skill') row = v.rows.some((r) => r.id === 'rage' && !r.dis) && cmd.skill && /rage|hidden|bigbang|discstorm|spiritbomb|demonwave|ssjfury|dendehope|nailstretch/.test(cmd.skill) ? 'rage' : 'skills'; else if (cmd.kind === 'item') row = 'items'; else if (cmd.kind === 'combo') row = 'combo'; else row = cmd.kind; }
      if (!v.rows.some((r) => r.id === row && !r.dis)) row = 'attack';
      await goRow(row); await page.keyboard.press('Enter'); await page.waitForTimeout(70); continue;
    }
    if (v.kind === 'skills' || v.kind === 'items' || v.kind === 'combos') {
      const id = cmd?.skill ?? cmd?.item ?? cmd?.combo;
      const target = v.rows.find((r) => r.id === id && !r.dis) ?? [...v.rows].reverse().find((r) => !r.dis);
      if (!target) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); continue; }
      await goRow(target.id); await page.keyboard.press('Enter'); await page.waitForTimeout(70); continue;
    }
    if (v.kind === 'target') { await goTarget(cmd?.target); await page.keyboard.press('Enter'); await page.waitForTimeout(70); continue; }
    await page.waitForTimeout(60);
  }
  return 'timeout';
}

/**
 * Mocked-gamepad support (no hardware). Install BEFORE the page loads. The bridge in App.tsx samples the pad every 16 ms and turns a press into a synthetic
 * (untrusted) key event; this counts those events so a test can wait for the press to be RECEIVED instead of guessing how long to hold the button.
 */
export async function installMockPad(page: Page) {
  await page.addInitScript(() => {
    const st = { buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [0, 0], connected: true };
    const w = window as unknown as { __pad: typeof st; __padKeys: string[] };
    w.__pad = st; w.__padKeys = [];
    navigator.getGamepads = () => [st as unknown as Gamepad, null, null, null];
    window.addEventListener('keydown', (e) => { if (!e.isTrusted) w.__padKeys.push(e.key); }, true);
  });
}
/**
 * Press and release a pad button. Waits until the bridge has really delivered the key (state-aware, fails with the pad's own diagnostics if it never does),
 * then releases and lets the page's own timer queue run twice so the bridge sees the release before the next press.
 * Returns the key the bridge produced.
 */
export async function padPress(page: Page, btn: number, timeoutMs = 5000): Promise<string> {
  const before = await page.evaluate((b) => { const w = window as unknown as { __pad: { buttons: { pressed: boolean }[] }; __padKeys: string[] }; const n = w.__padKeys.length; w.__pad.buttons[b].pressed = true; return n; }, btn);
  try { await page.waitForFunction((n) => (window as unknown as { __padKeys: string[] }).__padKeys.length > n, before, { timeout: timeoutMs, polling: 'raf' }); }
  catch (e) {
    const diag = await page.evaluate(() => { const w = window as unknown as { __padKeys: string[]; __session?: { mode: string; overlay?: { kind: string } | null } }; return JSON.stringify({ keysSoFar: w.__padKeys, mode: w.__session?.mode, overlay: w.__session?.overlay?.kind ?? null }); });
    throw new Error(`pad button ${btn} was held for ${timeoutMs} ms but the bridge delivered no key. ${diag}`, { cause: e });
  }
  const key = await page.evaluate((b) => { const w = window as unknown as { __pad: { buttons: { pressed: boolean }[] }; __padKeys: string[] }; w.__pad.buttons[b].pressed = false; return w.__padKeys[w.__padKeys.length - 1]; }, btn);
  await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 40), 40)));
  return key;
}
