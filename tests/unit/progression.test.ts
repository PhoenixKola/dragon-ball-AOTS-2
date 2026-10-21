import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { StoryDriver, type BattleRecord } from '../support/storyDriver';
import { playStory, type PlanOptions } from '../support/storyPlan';
import { rateFromState, type Rate } from '../support/simBattle';
import { HEROES } from '../../src/data/heroes';
import { SKILLS } from '../../src/data/skills';
import { grantXp, newMember, skillsOf, learnedSkillsOf, upcomingSkills, MAX_LEVEL } from '../../src/systems/party';
import type { HeroId } from '../../src/types';

/**
 * Progression and balance measured on what a player really has: levels come from the walked story route (random encounters,
 * quest XP, boss XP), and every scripted fight is then simulated with the real combat engine at those levels.
 * Skilled = perfect/good Active Guards on 35% of chains each; casual = never guards; both use items sensibly.
 */
interface RouteRun { name: string; difficulty: 'normal' | 'easy'; opts: PlanOptions; d: StoryDriver; fights: BattleRecord[] }
const ROUTES: { name: string; difficulty: 'normal' | 'easy'; opts: PlanOptions }[] = [
  { name: 'critical path, normal', difficulty: 'normal', opts: { sideQuests: false, balls: [] } },
  { name: 'critical path, easy', difficulty: 'easy', opts: { sideQuests: false, balls: [] } },
  { name: 'everything, normal', difficulty: 'normal', opts: { sideQuests: true } },
];
const ROUTE_PLAYER = { name: 'average', perfect: 0.15, good: 0.3, maxRetries: 60 };
const runs: RouteRun[] = ROUTES.map((r) => { const d = new StoryDriver({ seed: 2, difficulty: r.difficulty, fights: 'play', style: ROUTE_PLAYER }); playStory(d, r.opts); return { ...r, d, fights: d.battles.filter((b) => b.source === 'script') }; });
const rows: string[] = [];
const table = new Map<string, { b: BattleRecord; skilled: Rate; casual: Rate; under: Rate; over: Rate }[]>();
function measure(run: RouteRun) {
  if (table.has(run.name)) return table.get(run.name)!;
  const easy = run.difficulty === 'easy';
  const out = run.fights.map((b) => ({ b, skilled: rateFromState(b, { perfect: 0.35, good: 0.35, n: 30, easy }), casual: rateFromState(b, { perfect: 0, good: 0, n: 30, easy }), under: rateFromState(b, { perfect: 0.35, good: 0.35, n: 30, lvDelta: -3, easy }), over: rateFromState(b, { perfect: 0.35, good: 0.35, n: 30, lvDelta: 3, easy }) }));
  table.set(run.name, out);
  for (const m of out) rows.push(`| ${run.name} | ${m.b.title} | ${Object.values(m.b.levels).join('/')} | ${(m.skilled.win * 100).toFixed(0)} | ${(m.casual.win * 100).toFixed(0)} | ${(m.under.win * 100).toFixed(0)} | ${(m.over.win * 100).toFixed(0)} | ${m.skilled.rounds.toFixed(1)} | ${(m.skilled.hp * 100).toFixed(0)} |`);
  return out;
}

describe('levels a real player has at each story fight', () => {
  it('the critical path levels up steadily and never falls absurdly behind or ahead of the enemy curve', () => {
    const lv = runs[0].fights.map((b) => Object.values(b.levels).reduce((a, v) => a + (v ?? 0), 0) / b.party.length);
    for (let i = 1; i < lv.length; i++) expect(lv[i], `fight ${i} (${runs[0].fights[i].title}) is not lower than the previous one by much`).toBeGreaterThanOrEqual(lv[i - 1] - 1.5);
    expect(lv[0]).toBe(5); expect(lv[lv.length - 1]).toBeGreaterThanOrEqual(17); expect(lv[lv.length - 1]).toBeLessThanOrEqual(MAX_LEVEL);
  });
  it('side quests and exploration are rewarded: the full route is several levels ahead, but not runaway', () => {
    const last = (r: RouteRun) => { const b = r.fights[r.fights.length - 1]; return Object.values(b.levels).reduce((a, v) => a + (v ?? 0), 0) / b.party.length; };
    expect(last(runs[2]) - last(runs[0])).toBeGreaterThanOrEqual(2); expect(last(runs[2]) - last(runs[0])).toBeLessThanOrEqual(8); expect(last(runs[2])).toBeLessThan(28);
  });
  it('easy mode has fewer random fights, so it levels slower on the critical path (compensated by weaker enemies)', () => {
    expect(runs[1].d.randomFights).toBeLessThan(runs[0].d.randomFights);
  });
});

describe('story fights at the levels the route produces (real combat engine, 30 seeds per cell)', () => {
  it('critical path (no side quests), normal: every fight is winnable by a skilled player, and costs resources', () => {
    for (const m of measure(runs[0])) {
      expect(m.skilled.win, `${m.b.title} skilled`).toBeGreaterThanOrEqual(0.6);
      if (!m.b.spec.surviveRounds) expect(m.skilled.rounds, `${m.b.title} is not a one-round pushover`).toBeGreaterThanOrEqual(3);
      expect(m.skilled.rounds, `${m.b.title} does not drag`).toBeLessThan(15);
      expect(m.skilled.hp, `${m.b.title} should cost HP`).toBeLessThan(0.95);
    }
  });
  it('the full route is comfortable for a skilled player and clearly easier than the bare critical path', () => {
    const crit = measure(runs[0]), full = measure(runs[2]);
    for (const m of full) expect(m.skilled.win, `${m.b.title} skilled`).toBeGreaterThanOrEqual(0.8);
    const avg = (t: typeof crit) => t.reduce((a, m) => a + m.skilled.win, 0) / t.length;
    expect(avg(full)).toBeGreaterThanOrEqual(avg(crit));
  });
  it('easy mode critical path: every fight is comfortably winnable', () => {
    for (const m of measure(runs[1])) expect(m.skilled.win, `${m.b.title} skilled (easy)`).toBeGreaterThanOrEqual(0.75);
  });
  it('guarding and levels matter: casual (no guard) is never better than skilled, and levels move the odds the right way', () => {
    for (const run of runs) for (const m of measure(run)) {
      expect(m.casual.win, `${run.name} ${m.b.title}: guarding must not hurt`).toBeLessThanOrEqual(m.skilled.win + 0.1);
      expect(m.under.win, `${run.name} ${m.b.title}: 3 levels under is not easier`).toBeLessThanOrEqual(m.skilled.win + 0.15);
      expect(m.over.win, `${run.name} ${m.b.title}: 3 levels over is not harder`).toBeGreaterThanOrEqual(m.skilled.win - 0.15);
    }
  });
  it('opening fights are forgiving even without guarding; late bosses reward guarding', () => {
    const crit = measure(runs[0]);
    for (const m of crit.slice(0, 3)) expect(m.casual.win, `${m.b.title} casual`).toBeGreaterThanOrEqual(0.85);
    const lateGap = crit.slice(-6).reduce((a, m) => a + (m.skilled.win - m.casual.win), 0) / 6;
    expect(lateGap, 'perfect guarding matters in the Frieza fights').toBeGreaterThan(0.15);
  });
  it('writes docs/PROGRESSION_AUDIT.md from the real numbers', () => {
    for (const run of runs) measure(run);
    mkdirSync('docs', { recursive: true });
    const text = ['# Progression audit (generated by tests/unit/progression.test.ts)', '',
      'Levels come from the walked story route (`tests/support/storyPlan.ts`): random encounters on the real encounter tables and rates, boss XP, quest XP. The route is played for real with an average guarder (15% perfect / 30% good Active Guards) who spends training points, wears capsules, shops and rests before bosses; each scripted fight is then re-simulated 30 times with the real combat engine from the exact state (levels, training points, capsules, bag, HP/Ki) the player had when it began. "Skilled" = perfect and good Active Guards on 35% of chains each, "casual" = never guards; both use items. "-3 / +3" shift every hero by 3 levels. Bots are not humans: use the table to compare fights, not as a promise of difficulty.', '',
      '| Route | Fight | Levels | Skilled win % | Casual win % | -3 lv win % | +3 lv win % | Rounds | HP left % |', '|---|---|---|---|---|---|---|---|---|', ...rows, '',
      ...runs.map((r) => `- **${r.name}**: ${r.d.randomFights} random fights on the way, ${r.d.battles.length} fights total, estimated ${r.d.estimateMinutes().toFixed(0)} min (a model of walking, dialogue and fights), final levels ${r.d.s.roster.map((m) => `${HEROES[m.id].name} ${m.level}`).join(', ')}.`), ''].join('\n');
    writeFileSync('docs/PROGRESSION_AUDIT.md', text);
    expect(rows.length).toBeGreaterThan(30);
  });
});

describe('skills are reachable and arrive during the story', () => {
  const heroSkills = (id: HeroId) => HEROES[id].skills.map((s) => SKILLS[s]);
  it('every story skill unlocks at a level a story player reaches; only the explicitly postgame skills wait until after the credits (and every main hero has one)', () => {
    const finalLevel = Math.min(...runs[0].d.s.roster.map((m) => m.level));   // lowest final level on the bare critical path
    for (const id of ['gohan', 'krillin', 'vegeta', 'goku', 'piccolo'] as HeroId[]) { for (const sk of heroSkills(id).filter((x) => !x.postgame)) expect(sk.unlockLevel, `${id} ${sk.id}`).toBeLessThanOrEqual(finalLevel); expect(heroSkills(id).some((x) => x.postgame && x.unlockLevel <= 30), `${id} has postgame training skills`).toBe(true); }
  });
  it('the final squad knows every skill at the final battle on the critical path', () => {
    const final = runs[0].d.s;
    for (const m of final.roster) {
      const known = learnedSkillsOf(m);
      for (const sk of HEROES[m.id].skills.filter((x) => !SKILLS[x].postgame)) { if (m.ssj && (sk === 'kamehameha' || sk === 'kaiokenassault')) continue; expect(known, `${m.id} should know ${sk}`).toContain(sk); }   // Super Saiyan Goku swaps Kamehameha and Kaioken Assault for their SSJ versions and keeps Kaioken
      if (m.ssj) expect(skillsOf(m)).toEqual(expect.arrayContaining(['ssjkame', 'ssjassault']));
    }
  });
  it('skills are spread over the journey instead of all being available at the start', () => {
    const levels = (['gohan', 'krillin', 'vegeta', 'goku', 'piccolo'] as HeroId[]).flatMap((id) => heroSkills(id).map((s) => s.unlockLevel));
    expect(new Set(levels).size).toBeGreaterThanOrEqual(6); expect(Math.max(...levels)).toBeGreaterThanOrEqual(17); expect(levels.filter((l) => l > 1).length).toBeGreaterThanOrEqual(6);
  });
  it('a new skill is announced on level-up and shows up in the menus (skillsOf / upcomingSkills)', () => {
    const m = newMember('gohan', 7); expect(skillsOf(m)).not.toContain('dragonkick'); expect(upcomingSkills(m)[0].id).toBe('dragonkick');
    const need = (m.level + 1) * 0; void need;
    const lu = grantXp(m, 100000);
    expect(lu).not.toBeNull(); expect(lu!.newSkills).toContain('dragonkick'); expect(skillsOf(m)).toContain('dragonkick');
    expect(upcomingSkills(m)).toHaveLength(0);
  });
  it('Kaioken is available to Goku before Super Saiyan and survives the transformation; SSJ replaces the base specials', () => {
    const g = newMember('goku', 18);
    expect(skillsOf(g)).toContain('kaioken'); expect(skillsOf(g)).not.toContain('ssjkame');
    g.ssj = true;
    expect(skillsOf(g)).toEqual(expect.arrayContaining(['ssjkame', 'ssjassault', 'kaioken'])); expect(skillsOf(g)).not.toContain('kamehameha');
  });
  it('the party seat is never wasted: Goku and Piccolo join with a level close to the party average', () => {
    const d = runs[0].d; const rec = d.battles.find((b) => b.title === 'Goku vs Recoome')!;
    const lv = Object.values(rec.levels) as number[]; expect(Math.max(...lv) - Math.min(...lv)).toBeLessThanOrEqual(2);
  });
});
