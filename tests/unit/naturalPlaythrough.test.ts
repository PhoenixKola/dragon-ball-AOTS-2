import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { StoryDriver, StuckFight, type PlayStyle } from '../support/storyDriver';
import { playStory } from '../support/storyPlan';
import { rateFromState } from '../support/simBattle';
import { HEROES, ITEMS } from '../../src/data/heroes';
import { SCRIPTS } from '../../src/data/scripts';
import { newGameState } from '../../src/systems/gameState';
import { MAX_LEVEL } from '../../src/systems/party';

/**
 * NATURAL PROGRESSION: the whole story is walked on the real collision grid with the real trigger rules, and EVERY fight is played with the
 * real combat engine from the party's real state. Nothing is boosted: levels come only from XP (random encounters on the way, boss XP, quest XP),
 * training points are spent by the "player", capsules are the ones found or bought, the bag holds only what chests, quests, drops and the trader
 * gave, HP and Ki are carried from fight to fight, a defeat uses the game's Retry rule, and no menu is opened inside a boss's chain of forms.
 *
 * This is different from the chapter-flow browser tests (tests/e2e/story.spec.ts), which start from saves with RAISED levels to keep long
 * fights short. A pass here is a statement about the engine and the numbers, not about fun: the guard skill of a human is modelled, not measured.
 */
const STYLES: Record<string, PlayStyle> = {
  attentive: { name: 'attentive', perfect: 0.35, good: 0.35, maxRetries: 12 },   // guards well: perfect and good on a third of enemy chains each
  average: { name: 'average', perfect: 0.15, good: 0.3, maxRetries: 12 },       // guards sometimes
  casual: { name: 'casual', perfect: 0, good: 0, maxRetries: 12 },              // never lands an Active Guard (only items, skills, combos)
};
type Route = 'critical' | 'partial' | 'full';
const ROUTE_LABEL: Record<Route, string> = { critical: 'critical path (no side quests, only the story Dragon Balls)', partial: 'partial (no side quests, Dragon Balls 3 and 5 only)', full: 'everything (7 side quests, all Dragon Balls)' };
interface Cell { route: Route; difficulty: 'normal' | 'easy'; style: string; seeds: number[] }
const MATRIX: Cell[] = [
  { route: 'critical', difficulty: 'normal', style: 'attentive', seeds: [1, 2, 3, 4] }, { route: 'critical', difficulty: 'normal', style: 'average', seeds: [1, 2, 3, 4] }, { route: 'critical', difficulty: 'normal', style: 'casual', seeds: [1, 2, 3, 4, 5, 6, 7, 8] },
  { route: 'critical', difficulty: 'easy', style: 'attentive', seeds: [1, 2, 3, 4] }, { route: 'critical', difficulty: 'easy', style: 'average', seeds: [1, 2, 3, 4] }, { route: 'critical', difficulty: 'easy', style: 'casual', seeds: [1, 2, 3, 4, 5, 6, 7, 8] },
  { route: 'partial', difficulty: 'normal', style: 'average', seeds: [1, 2] },
  { route: 'full', difficulty: 'normal', style: 'attentive', seeds: [1, 2] }, { route: 'full', difficulty: 'normal', style: 'average', seeds: [1, 2] }, { route: 'full', difficulty: 'normal', style: 'casual', seeds: [1, 2] },
  { route: 'full', difficulty: 'easy', style: 'casual', seeds: [1, 2] },
];

interface Run { cell: Cell; seed: number; d: StoryDriver; ok: boolean; error?: string }
function play(cell: Cell, seed: number): Run {
  const d = new StoryDriver({ seed, difficulty: cell.difficulty, fights: 'play', style: STYLES[cell.style] });
  try {
    if (cell.route === 'full') playStory(d, { sideQuests: true });
    else playStory(d, { sideQuests: false, balls: cell.route === 'partial' ? [3, 5] : [] });
    return { cell, seed, d, ok: d.ended };
  } catch (e) { return { cell, seed, d, ok: false, error: e instanceof StuckFight ? e.message : (e as Error).message }; }
}

let runs: Run[] = [];
const runsOf = (route: Route, difficulty: 'normal' | 'easy', style?: string) => runs.filter((r) => r.cell.route === route && r.cell.difficulty === difficulty && (!style || r.cell.style === style));
// Yield to the event loop between playthroughs: about a minute of unbroken synchronous work would stop the vitest worker from reporting progress (it then fails the run with "Timeout calling onTaskUpdate").
beforeAll(async () => {
  for (const cell of MATRIX) for (const seed of cell.seeds) { runs.push(play(cell, seed)); await new Promise<void>((r) => setTimeout(r, 0)); }
}, 900000);

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const finalLevels = (r: Run) => r.d.s.roster.map((m) => m.level);
const scripted = (r: Run) => r.d.battles.filter((b) => b.source === 'script');

describe('natural progression: the story is finishable at the levels the route itself gives (no boosts)', () => {
  const neverGuardsOnNormal = (r: Run) => r.cell.difficulty === 'normal' && r.cell.style === 'casual';
  it('every playthrough by a player who guards, and every Easy playthrough, reaches the ending (no softlock, nobody stuck after 12 defeats)', () => {
    for (const r of runs.filter((x) => !neverGuardsOnNormal(x))) expect(r.ok, `${r.cell.route} ${r.cell.difficulty} ${r.cell.style} seed ${r.seed}: ${r.error ?? 'did not reach the ending'}`).toBe(true);
  });
  it('Normal is not built for a player who never lands an Active Guard, but almost all of them still finish; the few who stall do so on a named boss, never on a bug', () => {
    const rs = runs.filter(neverGuardsOnNormal); const stuck = rs.filter((r) => !r.ok);
    expect(rs.length - stuck.length, `${stuck.map((r) => `seed ${r.seed}: ${r.error}`).join('; ')}`).toBeGreaterThanOrEqual(Math.ceil(rs.length * 0.85));
    for (const r of stuck) expect(r.error, 'stuck on a fight, not a crash or an unreachable place').toMatch(/^stuck on "(Captain Ginyu|Dodoria|Burter & Jeice|Frieza · [A-Za-z0-9% ]+)" after 13 defeats$/);
  });
  it('defeats stay reasonable on the bare critical path, per play style', () => {
    const total = (route: Route, diff: 'normal' | 'easy', style: string) => runsOf(route, diff, style).map((r) => r.d.defeats);
    expect(Math.max(...total('critical', 'normal', 'attentive')), 'normal, attentive').toBeLessThanOrEqual(3);
    expect(Math.max(...total('critical', 'normal', 'average')), 'normal, average guarder').toBeLessThanOrEqual(8);
    expect(avg(runsOf('critical', 'normal', 'casual').filter((x) => x.ok).map((r) => r.d.defeats)), 'normal, never guards (finished runs)').toBeLessThanOrEqual(12);
    expect(Math.max(...total('critical', 'easy', 'attentive')), 'easy, attentive').toBeLessThanOrEqual(3);
    expect(Math.max(...total('critical', 'easy', 'average')), 'easy, average').toBeLessThanOrEqual(4);
    expect(Math.max(...total('critical', 'easy', 'casual')), 'easy, never guards').toBeLessThanOrEqual(12);
    for (const r of runsOf('critical', 'normal').filter((x) => x.ok)) for (const b of r.d.battles) expect(b.defeats ?? 0, `${b.title} (${r.cell.style} seed ${r.seed}) never needs a grind`).toBeLessThanOrEqual(10);
  });
  it('completionists and partial explorers are not punished: few defeats and no compulsory grinding', () => {
    for (const r of [...runsOf('full', 'normal'), ...runsOf('full', 'easy'), ...runsOf('partial', 'normal')]) expect(r.d.defeats, `${r.cell.route} ${r.cell.difficulty} ${r.cell.style} seed ${r.seed}`).toBeLessThanOrEqual(8);
    for (const r of runs) expect(r.d.randomFights, 'random fights happen only on the walked route').toBeLessThanOrEqual(30);
  });
  it('levels come from the route only: the critical path finishes around level 20-24, the full route is higher but under the cap', () => {
    for (const r of runsOf('critical', 'normal').filter((x) => x.ok)) { const lv = finalLevels(r); expect(Math.min(...lv), `${r.cell.style} seed ${r.seed}`).toBeGreaterThanOrEqual(19); expect(Math.max(...lv)).toBeLessThanOrEqual(25); }
    const crit = avg(runsOf('critical', 'normal').flatMap(finalLevels)), full = avg(runsOf('full', 'normal').flatMap(finalLevels));
    expect(full - crit, 'side quests + exploration are worth several levels').toBeGreaterThanOrEqual(2);
    for (const r of runs) for (const l of finalLevels(r)) expect(l).toBeLessThanOrEqual(MAX_LEVEL - 2);
    for (const r of runs.filter((x) => x.ok)) { const first = scripted(r)[0]; for (const l of Object.values(first.levels) as number[]) { expect(l, 'a new game starts at level 5; a few beach fights before First Contact may add a level or two').toBeGreaterThanOrEqual(5); expect(l).toBeLessThanOrEqual(8); } }
  });
  it('the party at each boss is the party the story gives, and it is not under-levelled compared with the route average', () => {
    for (const r of runsOf('critical', 'normal', 'average')) for (const b of scripted(r)) { const lv = Object.values(b.levels) as number[]; expect(Math.max(...lv) - Math.min(...lv), `${b.title}: late joiners are close to the party average`).toBeLessThanOrEqual(3); }
  });
});

describe('natural progression: every item and Zeni can be traced to a game source', () => {
  const GAINS = (src: string) => src === 'chest' || src === 'battle-drops' || src === 'shop' || src.startsWith('script:') || src === 'retry-restore';
  it('the bag at the end equals the starting bag plus what the ledger recorded (nothing appeared or vanished unexplained)', () => {
    const start = newGameState();
    for (const r of runs) {
      const sum: Record<string, number> = { ...start.inventory }; let zeni = start.zeni;
      for (const per of Object.values(r.d.ledger)) for (const [k, n] of Object.entries(per)) { if (k === 'zeni') zeni += n; else sum[k] = (sum[k] ?? 0) + n; }
      for (const k of new Set([...Object.keys(sum), ...Object.keys(r.d.s.inventory)])) expect(r.d.s.inventory[k] ?? 0, `${k} in ${r.cell.route}/${r.cell.style}/seed${r.seed}`).toBe(Math.min(99, sum[k] ?? 0));
      expect(r.d.s.zeni, 'Zeni').toBe(Math.min(999999, zeni));
    }
  });
  it('items only ever enter the bag through chests, quest scripts, battle drops, the trader (paid in Zeni) or a retry that returns consumed items', () => {
    for (const r of runs) for (const [src, per] of Object.entries(r.d.ledger)) {
      for (const [k, n] of Object.entries(per)) {
        if (k === 'zeni') continue;
        expect(ITEMS[k], `known item ${k}`).toBeDefined();
        if (n > 0) expect(GAINS(src), `${k} x${n} gained from "${src}"`).toBe(true);
        if (src.startsWith('script:')) expect(SCRIPTS[src.slice(7)], `${src} is a real script`).toBeDefined();
        if (src === 'battle-used' || src === 'upkeep') expect(n, `${src} only consumes (${k})`).toBeLessThanOrEqual(0);
      }
    }
  });
  it('the trader sells only for Zeni the party earned: no run ever spends more than it received', () => {
    for (const r of runs) { const shop = r.d.ledger.shop ?? {}; expect(shop.zeni ?? 0, 'shopping costs Zeni').toBeLessThanOrEqual(0); expect(r.d.s.zeni).toBeGreaterThanOrEqual(0); }
  });
  it('on the critical path the player uses real resources: Med Kits are consumed, capsules are worn, training points are spent', () => {
    for (const r of runsOf('critical', 'normal', 'average')) {
      expect(r.d.policy.spent, 'training points spent').toBeGreaterThan(30);
      expect(r.d.shopVisits, 'the trader was visited').toBeGreaterThan(0);
      const last = scripted(r)[scripted(r).length - 1].before!;
      expect(last.roster.reduce((a, m) => a + m.unspent, 0), 'every training point is spent before the final fight').toBe(0);
    }
  });
});

describe('natural fight odds (re-simulated from the exact state the player had when each scripted fight began)', () => {
  type Row = { title: string; levels: string; att: number; avg: number; cas: number; naive: number; defeats: number };
  const tables = new Map<string, Row[]>();
  function table(route: Route, diff: 'normal' | 'easy'): Row[] {
    const key = `${route}/${diff}`; if (tables.has(key)) return tables.get(key)!;
    const src = runsOf(route, diff, 'average'); const byTitle = new Map<string, { b: ReturnType<typeof scripted>[number]; r: Run }[]>();
    for (const r of src) for (const b of scripted(r)) { const l = byTitle.get(b.title) ?? []; l.push({ b, r }); byTitle.set(b.title, l); }
    const rows: Row[] = [];
    for (const [title, list] of byTitle) {
      const easy = diff === 'easy'; const rate = (perfect: number, good: number, naive = false) => avg(list.map(({ b }) => rateFromState(b, { perfect, good, naive, n: 20, easy }).win));
      rows.push({ title, levels: Object.values(list[0].b.levels).join('/'), att: rate(0.35, 0.35), avg: rate(0.15, 0.3), cas: rate(0, 0), naive: rate(0, 0, true), defeats: avg(list.map(({ b }) => b.defeats ?? 0)) });
    }
    tables.set(key, rows); return rows;
  }
  it('Normal, bare critical path: every scripted fight is a fair fight for a player who guards, and retries work for one who does not', () => {
    for (const row of table('critical', 'normal')) {
      expect(row.att, `${row.title} attentive`).toBeGreaterThanOrEqual(0.7);
      expect(row.avg, `${row.title} average guarder`).toBeGreaterThanOrEqual(0.55);
      expect(row.cas, `${row.title} never guards`).toBeGreaterThanOrEqual(0.15);
    }
  });
  it('Easy, bare critical path: even a player who never guards wins every scripted fight in a few tries', () => {
    for (const row of table('critical', 'easy')) {
      expect(row.att, `${row.title} attentive`).toBeGreaterThanOrEqual(0.75);
      expect(row.avg, `${row.title} average guarder`).toBeGreaterThanOrEqual(0.6);
      expect(row.cas, `${row.title} never guards`).toBeGreaterThanOrEqual(0.1);
    }
  });
  it('the difficulties are ordered: Easy is easier than Normal, and guarding helps', () => {
    const n = table('critical', 'normal'), e = table('critical', 'easy');
    expect(avg(e.map((x) => x.cas))).toBeGreaterThan(avg(n.map((x) => x.cas)));
    expect(avg(n.map((x) => x.att))).toBeGreaterThan(avg(n.map((x) => x.cas)));
    expect(avg(n.map((x) => x.att))).toBeGreaterThanOrEqual(avg(n.map((x) => x.avg)));
  });
  it('bosses keep their identity: the hardest scripted fights on Normal are still not a pushover for an attentive player', () => {
    const rows = table('critical', 'normal').filter((x) => !/First Contact|Defend Dende|Nail vs/.test(x.title));
    expect(Math.min(...rows.map((x) => x.att)), 'at least one boss still costs an attentive player a defeat now and then').toBeLessThanOrEqual(0.92);   // 0.90 before the v5 Rage rework: Rage now fills faster, which makes attentive play slightly stronger; the intent (some boss still costs a defeat now and then) is unchanged
  });

  it('writes docs/NATURAL_PLAYTHROUGH.md from the real numbers', () => {
    const pct = (x: number) => (x * 100).toFixed(0);
    const L: string[] = ['# Natural-progression playthroughs (generated by tests/unit/naturalPlaythrough.test.ts)', '',
      'Every row below is a **simulation**: the story is walked on the real collision grid with the real trigger rules, and every fight is played with the real combat engine from the party\'s real state. **Nothing is boosted**: levels come only from XP; training points are spent by the simulated player; capsules are the ones found or bought; the bag holds only what chests, quests, drops and the trader gave; HP/Ki are carried between fights; a defeat uses the game\'s Retry rule (bag restored, at least 60% HP/Ki); no menu is opened inside a boss\'s chain of forms; before a boss trigger the player rests at the map\'s altar if there is one, otherwise drinks kits.', '',
      'This is **not** a human playthrough and says nothing about fun. The three play styles model only Active Guard skill: *attentive* = perfect and good guards on 35% of enemy chains each, *average* = 15% perfect / 30% good, *casual* = never lands a guard (still uses skills, combos, items). A real person may be better or worse. The shop visit on entering Aojan Village is modelled (no extra walking).', '',
      '## Intended difficulty', '',
      '- **Normal** is tuned for players who land some Active Guards: an average guarder wins every scripted fight at ≥ 55% per attempt and a good one at ≥ 70%. A player who NEVER guards usually still finishes (every scripted fight is ≥ 15% per attempt on average), but an under-levelled one can stall on the hardest bosses (Captain Ginyu is the known case) and should switch to Easy or level up a little: that is the intended price of Normal, not a bug.',
      '- **Easy** (enemy damage -30%, +25% XP, fewer random fights) is meant to be finishable without guarding (≥ 10% per attempt on every fight, usually far more).',
      '- The bare critical path is the hardest route; side quests and exploration add roughly three levels.', '',
      '## Completion by route, difficulty and play style', '',
      '| Route | Difficulty | Style | Runs | Reached ending | Defeats (avg / max) | Random fights | Final levels (avg) | Modelled minutes |', '|---|---|---|---|---|---|---|---|---|'];
    for (const cell of MATRIX) {
      const rs = runs.filter((r) => r.cell === cell);
      L.push(`| ${ROUTE_LABEL[cell.route]} | ${cell.difficulty} | ${cell.style} | ${rs.length} | ${rs.filter((r) => r.ok).length}/${rs.length} | ${avg(rs.map((r) => r.d.defeats)).toFixed(1)} / ${Math.max(...rs.map((r) => r.d.defeats))} | ${avg(rs.map((r) => r.d.randomFights)).toFixed(0)} | ${avg(rs.flatMap(finalLevels)).toFixed(1)} | ${avg(rs.map((r) => r.d.estimateMinutes())).toFixed(0)} |`);
    }
    for (const [route, diff] of [['critical', 'normal'], ['critical', 'easy'], ['full', 'normal']] as [Route, 'normal' | 'easy'][]) {
      const rows = table(route, diff); if (!rows.length) continue;
      L.push('', `## Scripted fights, ${ROUTE_LABEL[route]}, ${diff}`, '', `Win % per attempt from the state at the start of the fight (mean of ${runsOf(route, diff, 'average').length} routes played by the average guarder, 20 simulations each). Defeats = mean defeats the average guarder suffered on that fight in the route runs.`, '',
        '| Fight | Levels | Attentive % | Average % | Never guards % | Attack-only % | Defeats (avg style) |', '|---|---|---|---|---|---|---|');
      for (const x of rows) L.push(`| ${x.title} | ${x.levels} | ${pct(x.att)} | ${pct(x.avg)} | ${pct(x.cas)} | ${pct(x.naive)} | ${x.defeats.toFixed(2)} |`);
    }
    const ledgerRows = (rs: Run[]) => {
      const tot: Record<string, Record<string, number>> = {};
      for (const r of rs) for (const [src, per] of Object.entries(r.d.ledger)) { const bucket = src.startsWith('script:') ? 'quest/story scripts' : src; for (const [k, n] of Object.entries(per)) { (tot[bucket] ??= {})[k] = ((tot[bucket] ??= {})[k] ?? 0) + n / rs.length; } }
      return Object.entries(tot).map(([src, per]) => `| ${src} | ${Object.entries(per).filter(([, n]) => Math.abs(n) >= 0.05).map(([k, n]) => `${k === 'zeni' ? 'Zeni' : ITEMS[k]?.name ?? k} ${n > 0 ? '+' : ''}${n.toFixed(1)}`).join(', ')} |`);
    };
    L.push('', '## Where items and Zeni come from (mean per playthrough, normal, average guarder)', '');
    for (const route of ['critical', 'full'] as Route[]) {
      const rs = runsOf(route, 'normal', 'average'); if (!rs.length) continue;
      L.push(`### ${ROUTE_LABEL[route]}`, '', '| Source | Net change |', '|---|---|', ...ledgerRows(rs), '', `Training points spent: ${avg(rs.map((r) => r.d.policy.spent)).toFixed(0)} · capsules worn: ${avg(rs.map((r) => r.d.policy.equipped.length)).toFixed(1)} · trader visits: ${avg(rs.map((r) => r.d.shopVisits)).toFixed(1)} · Med Kits used between fights: ${avg(rs.map((r) => r.d.policy.usedKits)).toFixed(1)} · altar rests before bosses: ${avg(rs.map((r) => r.d.altarRests)).toFixed(1)}`, '');
    }
    L.push('## Final levels', '', ...(['critical', 'full'] as Route[]).map((route) => { const rs = runsOf(route, 'normal', 'average'); return rs.length ? `- ${ROUTE_LABEL[route]}: ${rs[0].d.s.roster.map((m) => `${HEROES[m.id].name} ${m.level}`).join(', ')} (seed ${rs[0].seed})` : ''; }), '');
    mkdirSync('docs', { recursive: true }); writeFileSync('docs/NATURAL_PLAYTHROUGH.md', L.join('\n'));
    expect(L.length).toBeGreaterThan(40);
  });
});
