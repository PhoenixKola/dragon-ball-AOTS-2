import { describe, it, expect } from 'vitest';
import { HEROES } from '../../src/data/heroes';
import { SKILLS } from '../../src/data/skills';
import { SKILL_ICON_IDS, ITEM_ICON_IDS, OVERWORLD } from '../../src/data/artManifest.generated';
import { SPRITE_BOXES } from '../../src/data/spriteManifest.generated';
import { BattleEngine, isError } from '../../src/engine/combat/engine';
import { effAtk, effDef, effSpd, hasStatus, SSJ_FORM } from '../../src/engine/combat/formulas';
import { choose } from '../../src/engine/combat/autoplay';
import { buildAlly, buildEnemy, newMember, equipSkill, equippedOf, skillsOf, statsOf, MAX_EQUIPPED, POTENTIAL } from '../../src/systems/party';
import { addItem, newGameState, ownedBalls, type GameState } from '../../src/systems/gameState';
import { serialize, deserialize, validateState } from '../../src/systems/save';
import { WISH_IDS, WISHES, allWishesGranted, canSummon, grantWish, grantedWishes, isGranted, pendingWishes, wishFlag, type WishId } from '../../src/systems/wishes';
import { preparePostgame } from '../../src/systems/postgame';
import { heroOverworld } from '../../src/engine/world/overworld';
import { SCRIPTS } from '../../src/data/scripts';
import { MAPS } from '../../src/data/maps';
import { condMet } from '../../src/systems/gameState';
import { fightOdds, trainedMember } from '../support/postgameSim';
import type { Step } from '../../src/engine/world/mapTypes';

function endState(balls = 7, extra: Partial<GameState['flags']> = {}): GameState {
  const s = newGameState();
  for (const f of ['scouts1', 'dende_met', 'vegeta_joined', 'cui_done', 'dodoria_done', 'zarbon_done', 'guru_done', 'goku_joined', 'duo_done', 'ginyu_done', 'piccolo_joined', 'piccolo_fused', 'frieza3_done', 'ssj', 'final_done', 'frieza_defeated', 'ending_seen']) s.flags[f] = true;
  for (let n = 1; n <= balls; n++) s.flags['ball' + n] = true;
  Object.assign(s.flags, extra); s.balls = balls; s.chapter = 7;
  s.roster = [newMember('gohan', 24), newMember('goku', 25), newMember('piccolo', 24)]; s.roster[1].ssj = true; s.roster[2].fused = true; s.party = ['goku', 'gohan', 'piccolo'];
  preparePostgame(s); return s;
}
const mk = (lv: number, foes: string[] = ['dodoria']) => new BattleEngine({ allies: [buildAlly((() => { const m = newMember('trunks', lv); equipSkill(m, 'ssjburning', 3); return m; })(), 0), buildAlly(newMember('gohan', lv), 1)], enemies: foes.map((f, i) => buildEnemy(f, i)), seed: 5, inventory: { medkit: 2 }, unlockedCombos: [] });
function turnOf(e: BattleEngine, id: string) {
  for (let i = 0; i < 80; i++) {
    const t = e.nextTurn(); if (t.kind === 'end') throw new Error('ended');
    if (t.actor.defId === id && t.kind !== 'skip') return t.actor;
    if (t.kind === 'input' || t.kind === 'ai') { e.submit({ kind: 'defend' }, t.actor.uid); e.finishAction({ id: 0, actorId: t.actor.uid, skillId: 'defend', targetIds: [], steps: [], guardTargets: [] }); }
  }
  throw new Error('turn');
}

describe('Future Trunks data', () => {
  it('is a real hero: 12 library skills, 4 equipped, extra transformation, Rage Art, art, icons, overworld, portrait', () => {
    const h = HEROES.trunks; expect(h.skills.length).toBeGreaterThanOrEqual(10); expect(h.extra).toContain('ssjtrunks'); expect(SKILLS[h.rageArt].rageArt).toBe(true);
    for (const id of [...h.skills, ...(h.extra ?? []), h.rageArt, 'atk_trunks']) { expect(SKILLS[id], id).toBeDefined(); expect(SKILL_ICON_IDS, 'icon ' + id).toContain(id); }
    expect(ITEM_ICON_IDS).toContain('dragoncrest');
    for (const sp of ['trunks', 'trunks_ssj']) for (const pose of ['idle', 'attack', 'guard', 'hurt', 'charge', 'special', 'victory', 'ko']) expect(SPRITE_BOXES[sp][pose], `${sp}:${pose}`).toBeDefined();
    expect(OVERWORLD.trunks).toBeDefined(); expect(heroOverworld('trunks', {}, false)).toEqual({ entity: 'trunks', provisional: false });
    const roles = new Set(h.skills.map((s) => SKILLS[s].role)); expect(roles.size).toBeGreaterThanOrEqual(5);
    const kinds = new Set(h.skills.map((s) => SKILLS[s].kind)); for (const k of ['damage', 'heal', 'buff']) expect(kinds.has(k as never), k).toBe(true);
    const clips = new Set(h.skills.map((s) => SKILLS[s].clip)); expect(clips.size).toBe(h.skills.length);   // no animation reused for all skills
  });
  it('default loadout is four, loadout rules hold, SSJ-only skills stay equipped outside the form', () => {
    const m = newMember('trunks', 28); expect(equippedOf(m)).toEqual(['swordrush', 'burningattack', 'finishbuster', 'kibarrier']);
    expect(equipSkill(m, 'ssjburning', 3)).toBeNull(); expect(equippedOf(m)).toContain('ssjburning'); expect(equippedOf(m).length).toBeLessThanOrEqual(MAX_EQUIPPED);
    expect(skillsOf(m)).toContain('ssjburning');   // never silently dropped
    expect(equipSkill(m, 'meteorcombo', 2)).toMatch(/learned/);   // Goku's skill
  });
  it('maps and recruit stats: appropriate level, equipment capsule eligible', () => {
    const m = newMember('trunks', 24); const st = statsOf(m); expect(st.hp).toBeGreaterThan(600); m.capsules = ['powercap']; expect(statsOf(m).atk).toBeGreaterThan(st.atk);
  });
});

describe('Super Saiyan Trunks in battle', () => {
  it('SSJ-only skills are refused until the form is active; transforming is one-way for the battle and cannot be repeated', () => {
    const e = mk(28); const t = turnOf(e, 'trunks'); const foe = e.enemies()[0];
    const slot = equippedOf(newMember('trunks', 28));
    expect(slot).toBeDefined();
    const bad = e.plan({ kind: 'skill', skill: 'ssjburning', target: foe.uid }, t.uid); expect(isError(bad) && bad.error).toMatch(/Super Saiyan/);
    const atk0 = effAtk(t), def0 = effDef(t), spd0 = effSpd(t);
    const p = e.submit({ kind: 'skill', skill: 'ssjtrunks' }, t.uid); expect(isError(p)).toBe(false);
    if (!isError(p)) { for (const s of p.steps) e.commit(p, s, 'none'); e.finishAction(p); }
    expect(hasStatus(t, 'ssjform')).toBe(true);
    expect(effAtk(t)).toBeCloseTo(atk0 * SSJ_FORM.atk, 5); expect(effDef(t)).toBeCloseTo(def0 * SSJ_FORM.def, 5); expect(effSpd(t)).toBeCloseTo(spd0 * SSJ_FORM.spd, 5);
    expect(t.ssj).toBe(false);   // never the Goku flag
    const t2 = turnOf(e, 'trunks');
    const again = e.plan({ kind: 'skill', skill: 'ssjtrunks' }, t2.uid); expect(isError(again) && again.error).toMatch(/Already/);
    const ok = e.plan({ kind: 'skill', skill: 'ssjburning', target: foe.uid }, t2.uid); expect(isError(ok)).toBe(false);
  });
  it('the form drains Ki every own turn and ends when Ki runs out (with a message)', () => {
    const e = mk(28); const t = turnOf(e, 'trunks');
    e.finishAction(((p) => { if (isError(p)) throw new Error(p.error); for (const s of p.steps) e.commit(p, s, 'none'); return p; })(e.submit({ kind: 'skill', skill: 'ssjtrunks' }, t.uid)));
    const ki0 = t.ki; t.ki = 10;
    for (let i = 0; i < 12 && hasStatus(t, 'ssjform'); i++) { const x = turnOf(e, 'trunks'); void x; e.submit({ kind: 'defend' }, t.uid); e.finishAction({ id: 0, actorId: t.uid, skillId: 'defend', targetIds: [], steps: [], guardTargets: [] }); }
    expect(hasStatus(t, 'ssjform')).toBe(false); expect(ki0).toBeGreaterThan(0);
    expect(e.log.some((l) => /drops out of Super Saiyan/.test(l.text))).toBe(true);
  });
  it('the autoplay bot transforms Trunks when healthy and never picks an unusable Super Saiyan skill', () => {
    const e = mk(28); const t = turnOf(e, 'trunks'); const c = choose(e, t); expect(c).toEqual({ kind: 'skill', skill: 'ssjtrunks' });
    t.hp = Math.round(t.stats.hp * 0.3); const c2 = choose(e, t); expect(c2.kind === 'skill' ? SKILLS[c2.skill].ssjOnly : false).toBeFalsy();
  });
  it('Rage, Sparking and Active Guard interact normally (Sparking stacks with the form without double spending)', () => {
    const e = mk(28); const t = turnOf(e, 'trunks'); t.rage = 100;
    const p = e.submit({ kind: 'sparking' }, t.uid); expect(isError(p)).toBe(false); if (!isError(p)) e.finishAction(p);
    expect(hasStatus(t, 'sparking')).toBe(true); expect(t.rage).toBe(0);
  });
});

describe('Porunga: three nonexclusive wishes', () => {
  it('summoning needs the postgame and all seven balls; missing balls are named; finishing the collection in free roam is possible', () => {
    expect(canSummon(endState(7, {}).flags.postgame_unlocked ? endState(7) : endState(7)).ok).toBe(true);
    const s = endState(5); const c = canSummon(s); expect(c.ok).toBe(false); if (!c.ok) { expect(c.reason).toBe('balls'); expect(c.missing).toEqual([6, 7]); }
    const pre = newGameState(); for (let n = 1; n <= 7; n++) pre.flags['ball' + n] = true; expect(canSummon(pre)).toMatchObject({ ok: false, reason: 'locked' });
    // the last balls can still be reached after the credits: the Last Ground has a postgame way in and out
    const core = MAPS.core, landing = MAPS.landing; const post = endState(5);
    expect(condMet(post, landing.ents.find((e) => e.id === 'landing_to_core_post')!.when)).toBe(true); expect(condMet(post, core.ents.find((e) => e.id === 'core_to_landing')!.when)).toBe(true);
    expect(condMet(post, core.ents.find((e) => e.id === 'ball7_pick')!.when)).toBe(true);
    expect(condMet(post, core.ents.find((e) => e.id === 'core_final')!.when)).toBe(false);   // the final fight cannot re-trigger
  });
  const orders: WishId[][] = [['trunks', 'potential', 'relic'], ['relic', 'trunks', 'potential'], ['potential', 'relic', 'trunks'], ['potential', 'trunks', 'relic'], ['trunks', 'relic', 'potential'], ['relic', 'potential', 'trunks']];
  for (const order of orders) it(`wishes in order ${order.join(' > ')}: each exactly once, rewards complete and consistent`, () => {
    const s = endState(7); const flagsBefore = { ...s.flags };
    for (const id of order) { const r = grantWish(s, id); expect(r.ok, id).toBe(true); expect(isGranted(s, id)).toBe(true); }
    expect(allWishesGranted(s)).toBe(true); expect(grantedWishes(s).length).toBe(3);
    for (const k of Object.keys(flagsBefore)) expect(s.flags[k], k).toBe(true);
    expect(ownedBalls(s).length).toBe(7);
    const tr = s.roster.filter((m) => m.id === 'trunks'); expect(tr.length).toBe(1);
    expect(s.roster.every((m) => m.potential === true), 'potential covers everyone including a later recruit').toBe(true);
    expect(s.inventory.dragoncrest).toBe(1);
    expect(s.party.length).toBeLessThanOrEqual(3); expect(s.party.includes('trunks')).toBe(false);   // the party was full: he waits on the bench
    // repeats change nothing
    const snap = JSON.stringify({ ...s, savedAt: 0 }); for (const id of order) expect(grantWish(s, id).ok).toBe(false); expect(JSON.stringify({ ...s, savedAt: 0 })).toBe(snap);
    expect(canSummon(s)).toMatchObject({ ok: false, reason: 'done' });
  });
  it('Hidden Potential is applied once per fighter and raises the real stats by the published multipliers', () => {
    const s = endState(7); const g = s.roster.find((m) => m.id === 'goku')!; const before = statsOf(g);
    grantWish(s, 'potential'); grantWish(s, 'potential'); const after = statsOf(g);
    expect(after.hp).toBe(Math.round(before.hp * POTENTIAL.hp)); expect(after.atk).toBe(Math.round(before.atk * POTENTIAL.atk));
  });
  it('the relic is a single item: grant once, equip/unequip never duplicates it, revisits and reloads keep exactly one', () => {
    const s = endState(7); grantWish(s, 'relic'); expect(s.inventory.dragoncrest).toBe(1);
    s.roster[0].capsules = ['dragoncrest']; delete s.inventory.dragoncrest;   // equipped: inventory is empty
    s.flags[wishFlag('relic')] = false as never; delete s.flags[wishFlag('relic')];  // simulate a lost flag: still no second crest
    grantWish(s, 'relic'); expect((s.inventory.dragoncrest ?? 0)).toBe(0); expect(s.roster[0].capsules).toEqual(['dragoncrest']);
    const st = statsOf(s.roster[0]); s.roster[0].capsules = []; expect(st.atk).toBeGreaterThan(statsOf(s.roster[0]).atk);
  });
  it('Trunks joins the party when there is a free seat, otherwise the bench; his loadout persists', () => {
    const s = endState(7); s.party = ['goku', 'gohan']; grantWish(s, 'trunks'); expect(s.party).toContain('trunks');
    const t = s.roster.find((m) => m.id === 'trunks')!; expect(t.level).toBeGreaterThanOrEqual(22); equipSkill(t, 'crossingslash', 3);
    const p = deserialize(serialize(s)); expect(p.ok).toBe(true); if (p.ok) expect(equippedOf(p.state.roster.find((m) => m.id === 'trunks')!)).toEqual(equippedOf(t));
  });
  it('cancelling spends nothing: the script path only changes state through grantWish', () => {
    const s = endState(7); const before = JSON.stringify({ ...s, savedAt: 0 }); expect(canSummon(s).ok).toBe(true);
    expect(JSON.stringify({ ...s, savedAt: 0 })).toBe(before); expect(pendingWishes(s)).toEqual([...WISH_IDS]);
    const shrine = MAPS.guru.ents.find((e) => e.id === 'porunga_shrine')!; expect(shrine.script).toBe('porunga_shrine');
    expect(SCRIPTS.porunga_shrine.some((st: Step) => 'porunga' in st)).toBe(true);
  });
  it('wishes are refused without the postgame or the balls, and do not disturb either ending', () => {
    const s = endState(7); const flags = { ...s.flags }; const bad = endState(4); expect(grantWish(bad, 'trunks').ok).toBe(false); expect(bad.roster.some((m) => m.id === 'trunks')).toBe(false);
    grantWish(s, 'relic'); for (const k of ['ending_seen', 'frieza_defeated', 'final_done', ...Object.keys(flags)]) expect(s.flags[k], k).toBe(true);
  });
  it('every wish has art and text; Trunks recruit explanation is non-canon', () => {
    for (const w of Object.values(WISHES)) { expect(w.title.length).toBeGreaterThan(5); expect(w.detail.length).toBeGreaterThan(40); }
    expect(WISHES.trunks.detail).toMatch(/non-canon/i);
  });
});

describe('saves with wishes and Trunks', () => {
  it('a full postgame save round-trips; old saves load; tampering is rejected', () => {
    const s = endState(7); for (const id of WISH_IDS) grantWish(s, id);
    const p = deserialize(serialize(s)); expect(p.ok).toBe(true); if (p.ok) { expect(grantedWishes(p.state).length).toBe(3); expect(p.state.roster.find((m) => m.id === 'trunks')).toBeDefined(); expect(p.state.inventory.dragoncrest).toBe(1); }
    const old = JSON.parse(JSON.stringify(newGameState())); expect(validateState(old).ok).toBe(true);
    const raw = JSON.parse(JSON.stringify(s)); delete raw.flags.wish_trunks; expect(validateState(raw).ok, 'Trunks without the wish').toBe(false);
    const raw2 = JSON.parse(JSON.stringify(s)); delete raw2.flags.wish_potential; expect(validateState(raw2).ok, 'potential without the wish').toBe(false);
    const raw3 = JSON.parse(JSON.stringify(s)); raw3.roster[0].potential = 'yes'; expect(validateState(raw3).ok).toBe(false);
    const raw4 = JSON.parse(JSON.stringify(s)); raw4.roster.find((m: { id: string }) => m.id === 'trunks').equipped = ['swordrush', 'swordrush']; expect(validateState(raw4).ok).toBe(false);
  });
  it('a save made before the update (no wishes) keeps working and can still make all three wishes', () => {
    const s = endState(7); const p = deserialize(serialize(s)); expect(p.ok).toBe(true);
    if (p.ok) { for (const id of WISH_IDS) expect(grantWish(p.state, id).ok).toBe(true); }
  });
  it('items: addItem relics cap at 99 but the wish never grants more than one', () => { const s = endState(7); addItem(s, 'senzu', 2); grantWish(s, 'relic'); expect(s.inventory.dragoncrest).toBe(1); });
});

describe('Cooler with and without the wishes (simulated; not a human playthrough)', () => {
  const party = (lv: number, wishes: boolean) => {
    const ms = [trainedMember('goku', lv, { ssj: true, capsules: ['powercap', 'guardcap'] }), trainedMember('gohan', lv, { capsules: ['powercap', 'vitalcap'] }), trainedMember('piccolo', lv, { fused: true, capsules: ['guardcap', 'vitalcap'] })];
    if (wishes) for (const m of ms) { m.potential = true; }
    if (wishes) ms[0].capsules = ['dragoncrest', 'powercap'];
    return ms;
  };
  it('Cooler stays beatable and fair without any wish, and wishes help but are not required', () => {
    const base = fightOdds({ party: party(28, false), foes: ['cooler'], perfect: 0.15, good: 0.3, seeds: 8 });
    const wished = fightOdds({ party: party(28, true), foes: ['cooler'], perfect: 0.15, good: 0.3, seeds: 8 });
    expect(base.win, 'Lv28 without wishes').toBeGreaterThanOrEqual(0.7); expect(wished.win).toBeGreaterThanOrEqual(base.win - 0.13);
    const hard = fightOdds({ party: party(22, true), foes: ['cooler'], perfect: 0.15, good: 0.3, seeds: 8 }); expect(hard.win, 'wishes do not trivialise Lv22').toBeLessThanOrEqual(0.9);
  });
  it('Trunks fights with the party in the sim and is not an instant win', () => {
    const t = (() => { const m = trainedMember('trunks', 26, { capsules: ['powercap', 'guardcap'] }); return m; })();
    const withT = [trainedMember('goku', 26, { ssj: true, capsules: ['powercap', 'guardcap'] }), trainedMember('gohan', 26, { capsules: ['powercap', 'vitalcap'] }), t];
    const r = fightOdds({ party: withT, foes: ['cooler'], perfect: 0.15, good: 0.3, seeds: 8 });
    expect(r.rounds).toBeGreaterThan(12); expect(r.win).toBeLessThanOrEqual(1);
  });
});
