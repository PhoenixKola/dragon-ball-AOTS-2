import { describe, it, expect, afterEach } from 'vitest';
import { StoryDriver } from '../support/storyDriver';
import { playStory } from '../support/storyPlan';
import { MAPS } from '../../src/data/maps';
import { SCRIPTS } from '../../src/data/scripts';
import { ITEMS } from '../../src/data/heroes';
import { QUESTS, QUEST_DONE, questById } from '../../src/data/quests';
import type { Step } from '../../src/engine/world/mapTypes';
import { condMet, newGameState } from '../../src/systems/gameState';
import { completeQuest, journalQuests, questProgress, questStatus, rewardText, startQuest } from '../../src/systems/storyRuntime';
import { validateState, deserialize, serialize } from '../../src/systems/save';

// These files run long synchronous story simulations: yield between tests so the vitest worker can report progress (otherwise: "Timeout calling onTaskUpdate").
afterEach(() => new Promise<void>((r) => setTimeout(r, 0)));

function stepsOf(steps: Step[], out: Step[] = []): Step[] {
  for (const st of steps) {
    out.push(st);
    if ('if' in st) { stepsOf(st.then, out); stepsOf(st.else ?? [], out); }
    if ('battle' in st) { stepsOf(st.win ?? [], out); stepsOf(st.lose ?? [], out); }
    if ('ask' in st) stepsOf(st.ask.onNo, out);
  }
  return out;
}
const snapshot = (d: StoryDriver) => JSON.stringify({ z: d.s.zeni, i: d.s.inventory, c: d.s.combos, b: d.s.balls, ch: d.s.chapter, r: d.s.roster.map((m) => [m.id, m.level, m.xp, m.unspent, m.capsules]), f: Object.keys(d.s.flags).sort() });

describe('quest definitions are complete and consistent', () => {
  it('ids and flags are unique and use the persisted-flag naming (saves need no new fields)', () => {
    expect(new Set(QUESTS.map((q) => q.id)).size).toBe(QUESTS.length);
    expect(new Set(QUESTS.map((q) => q.startFlag)).size).toBe(QUESTS.length);
    for (const q of QUESTS) { expect(q.startFlag, q.id).toMatch(/^[A-Za-z0-9_:\-]{1,64}$/); expect(QUEST_DONE(q.id)).toMatch(/^[A-Za-z0-9_:\-]{1,64}$/); }
    expect(QUESTS.length).toBe(7);
  });
  it('every quest has a start step and a turn-in step in scripts, valid rewards, and reachable, real objectives', () => {
    const all = Object.values(SCRIPTS).flatMap((s) => stepsOf(s));
    for (const q of QUESTS) {
      expect(all.some((s) => 'quest' in s && s.quest.id === q.id && s.quest.do === 'start'), `${q.id} start`).toBe(true);
      expect(all.some((s) => 'quest' in s && s.quest.id === q.id && s.quest.do === 'complete'), `${q.id} complete`).toBe(true);
      for (const id of Object.keys(q.reward.items ?? {})) expect(ITEMS[id], `${q.id} reward item ${id}`).toBeDefined();
      expect(q.reward.xp ?? 0).toBeLessThanOrEqual(500); expect(q.reward.zeni ?? 0).toBeLessThanOrEqual(400);   // balance: side rewards stay modest
      expect(rewardText(q.reward).length).toBeGreaterThan(0); expect(q.steps.length).toBeGreaterThan(0);
      for (const st of q.steps) for (const f of [st.done.flag ?? []].flat()) {
        if (f.startsWith('foe:')) expect(Object.values(MAPS).some((m) => m.ents.some((e) => e.kind === 'foe' && 'foe:' + e.id === f)), `${q.id}: ${f} is a real patrol`).toBe(true);
        else if (f.startsWith('qp:')) expect(all.some((s) => 'set' in s && [s.set].flat().includes(f)), `${q.id}: ${f} is set by a script`).toBe(true);
        for (const id of Object.keys(st.done.has ?? {})) expect(ITEMS[id]).toBeDefined();
      }
    }
  });
  it('every quest objective patrol exists at the time the quest is available', () => {
    for (const q of QUESTS) for (const st of q.steps) for (const f of [st.done.flag ?? []].flat().filter((x) => x.startsWith('foe:'))) {
      const ent = Object.values(MAPS).flatMap((m) => m.ents).find((e) => 'foe:' + e.id === f)!;
      const s = newGameState();
      // grant everything the quest needs to be offered, plus the patrol's own condition: it must be satisfiable at the same time
      for (const k of [q.available.flag ?? []].flat()) s.flags[k] = true;
      for (const k of [ent.when?.flag ?? []].flat()) s.flags[k] = true;
      expect(condMet(s, ent.when) && !([q.available.not ?? []].flat().some((k) => s.flags[k])), `${q.id}: ${f} present when offered`).toBe(true);
    }
  });
});

describe('quests in play (real walking, real scripts)', () => {
  it('Stolen Supplies: locked -> offered -> active -> ready -> done, reward paid once', () => {
    const d = new StoryDriver({ seed: 2 }); const q = questById('shore_net')!;
    expect(questStatus(d.s, q)).toBe('locked');
    d.interact('ship'); d.enter('shore_scouts');
    expect(questStatus(d.s, q)).toBe('available');
    d.interact('fisher'); expect(questStatus(d.s, q)).toBe('active'); expect(d.toasts.some((t) => /New quest: Stolen Supplies/.test(t))).toBe(true);
    d.interact('fisher');                                   // talking again must not restart or reward
    expect(questStatus(d.s, q)).toBe('active');
    d.engage('shore_foe1'); expect(questProgress(d.s, q).map((p) => p.done)).toEqual([true, false]);
    d.interact('shore_sack'); expect(questStatus(d.s, q)).toBe('ready');
    const zeni = d.s.zeni, senzu = d.s.inventory.senzu ?? 0, xp = d.s.roster.map((m) => m.level * 1000 + m.xp);
    d.interact('fisher');
    expect(questStatus(d.s, q)).toBe('done'); expect(d.s.zeni).toBe(zeni + 120); expect(d.s.inventory.senzu).toBe(senzu + 1);
    expect(d.s.roster.map((m) => m.level * 1000 + m.xp).some((v, i) => v > xp[i])).toBe(true);
    const after = snapshot(d);
    d.interact('fisher'); d.interact('fisher');
    expect(snapshot(d), 'replaying the turn-in is a no-op').toBe(after);
  });

  it('Medicine for the Elders consumes exactly two Med Kits and only once; without kits it asks for them', () => {
    const d = new StoryDriver({ seed: 2 }); d.interact('ship'); d.enter('shore_scouts'); d.travelTo('village'); d.enter('village_enter');
    d.s.inventory.medkit = 1;                               // not enough yet
    d.interact('village_npc2'); expect(questStatus(d.s, questById('aojan_medicine')!)).toBe('active');
    d.interact('village_npc2'); expect(questStatus(d.s, questById('aojan_medicine')!)).toBe('active'); expect(d.s.inventory.medkit).toBe(1);
    d.s.inventory.medkit = 5;
    d.interact('village_npc2'); expect(questStatus(d.s, questById('aojan_medicine')!)).toBe('done'); expect(d.s.inventory.medkit).toBe(3);
    d.interact('village_npc2'); expect(d.s.inventory.medkit, 'no second payment').toBe(3);
    expect(d.s.inventory.vitalcap).toBe(1);
  });

  it('Frieza’s Logbook only pays the training points once and only after the log was found', () => {
    const d = new StoryDriver({ seed: 2 }); playStory(d, { stopBeforeFrieza: true });
    const unspent = d.s.roster.map((m) => m.unspent);
    d.runScript('guru_talk'); d.runScript('guru_talk'); d.runScript('hold_logbook');
    expect(d.s.roster.map((m) => m.unspent)).toEqual(unspent);
    // a fresh game: Guru does not hand out the reward without the log
    const f = new StoryDriver({ seed: 1 }); f.s.flags.zarbon_done = true; const before = f.s.roster.map((m) => m.unspent);
    f.runScript('guru_talk'); expect(f.s.roster.map((m) => m.unspent)).toEqual(before); expect(f.s.flags[QUEST_DONE('ship_logbook')]).toBeFalsy();
  });

  it('Nail’s Request is offered only while Nail is still at the Sanctuary and closes honestly afterwards', () => {
    const q = questById('nail_hold')!; const s = newGameState();
    expect(questStatus(s, q)).toBe('locked'); s.flags.guru_done = true; expect(questStatus(s, q)).toBe('available');
    s.flags.piccolo_joined = true; expect(questStatus(s, q)).toBe('locked');
    expect(q.missable).toMatch(/Nail then fuses/);
  });

  it('the Ridge Ambush keeps the Alpha 3f flag: an old save with ridge_helped continues the quest', () => {
    const s = newGameState(); s.flags.guru_done = true; s.flags.ridge_helped = true;
    const q = questById('ridge_ambush')!;
    expect(questStatus(s, q)).toBe('active'); s.flags['foe:ridge_foe1'] = true; expect(questStatus(s, q)).toBe('ready');
    const round = validateState(JSON.parse(JSON.stringify(s)));
    expect(round.ok).toBe(true);
  });

  it('every quest reward is repeat-proof: start/complete twice and re-running every present NPC script changes nothing', () => {
    const d = new StoryDriver({ seed: 6 }); playStory(d, { stopBeforeFrieza: true });
    for (const q of QUESTS) expect(d.s.flags[QUEST_DONE(q.id)], q.id).toBe(true);
    const after = snapshot(d);
    for (const q of QUESTS) { expect(startQuest(d.s, q.id)).toBeNull(); expect(completeQuest(d.s, q.id)).toBeNull(); }
    expect(snapshot(d)).toBe(after);
    for (const m of Object.values(MAPS)) for (const e of m.ents) if ((e.kind === 'npc' || e.kind === 'ball') && e.script && condMet(d.s, e.when) && m.id === d.mapId) d.runScript(e.script);
    // scripts attached to NPCs on other maps (the world is not walked here) are checked directly
    for (const id of ['shore_ship', 'shore_fisher', 'village_kid', 'village_elder_story', 'village_shop', 'dende_talk', 'guru_talk', 'nail_talk', 'ridge_hurt', 'hold_logbook']) d.runScript(id);
    expect(snapshot(d), 'replaying NPC scripts must not change Zeni, items, XP, points, combos or flags').toBe(after);
  });

  it('Dragon Ball pickups are idempotent through the real scripts', () => {
    const d = new StoryDriver({ seed: 6 }); playStory(d, { stopBeforeFrieza: true });
    const after = snapshot(d); const toasts = d.toasts.length;
    for (const id of ['ball2_pick', 'ball3_pick', 'ball4_pick', 'ball5_pick', 'ball6_pick']) d.runScript(id);
    expect(snapshot(d)).toBe(after); expect(d.toasts.length, 'no pickup toast on a repeat').toBe(toasts);
  });

  it('quest rewards (XP) can level the party up and announce it', () => {
    const d = new StoryDriver({ seed: 7 }); const g = d.s.roster[0]; g.xp = 0; const lv = g.level;
    completeQuest(d.s, 'camp_bounty');                      // 300 XP at level 5 is a level-up
    expect(g.level).toBeGreaterThan(lv);
    const d2 = new StoryDriver({ seed: 7 }); const fx = completeQuest(d2.s, 'camp_bounty')!;
    expect(fx.toasts.some((t) => /reached Lv/.test(t))).toBe(true); expect(fx.toasts[0]).toMatch(/Quest complete: Bounty on the Patrols/);
  });
});

describe('journal data', () => {
  it('lists only what the player has met, separates statuses and never spoils later chapters', () => {
    const s = newGameState();
    expect(journalQuests(s).filter((x) => x.status !== 'locked')).toHaveLength(0);
    s.flags.scouts1 = true; expect(journalQuests(s).filter((x) => x.status === 'available').map((x) => x.q.id)).toEqual(['shore_net']);
    s.flags.dende_met = true; expect(journalQuests(s).filter((x) => x.status === 'available').map((x) => x.q.id).sort()).toEqual(['aojan_medicine', 'shore_net']);
  });
  it('saves with quest flags round-trip through strict validation and checksums', () => {
    const s = newGameState(); s.flags['q:shore_net'] = true; s.flags['qp:shore_sack'] = true; s.flags['qd:camp_bounty'] = true; s.flags['foe:shore_foe1'] = true;
    const r = deserialize(serialize(s)); expect(r.ok).toBe(true);
    if (r.ok) for (const k of ['q:shore_net', 'qp:shore_sack', 'qd:camp_bounty', 'foe:shore_foe1']) expect(r.state.flags[k], k).toBe(true);
  });
});
