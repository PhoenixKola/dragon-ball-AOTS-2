import { StoryDriver } from './storyDriver';
import { QUEST_DONE } from '../../src/data/quests';

/**
 * The route a thorough player takes through the whole game. Every move is a real walk on the collision grid with the real
 * trigger rules: if a trigger fires that the plan did not ask for, an NPC is unreachable at that point in the story, or an
 * exit is still locked, the driver throws with the exact place.
 * Every segment is guarded by the story flags, so the plan can also RESUME from any loaded save.
 *  - sideQuests: also do all seven side quests (otherwise the bare critical path)
 *  - balls: which optional Dragon Balls to pick up (1 and 2 are part of the story itself; 7 only exists on the last ground)
 */
export type StopAt = 'scouts' | 'village' | 'cui' | 'dodoria' | 'guru' | 'ginyu' | 'frieza' | 'core';
export interface PlanOptions { sideQuests?: boolean; balls?: number[]; stopBeforeFrieza?: boolean; /** stop right after this milestone (used to build legitimate save fixtures for the browser tests) */ stopAt?: StopAt }
const ALL_BALLS = [3, 4, 5, 6, 7];

export function playStory(d: StoryDriver, o: PlanOptions = {}) {
  const side = o.sideQuests ?? true;
  const want = (n: number) => (o.balls ?? ALL_BALLS).includes(n);
  const s = d.s; const f = s.flags;
  const todo = (q: string) => side && !f[QUEST_DONE(q)];
  const stop = (at: StopAt) => o.stopAt === at;

  // ===== Prologue: Azure Shore =====
  if (!f.scouts1) {
    if (d.mapId !== 'shore') d.travelTo('shore');
    d.interact('ship'); d.interact('chest_shore1'); d.interact('chest_shore2'); d.interact('fisher');
    d.enter('shore_scouts');                                       // First Contact (scripted fight)
  }
  if (stop('scouts')) return;
  if (todo('shore_net')) {
    d.travelTo('shore');
    d.interact('fisher'); d.engage('shore_foe1'); d.interact('shore_sack'); d.interact('fisher');
  }

  // ===== Chapter 1: Aojan Village =====
  if (!f.dende_met) {
    d.travelTo('village');
    d.enter('village_enter');                                      // Defend Dende, Dragon Ball 1
  }
  if (!f['chest:chest_vil2']) { d.travelTo('village'); d.interact('dende_npc'); d.interact('chest_vil1'); d.interact('chest_vil2'); d.interact('village_npc1'); d.interact('altar_save'); }
  if (todo('aojan_medicine')) { d.travelTo('village'); d.interact('village_npc2'); d.interact('village_npc2'); }   // offer, then hand over 2 Med Kits
  if (stop('village')) return;

  // ===== Chapter 2: Frieza's landing zone =====
  if (!f.dodoria_done) {
    d.travelTo('landing');
    if (!f.vegeta_arrived) d.enter('landing_vegeta');
    if (!f.cui_done) d.enter('landing_cui');
    if (stop('cui')) return;
    d.interact('chest_land1'); d.interact('landing_altar');
    d.enter('landing_dodoria');
  }
  if (stop('dodoria')) return;
  if (todo('grotto_child') || todo('camp_bounty')) {
    d.travelTo('village');
    if (todo('grotto_child')) d.interact('village_npc1');          // lost-child quest, offered after Dodoria
    if (todo('camp_bounty')) d.interact('village_trader');         // patrol bounty
  }
  if (todo('camp_bounty')) { d.travelTo('landing'); d.engage('landing_foe1'); d.engage('landing_foe2'); }
  if (!f['chest:chest_hold2'] || (want(5) && !f.ball5) || todo('ship_logbook')) {
    d.travelTo('hold');                                            // ship hold: ball 5, lockers, order log
    d.interact('chest_hold1'); d.interact('chest_hold2');
    if (want(5)) d.interact('ball5_pick');
    if (todo('ship_logbook')) d.interact('hold_logbook');
  }
  if (!f.ball2 || todo('grotto_child')) {
    d.travelTo('cave');                                            // Crystal Grotto: ball 2 (story-required: it triggers Zarbon), chests, lost child
    d.interact('chest_cave1'); d.interact('chest_cave2');
    if (todo('grotto_child')) d.interact('cave_child');
    if (!f.ball2) d.interact('ball2_pick');
  }
  if (!f.zarbon_done) {
    d.travelTo('village');
    if (side) { d.interact('village_npc1'); d.interact('village_trader'); }   // turn-ins
    d.enter('village_zarbon');                                     // Zarbon
  } else if (side && (todo('grotto_child') || todo('camp_bounty'))) { d.travelTo('village'); d.interact('village_npc1'); d.interact('village_trader'); }

  // ===== Chapter 3: Guru =====
  if (!f.guru_done) {
    d.travelTo('guru');
    d.enter('guru_trigger');
  }
  if (stop('guru')) return;
  if (!f.piccolo_joined) {
    d.travelTo('guru');
    if (todo('ship_logbook') || f['qp:logbook']) d.interact('guru_npc');   // order log -> reward
    if (todo('nail_hold')) d.interact('nail_npc');                 // Nail's request
    if (want(3) && !f.ball3) d.interact('ball3_pick');
    d.interact('chest_guru'); d.interact('guru_save');
    if (todo('nail_hold') && f['q:nail_hold']) {
      d.travelTo('hold');
      d.engage('hold_foe1'); d.engage('hold_foe2');
      d.travelTo('guru');
      d.interact('nail_npc');                                      // reward
    }
  }

  // ===== Chapter 4: the Ginyu Force =====
  if (!f.ginyu_done) {
    d.travelTo('ridge');
    if (!f.guldo_done) d.enter('ridge_guldo');
    if (todo('ridge_ambush')) { d.interact('hurt_namek'); d.engage('ridge_foe1'); d.interact('hurt_namek'); }
    d.interact('chest_ridge1'); d.interact('ridge_save');
    if (!f.recoome_done) d.enter('ridge_recoome');                 // Goku arrives
    if (!f.duo_done) d.enter('ridge_duo');
    d.enter('ridge_ginyu');
  }
  if (stop('ginyu')) return;
  if (!f.piccolo_joined) {
    d.travelTo('ridge'); d.interact('chest_ridge2');
    if (want(4) && !f.ball4) d.interact('ball4_pick');
    // ===== Chapter 5: the last wish =====
    d.travelTo('guru');
    d.enter('nail_fight_trigger');                                 // Nail vs Frieza, Piccolo fuses, warp to the landing zone
  }
  if (!f.piccolo_joined) throw new Error('Piccolo did not join');
  if (!f.ssj) {
    if (d.mapId !== 'landing') d.travelTo('landing');
    if (want(6) && !f.ball6) d.interact('ball6_pick');
    d.interact('landing_altar');                                   // heal + save before the point of no return
    if (o.stopBeforeFrieza || stop('frieza')) return;
  }
  playFinale(d, o);
}

/** Chapters 6-7 from any state after Piccolo joined (also used to continue from saved games): the point-of-no-return prompts, Frieza, the last ground, the ending. */
export function playFinale(d: StoryDriver, o: PlanOptions = {}) {
  const s = d.s; const want = (n: number) => (o.balls ?? ALL_BALLS).includes(n);
  if (!s.flags.ssj) {
    if (d.mapId !== 'landing') d.travelTo('landing');
    // Frieza's forms. The final-form trigger shares the footprint, so its prompt follows at once: the player steps back first
    // ("Prepare first" returns them to the camp), uses the altar, then commits.
    let prompts = 0;
    d.setAsk((t) => { if (!/final form/.test(t)) return true; prompts++; return prompts > 1; });
    if (!s.flags.frieza3_done) d.enter('landing_frieza', ['landing_frieza4']);
    d.interact('landing_altar');
    if (!s.flags.ssj) d.enter('landing_frieza4');                  // second prompt -> Continue -> Krillin falls, SSJ, warp
    if (!s.flags.ssj) throw new Error('no Super Saiyan after the final form');
  }
  if (o.stopAt === 'core') return;
  // ===== Final chapter =====
  if (d.mapId !== 'core') throw new Error('the last ground expected, found ' + d.mapId);
  d.interact('core_altar');
  if (want(7)) d.interact('ball7_pick');
  d.enter('core_final');                                           // final battle -> epilogue -> ending
  if (!d.ended) throw new Error('the story did not reach the ending');
}
