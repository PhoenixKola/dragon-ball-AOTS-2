import { describe, it, expect } from 'vitest';
import { BattleEngine } from '../../src/engine/combat/engine';
import { BattleDirector, type Stage } from '../../src/engine/combat/director';
import { GuardTracker, GUARD_PRESETS } from '../../src/engine/combat/guard';
import { buildAlly, buildEnemy, newMember } from '../../src/systems/party';
import { CLIPS, getClip } from '../../src/engine/animation/clips';
import { SKILLS } from '../../src/data/skills';
import { ENEMIES } from '../../src/data/enemies';
import { COMBOS } from '../../src/data/combos';
import type { HeroId, HitResult } from '../../src/types';

class FakeStage implements Stage {
  calls: { t: () => number; name: string; arg?: unknown }[] = [];
  now = () => 0;
  private rec(name: string, arg?: unknown) { this.calls.push({ t: this.now, name, arg }); }
  log: { name: string; at: number; arg?: unknown }[] = [];
  private l(name: string, arg?: unknown) { this.log.push({ name, at: this.now(), arg }); }
  setPose(u: string, p: string) { this.l('pose', { u, p }); }
  move() { this.l('move'); }
  projectile(u: string, vfx: string, t: string) { this.l('proj', { u, vfx, t }); }
  chargeVfx() { this.l('chargeVfx'); }
  contact(t: string) { this.l('contact', t); }
  react(t: string, r: HitResult) { this.l('react', { t, r }); }
  ko(u: string) { this.l('ko', u); }
  aura() { this.l('aura'); }
  sfx() {}
  shake() {}
  flash() {}
  zoom() {}
  darken() {}
  banner(t: string) { this.l('banner', t); }
  floatText() {}
  transform(u: string, s: string) { this.l('transform', { u, s }); }
  resetPositions() {}
  victory() { this.l('victory'); }
  guardCue() {}
  focus() {}
  void = this.rec;
}

function setup(heroes: [HeroId, number][], foes: string[], seed = 5, opts: { speed?: number; guard?: 'standard' | 'relaxed' | 'assist' } = {}) {
  const allies = heroes.map(([id, lv], i) => buildAlly(newMember(id, lv), i));
  const enemies = foes.map((id, i) => buildEnemy(id, i));
  const engine = new BattleEngine({ allies, enemies, seed, inventory: { medkit: 3 }, unlockedCombos: ['gohan_krillin', 'goku_vegeta', 'z_trio'] });
  const stage = new FakeStage();
  const guard = new GuardTracker(GUARD_PRESETS[opts.guard ?? 'standard']);
  const inputs: string[] = [];
  let outcome = 'ongoing';
  const director = new BattleDirector(engine, stage, {
    onChange: () => {}, onInput: (a) => { inputs.push(a.uid); }, onOutcome: (o) => { outcome = o; },
  }, { guard, speed: opts.speed });
  stage.now = () => director.time;
  return { engine, stage, director, guard, inputs, get outcome() { return outcome; } };
}
const STEP = 16;
function runUntil(d: BattleDirector, cond: () => boolean, maxMs = 60000) {
  let t = 0;
  while (!cond() && t < maxMs) { d.update(STEP); t += STEP; }
  if (!cond()) throw new Error('condition not met within ' + maxMs + 'ms (state ' + d.state + ')');
}

describe('clip data integrity', () => {
  it('every skill references a clip and clip hit markers match the skill hit list', () => {
    for (const s of Object.values(SKILLS)) {
      const clip = getClip(s.clip);
      if (s.chargeTurns) { /* telegraph uses e_charge; real clip runs when released */ }
      if (s.kind === 'damage' || s.kind === 'status' || s.kind === 'heal' || s.kind === 'buff' || s.kind === 'revive' || s.kind === 'special') {
        expect(clip.hitCount, `${s.id} -> ${s.clip}`).toBe(s.hits.length);
        s.hits.forEach((_, i) => expect(clip.hitTimes[i], `${s.id} hit ${i}`).toBeTypeOf('number'));
      }
    }
  });
  it('every enemy move and hero skill resolves', () => {
    for (const e of Object.values(ENEMIES)) {
      for (const m of e.moves) expect(SKILLS[m.skill], `${e.id}:${m.skill}`).toBeDefined();
      for (const m of e.pattern?.kind === 'cycle' ? e.pattern.moves : []) expect(SKILLS[m]).toBeDefined();
    }
    for (const c of COMBOS) expect(SKILLS[c.skill]).toBeDefined();
  });
  it('no two hero techniques share the same clip (each move is distinct)', () => {
    const heroSkills = Object.values(SKILLS).filter((s) => !s.id.startsWith('e_') && !s.id.startsWith('atk_') && s.kind === 'damage');
    const byClip = new Map<string, string[]>();
    heroSkills.forEach((s) => byClip.set(s.clip, [...(byClip.get(s.clip) ?? []), s.id]));
    const shared = [...byClip.entries()].filter(([, v]) => v.length > 1);
    // Nail reuses Masenko's choreography; everything else must be unique.
    expect(shared.filter(([, v]) => !(v.includes('nailbeam') && v.includes('masenko')))).toEqual([]);
  });
  it('clips are registered', () => { expect(Object.keys(CLIPS).length).toBeGreaterThan(50); });
});

describe('director synchronises animation and state', () => {
  it('blind misses show MISS without contact impact or hit audio', () => {
    let sawMiss = false;
    for (let seed = 1; seed <= 20 && !sawMiss; seed++) {
      const h = setup([['gohan', 5]], ['dodoria'], seed);
      const actor = h.engine.get('a_gohan');
      actor.stats.spd = 99;
      actor.statuses.push({ kind: 'blind', turns: 2 });
      h.director.start();
      runUntil(h.director, () => h.director.isPlayerInput);
      expect(h.director.submit({ kind: 'attack', target: h.engine.enemies()[0].uid }).ok).toBe(true);
      h.director.flushPlan();
      const results = h.stage.log.filter((x) => x.name === 'react').map((x) => (x.arg as { r: HitResult }).r);
      sawMiss = results.some((r) => r.missed);
      if (sawMiss) expect(h.stage.log.filter((x) => x.name === 'contact')).toHaveLength(results.filter((r) => !r.missed).length);
    }
    expect(sawMiss).toBe(true);
  });

  it('Gohan attack: HP unchanged until the first hit marker, damage lands once per marker', () => {
    const h = setup([['gohan', 5]], ['dodoria'], 11);
    h.engine.get('a_gohan').stats.spd = 99;
    h.director.start();
    runUntil(h.director, () => h.director.isPlayerInput);
    const foe = h.engine.enemies()[0];
    const hp0 = foe.hp;
    const clip = getClip('gohan_combo');
    expect(h.director.submit({ kind: 'attack', target: foe.uid }).ok).toBe(true);
    const t0 = h.director.time;
    let reacts = 0;
    const times: number[] = [];
    while (h.director.state === 'acting' || h.director.state === 'finishing') {
      h.director.update(STEP);
      const rs = h.stage.log.filter((x) => x.name === 'react').length;
      if (rs > reacts) { reacts = rs; times.push(h.director.time - t0); }
      if (reacts === 0) expect(foe.hp).toBe(hp0);
    }
    expect(reacts).toBe(3);
    times.forEach((t, i) => expect(t).toBeGreaterThanOrEqual(clip.hitTimes[i] - 1));
    times.forEach((t, i) => expect(t).toBeLessThan(clip.hitTimes[i] + 2 * STEP + 5));
    expect(foe.hp).toBeLessThan(hp0);
  });

  it('pausing freezes the clock: no damage or enemy attacks land while paused', () => {
    const h = setup([['gohan', 5]], ['dodoria'], 11);
    h.engine.get('a_gohan').stats.spd = 99;
    h.director.start();
    runUntil(h.director, () => h.director.isPlayerInput);
    const foe = h.engine.enemies()[0];
    h.director.submit({ kind: 'attack', target: foe.uid });
    for (let i = 0; i < 6; i++) h.director.update(STEP);
    h.director.paused = true;
    const hp = foe.hp, t = h.director.time, logLen = h.stage.log.length;
    for (let i = 0; i < 500; i++) h.director.update(STEP);
    expect(foe.hp).toBe(hp);
    expect(h.director.time).toBe(t);
    expect(h.stage.log.length).toBe(logLen);
    expect(h.director.submit({ kind: 'defend' }).ok).toBe(false);
    h.director.paused = false;
    runUntil(h.director, () => foe.hp < hp);
  });

  it('dispose cancels in-flight hits so nothing applies afterwards', () => {
    const h = setup([['goku', 5]], ['dodoria'], 3);
    h.engine.get('a_goku').stats.spd = 99;
    h.director.start();
    runUntil(h.director, () => h.director.isPlayerInput);
    const foe = h.engine.enemies()[0];
    h.director.submit({ kind: 'attack', target: foe.uid });
    for (let i = 0; i < 3; i++) h.director.update(STEP);
    const hp = foe.hp;
    h.director.dispose();
    for (let i = 0; i < 400; i++) h.director.update(STEP);
    expect(foe.hp).toBe(hp);
  });

  it('rejects a second command while an action is running (no double-submit)', () => {
    const h = setup([['gohan', 5]], ['dodoria'], 11);
    h.engine.get('a_gohan').stats.spd = 99;
    h.director.start();
    runUntil(h.director, () => h.director.isPlayerInput);
    const foe = h.engine.enemies()[0];
    expect(h.director.submit({ kind: 'attack', target: foe.uid }).ok).toBe(true);
    expect(h.director.submit({ kind: 'attack', target: foe.uid }).ok).toBe(false);
  });
});

describe('Active Guard against a real enemy attack', () => {
  function enemyHitTest(press: null | 'perfect' | 'early' | 'late') {
    const h = setup([['gohan', 8]], ['recoome'], 21);
    const gohan = h.engine.get('a_gohan');
    gohan.stats.spd = 1; // enemy first
    // force a deterministic single-hit enemy move
    h.engine.aiCommand = () => ({ kind: 'skill', skill: 'e_recoomebomber' });
    h.director.start();
    runUntil(h.director, () => h.director.state === 'acting');
    const cue = h.director.activeCues[0];
    expect(cue.uid).toBe('a_gohan');
    const hp0 = gohan.hp;
    let pressed = false;
    const target = press === 'perfect' ? cue.impactAt : press === 'early' ? cue.impactAt - 600 : cue.impactAt + 60;
    let results: HitResult[] = [];
    while (h.director.state === 'acting' || h.director.state === 'finishing') {
      if (press && !pressed && h.director.time >= target) { h.director.pressGuard('a_gohan'); pressed = true; }
      h.director.update(STEP);
    }
    results = h.stage.log.filter((x) => x.name === 'react').map((x) => (x.arg as { r: HitResult }).r);
    expect(results).toHaveLength(1);
    return { grade: results[0].guard, dmg: hp0 - gohan.hp };
  }
  it('no press → full damage; perfect → heavily reduced; early mash outside window does nothing', () => {
    const none = enemyHitTest(null);
    const perfect = enemyHitTest('perfect');
    const early = enemyHitTest('early');
    const late = enemyHitTest('late');
    expect(none.grade).toBe('none');
    expect(perfect.grade).toBe('perfect');
    expect(early.grade).toBe('none');
    expect(['perfect', 'good']).toContain(late.grade);
    expect(perfect.dmg).toBeLessThan(none.dmg * 0.3);
  });
  it('guard cue belongs to the defender actually being targeted', () => {
    const h = setup([['gohan', 8], ['krillin', 8], ['goku', 8]], ['recoome'], 4);
    h.engine.fighters.filter((f) => f.side === 'ally').forEach((f) => { f.stats.spd = 1; });
    h.engine.aiCommand = () => ({ kind: 'skill', skill: 'e_recoomebomber' });
    h.director.start();
    runUntil(h.director, () => h.director.state === 'acting');
    expect(h.director.activeCues).toHaveLength(1);
    expect(h.director.currentPlan!.targetIds).toEqual([h.director.activeCues[0].uid]);
  });
  it('anti-mash: rapid repeat presses are ignored', () => {
    const g = new GuardTracker();
    expect(g.press('x', 1000)).toBe(true);
    expect(g.press('x', 1100)).toBe(false);
    expect(g.press('x', 1400)).toBe(true);
  });
  it('windows scale with accessibility preset', () => {
    const grade = (preset: 'standard' | 'assist', dt: number) => { const g = new GuardTracker(GUARD_PRESETS[preset]); g.press('x', 1000 + dt); return g.grade('x', 1000); };
    expect(grade('standard', 140)).toBe('good');
    expect(grade('standard', 40)).toBe('perfect');
    expect(grade('assist', 140)).toBe('perfect');
    expect(grade('standard', 400)).toBe('none');
  });
});

describe('full simulated fights complete without stalls', () => {
  const fights: [string, [HeroId, number][], string[]][] = [
    ['scouts', [['gohan', 3], ['krillin', 3]], ['scout', 'scout']],
    ['cui', [['gohan', 6], ['krillin', 6], ['vegeta', 6]], ['cui', 'guard']],
    ['dodoria', [['gohan', 8], ['krillin', 8], ['vegeta', 8]], ['dodoria']],
    ['zarbon', [['gohan', 10], ['krillin', 10], ['vegeta', 10]], ['zarbon']],
    ['guldo', [['gohan', 12], ['krillin', 12], ['vegeta', 12]], ['guldo']],
    ['ginyu', [['goku', 18], ['vegeta', 18], ['gohan', 18]], ['ginyu']],
  ];
  for (const [name, party, foes] of fights) {
    it(`${name}: reaches an outcome with sane state`, () => {
      const h = setup(party, foes, 17, { speed: 1 });
      h.director.start();
      const fakeInput = () => {
        const a = h.director.currentActor!;
        const cmds = [
          ...(a.rage >= 100 ? [{ kind: 'skill', skill: a.skills[a.skills.length - 1], target: h.engine.enemies()[0].uid } as const] : []),
          { kind: 'skill', skill: a.skills[0], target: h.engine.enemies()[0].uid } as const,
          { kind: 'attack', target: h.engine.enemies()[0].uid } as const,
        ];
        for (const c of cmds) if (h.director.submit(c).ok) return;
        h.director.submit({ kind: 'defend' });
      };
      let guard = 0;
      while (h.director.state !== 'ended' && guard++ < 60000) {
        if (h.director.isPlayerInput) fakeInput();
        if (h.director.activeCues.length) h.director.pressGuardAll();
        h.director.update(STEP);
        h.engine.fighters.forEach((f) => { expect(f.hp).toBeGreaterThanOrEqual(0); expect(f.ki).toBeGreaterThanOrEqual(0); expect(f.rage).toBeLessThanOrEqual(100); expect(f.hp).toBeLessThanOrEqual(f.stats.hp); });
      }
      expect(h.director.state).toBe('ended');
      expect(['victory', 'defeat']).toContain(h.director.outcome);
    });
  }
});
