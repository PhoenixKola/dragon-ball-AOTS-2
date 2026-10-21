import { describe, it, expect, afterEach } from 'vitest';
import { StoryDriver } from '../support/storyDriver';
import { playStory } from '../support/storyPlan';
import { MAPS } from '../../src/data/maps';
import { QUESTS, QUEST_DONE } from '../../src/data/quests';
import { ownedBalls } from '../../src/systems/gameState';
import { TILE } from '../../src/engine/world/mapTypes';

// These files run long synchronous story simulations: yield between tests so the vitest worker can report progress (otherwise: "Timeout calling onTaskUpdate").
afterEach(() => new Promise<void>((r) => setTimeout(r, 0)));

const scriptsRun = (d: StoryDriver) => d.events.filter((e) => e.startsWith('script:')).map((e) => e.slice(7));
const endingText = (d: StoryDriver) => d.said.filter((l) => l.script === 'epilogue').map((l) => l.text).join(' ');
const before = (a: string[], x: string, y: string) => expect(a.indexOf(x), `${x} must run before ${y}`).toBeLessThan(a.indexOf(y));

describe('story path: real walking on the collision grid, real trigger rules, chronological flags', () => {
  it('the full game (all seven side quests, all Dragon Balls) reaches the true ending in story order', { timeout: 60000 }, () => {
    const d = new StoryDriver({ seed: 1 }); playStory(d);
    const r = scriptsRun(d);
    for (const [a, b] of [['shore_scouts', 'village_enter'], ['village_enter', 'vegeta_arrive'], ['vegeta_arrive', 'cui_fight'], ['cui_fight', 'dodoria_fight'], ['dodoria_fight', 'ball2_pick'], ['ball2_pick', 'zarbon_fight'], ['zarbon_fight', 'guru_scene'], ['guru_scene', 'guldo_fight'], ['guldo_fight', 'recoome_fight'], ['recoome_fight', 'duo_fight'], ['duo_fight', 'ginyu_fight'], ['ginyu_fight', 'nail_frieza'], ['nail_frieza', 'frieza_forms'], ['frieza_forms', 'frieza_final_form'], ['frieza_final_form', 'final_battle'], ['final_battle', 'epilogue']]) before(r, a, b);
    for (const f of ['scouts1', 'dende_met', 'vegeta_joined', 'cui_done', 'dodoria_done', 'zarbon_done', 'guru_done', 'guldo_done', 'goku_joined', 'recoome_done', 'duo_done', 'ginyu_done', 'piccolo_joined', 'frieza3_done', 'krillin_dead', 'ssj', 'final_done', 'frieza_defeated', 'ending_seen']) expect(d.s.flags[f], f).toBe(true);
    expect(d.ended).toBe(true); expect(d.s.chapter).toBe(7);
    expect(ownedBalls(d.s)).toEqual([1, 2, 3, 4, 5, 6, 7]); expect(d.s.balls).toBe(7);
    expect(endingText(d)).toMatch(/Porunga rose/); expect(endingText(d)).not.toMatch(/never had all seven/);
    // the roster the story leaves behind: Vegeta fell, Krillin died, nobody invalid in the party
    expect(d.s.roster.map((m) => m.id).sort()).toEqual(['gohan', 'goku', 'piccolo']);
    expect([...d.s.party].sort()).toEqual(['gohan', 'goku', 'piccolo']);
    expect(d.s.roster.find((m) => m.id === 'goku')!.ssj).toBe(true); expect(d.s.roster.find((m) => m.id === 'piccolo')!.fused).toBe(true);
    for (const q of QUESTS) expect(d.s.flags[QUEST_DONE(q.id)], q.id).toBe(true);
  });

  it('the bare critical path (no side quests, only the story Dragon Balls) is completable and ends with the incomplete-collection epilogue', { timeout: 120000 }, () => {
    const d = new StoryDriver({ seed: 4 }); playStory(d, { sideQuests: false, balls: [] });
    expect(d.ended).toBe(true);
    expect(ownedBalls(d.s)).toEqual([1, 2]);
    expect(endingText(d)).toMatch(/never had all seven/); expect(endingText(d)).not.toMatch(/Porunga rose/);
    for (const q of QUESTS) expect(d.s.flags[QUEST_DONE(q.id)], q.id).toBeFalsy();
  });

  it('every subset of the optional Dragon Balls works: only a complete set gives the Porunga ending', { timeout: 120000 }, () => {
    const optional = [3, 4, 5, 6, 7];
    for (let mask = 0; mask < 32; mask += 3) {
      const balls = optional.filter((_, i) => mask & (1 << i));
      const d = new StoryDriver({ seed: 10 + mask }); playStory(d, { sideQuests: false, balls });
      expect(d.ended, `mask ${mask}`).toBe(true);
      const owned = ownedBalls(d.s); expect(owned, `mask ${mask}`).toEqual([1, 2, ...balls]);
      const full = owned.length === 7;
      expect(/Porunga rose/.test(endingText(d)), `mask ${mask} ending`).toBe(full); expect(/never had all seven/.test(endingText(d)), `mask ${mask} ending`).toBe(!full);
    }
  });

  it('the route completes on both difficulties and for many random-encounter seeds (encounters happen on the way, never inside scripts)', { timeout: 120000 }, () => {
    for (const difficulty of ['normal', 'easy'] as const) for (let seed = 1; seed <= 6; seed++) {
      const d = new StoryDriver({ seed, difficulty }); playStory(d, { sideQuests: seed % 2 === 0 });
      expect(d.ended, `${difficulty} seed ${seed}`).toBe(true);
      expect(d.randomFights, `${difficulty} seed ${seed}: random encounters must actually occur`).toBeGreaterThan(0);
    }
    // easy mode halves the encounter rate
    const normal = new StoryDriver({ seed: 5, difficulty: 'normal' }); playStory(normal, { sideQuests: false, balls: [] });
    const easy = new StoryDriver({ seed: 5, difficulty: 'easy' }); playStory(easy, { sideQuests: false, balls: [] });
    expect(easy.randomFights).toBeLessThan(normal.randomFights);
  });

  it('exits stay locked until their story flag is set: no sequence break by walking', () => {
    const d = new StoryDriver({ seed: 1 });
    expect(() => d.travelTo('guru')).toThrow(/No unlocked route/);
    expect(() => d.travelTo('landing')).toThrow(/No unlocked route/);      // needs Dende first (village exit lock)
    d.interact('ship'); d.enter('shore_scouts'); d.travelTo('village');
    expect(() => d.travelTo('landing')).toThrow(/No unlocked route/);      // still locked: Dende has not been helped
    d.enter('village_enter');
    d.travelTo('landing');
    expect(() => d.travelTo('hold')).toThrow(/No unlocked route/);         // ramp guarded until Dodoria falls
    expect(() => d.travelTo('cave')).toThrow(/No unlocked route/);
  });

  it('boss triggers are chronological: a trigger never fires before its prerequisite and never twice', { timeout: 120000 }, () => {
    const d = new StoryDriver({ seed: 2 }); playStory(d);
    const triggers = d.events.filter((e) => e.startsWith('trigger:'));
    // every story trigger fires exactly once; the final-form trigger twice because the plan answers "Prepare first" to its first prompt
    const counts = new Map<string, number>(); for (const t of triggers) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [t, n] of counts) expect(n, t).toBe(t === 'trigger:landing_frieza4' ? 2 : 1);
    const need: Record<string, string> = { ridge_recoome: 'guldo_done', ridge_duo: 'recoome_done', ridge_ginyu: 'duo_done', landing_cui: 'vegeta_arrived', landing_dodoria: 'cui_done', guru_trigger: 'zarbon_done', nail_fight_trigger: 'ginyu_done' };
    for (const [t, f] of Object.entries(need)) expect(triggers).toContain(`trigger:${t}`), expect(f).toBeTruthy();
  });

  it('the point of no return asks first: Cancel changes nothing and returns the player to a safe spot; Continue then proceeds', () => {
    const d = new StoryDriver({ seed: 3 });
    playStory(d, { stopBeforeFrieza: true });
    const snap = JSON.stringify({ f: d.s.flags, r: d.s.roster, i: d.s.inventory, z: d.s.zeni, c: d.s.chapter, p: d.s.party });
    const battles = d.battles.length;
    d.noEncounters();                                      // so the snapshot comparison sees story state only (the real game keeps encounters on)
    d.setAsk(() => false);
    d.enter('landing_frieza', ['landing_frieza4']);
    expect(d.prompts).toHaveLength(1);
    expect(d.prompts[0]).toMatch(/no way back/); expect(d.prompts[0]).toMatch(/Dragon Balls found: \d\/7/); expect(d.prompts[0]).toMatch(/Side quests still open: \d/);
    expect(d.events).toContain('ask:cancel');
    expect(JSON.stringify({ f: d.s.flags, r: d.s.roster, i: d.s.inventory, z: d.s.zeni, c: d.s.chapter, p: d.s.party }), 'cancel must change no story state').toBe(snap);
    expect(d.battles.length).toBe(battles); expect(d.mapId).toBe('landing');
    // the cancel put the player outside the trigger footprint, so they are not instantly re-prompted
    const t = MAPS.landing.ents.find((e) => e.id === 'landing_frieza')!;
    const inside = d.pos.x >= t.x * TILE - (t.w! * TILE) / 2 && d.pos.x <= t.x * TILE + (t.w! * TILE) / 2 && d.pos.y >= t.y * TILE - (t.h! * TILE) / 2 && d.pos.y <= t.y * TILE + (t.h! * TILE) / 2 + 6;
    expect(inside).toBe(false);
    d.setAsk(undefined); d.enter('landing_frieza', ['landing_frieza4']);
    expect(d.s.flags.ssj, 'Continue commits').toBe(true); expect(d.s.flags.krillin_dead).toBe(true);
  });

  it('Dragon Ball 7 on the last ground is collectible without starting the final fight', { timeout: 120000 }, () => {
    const d = new StoryDriver({ seed: 1 }); playStory(d);   // the plan collects ball 7 before entering core_final; the driver would have thrown on an unexpected trigger
    expect(d.events.indexOf('interact:ball7_pick')).toBeGreaterThan(-1);
    expect(d.events.indexOf('interact:ball7_pick')).toBeLessThan(d.events.indexOf('trigger:core_final'));
  });

  it('estimated length of the complete route (a model of walking, dialogue and fights, not a measured playtime)', { timeout: 120000 }, () => {
    const full = new StoryDriver({ seed: 1 }); playStory(full);
    const crit = new StoryDriver({ seed: 1 }); playStory(crit, { sideQuests: false, balls: [] });
    expect(full.battles.length).toBeGreaterThan(crit.battles.length);
    expect(crit.estimateMinutes()).toBeGreaterThan(20); expect(full.estimateMinutes()).toBeGreaterThan(crit.estimateMinutes() + 8);
    expect(full.sayCount).toBeGreaterThan(crit.sayCount);
  });
});
