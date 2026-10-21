import type { SkillDef } from '../types';

// Learnable library (v5): every hero learns 8-12 specials and equips four (see systems/party.ts).
// role = the loadout label. Clips are the generated families in engine/animation/clips.ts:
//   hmelee_N (dash + N strikes) · hbeam_<vfx> (quick beam) · hbeamH_<vfx> (charged beam) · hwave_<vfx> (one blast that hits every foe)
//   hvol_N_<vfx> (N-shot volley) · hbrace (guard stance with aura) · hshock (shockwave from the body)
type P = Partial<SkillDef> & Pick<SkillDef, 'id' | 'name' | 'desc' | 'clip' | 'vfx'>;
/** skill id -> the generated clip family it is built from. Every library skill gets its OWN clip id (a registered copy of the family), so clips stay one-per-move. */
export const LIBRARY_CLIP_FAMILY: Record<string, string> = {};
const L = (role: string, p: P): SkillDef => {
  LIBRARY_CLIP_FAMILY[p.id] = p.clip;
  return { kind: 'damage', target: 'enemy', element: 'ki', cost: 0, power: 1, hits: [1], rageGain: 8, sfx: 'beam', icon: 'attack', unlockLevel: 1, guardable: true, role, ...p, clip: p.id };
};

export const LIBRARY_SKILLS: SkillDef[] = [
  // ---- Gohan
  L('Barrage', { id: 'wildfury', name: 'Wild Fury', desc: 'Four wild punches. Cheap and quick.', element: 'phys', cost: 10, power: 1.5, hits: [0.2, 0.2, 0.2, 0.25], clip: 'hmelee_4', vfx: 'punch', sfx: 'hit', unlockLevel: 3 }),
  L('Buff', { id: 'potentialguard', name: 'Potential Guard', desc: 'Raise Gohan’s DEF by 40% for 3 turns.', kind: 'buff', target: 'self', cost: 12, power: 0, status: { kind: 'defUp', turns: 3, chance: 1, power: 0.4 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 5, rageGain: 4 }),
  L('Debuff', { id: 'stunstrike', name: 'Stunning Blow', desc: 'A heavy elbow that may stun (never bosses).', element: 'phys', cost: 14, power: 1.4, hits: [0.6], status: { kind: 'stun', turns: 1, chance: 0.5 }, clip: 'hmelee_1', vfx: 'punch', sfx: 'hit', unlockLevel: 6 }),
  L('Area', { id: 'kishout', name: 'Ki Shout', desc: 'A shockwave that hits every foe and may weaken their attack.', target: 'allEnemies', cost: 24, power: 1.25, status: { kind: 'atkDown', turns: 2, chance: 0.5, power: 0.2 }, clip: 'hshock', vfx: 'flare', unlockLevel: 10, rageGain: 10 }),
  L('Counter', { id: 'parrystance', name: 'Parry Stance', desc: 'Counter stance for 2 turns: physical hits are reflected.', kind: 'buff', target: 'self', cost: 14, power: 0, status: { kind: 'counter', turns: 2, chance: 1, power: 0.5 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 12, rageGain: 4 }),
  L('Finisher', { id: 'angerstrike', name: 'Anger Strike', desc: 'Two crushing blows that ignore a quarter of DEF.', element: 'phys', cost: 28, power: 3.0, pierce: 0.25, hits: [0.4, 0.7], clip: 'hmelee_2', vfx: 'punch', sfx: 'hit', unlockLevel: 14, rageGain: 12 }),
  L('Beam', { id: 'twinmasenko', name: 'Twin Masenko', desc: 'Two Masenko waves in a row.', cost: 34, power: 3.1, hits: [0.5, 0.6], clip: 'hvol_2_masenko', vfx: 'masenko', unlockLevel: 18, rageGain: 14 }),
  L('Support', { id: 'rallycry', name: 'Rally Cry', desc: 'Raise the whole party’s ATK by 20% for 3 turns.', kind: 'buff', target: 'allAllies', cost: 26, power: 0, status: { kind: 'atkUp', turns: 3, chance: 1, power: 0.2 }, clip: 'powerup', vfx: 'aura', sfx: 'charge', unlockLevel: 20, rageGain: 6 }),
  L('Finisher', { id: 'maxpotential', name: 'Maximum Potential', desc: 'Everything Gohan has, in two blasts.', cost: 48, power: 4.2, hits: [0.35, 0.65], clip: 'hvol_2_masenko', vfx: 'masenko', unlockLevel: 27, postgame: true, rageGain: 16 }),
  // ---- Krillin
  L('Barrage', { id: 'quickjab', name: 'Quick Jab', desc: 'A fast one-two for almost no Ki.', element: 'phys', cost: 6, power: 1.2, hits: [0.5, 0.5], clip: 'hmelee_2', vfx: 'punch', sfx: 'hit', unlockLevel: 2 }),
  L('Beam', { id: 'focusbeam', name: 'Focus Beam', desc: 'A thin, cheap Ki beam.', cost: 12, power: 1.5, clip: 'hbeam_masenko', vfx: 'masenko', unlockLevel: 4 }),
  L('Heal', { id: 'firstaid', name: 'First Aid', desc: 'Restore 26% of one ally’s max HP.', kind: 'heal', target: 'ally', cost: 16, power: 0.26, clip: 'heal', vfx: 'heal', sfx: 'heal', guardable: false, unlockLevel: 5, rageGain: 5 }),
  L('Support', { id: 'quickstep', name: 'Quick Step', desc: 'Raise the whole party’s SPD for 3 turns.', kind: 'buff', target: 'allAllies', cost: 20, power: 0, status: { kind: 'spdUp', turns: 3, chance: 1, power: 0.3 }, clip: 'powerup', vfx: 'aura', sfx: 'charge', unlockLevel: 8, rageGain: 5 }),
  L('Debuff', { id: 'distraction', name: 'Distraction', desc: 'Lower every foe’s ATK by 25% for 2 turns.', kind: 'status', target: 'allEnemies', cost: 16, power: 0, status: { kind: 'atkDown', turns: 2, chance: 0.9, power: 0.25 }, clip: 'hshock', vfx: 'flare', sfx: 'charge', unlockLevel: 9, rageGain: 6 }),
  L('Debuff', { id: 'hushbeam', name: 'Hush Beam', desc: 'A beam that seals the foe’s Ki techniques for 2 turns.', cost: 18, power: 0.8, status: { kind: 'seal', turns: 2, chance: 0.75 }, clip: 'hbeam_sbc', vfx: 'sbc', unlockLevel: 13 }),
  L('Barrage', { id: 'discvolley', name: 'Disc Volley', desc: 'Three Destructo Discs that slice through armor.', cost: 34, power: 2.6, pierce: 0.3, hits: [0.3, 0.3, 0.3], clip: 'hvol_3_disc', vfx: 'disc', unlockLevel: 15, rageGain: 12 }),
  L('Counter', { id: 'afterimage', name: 'Afterimage', desc: 'Counter stance for 2 turns.', kind: 'buff', target: 'self', cost: 16, power: 0, status: { kind: 'counter', turns: 2, chance: 1, power: 0.45 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 17, rageGain: 4 }),
  L('Finisher', { id: 'laststand', name: 'Last Stand', desc: 'All of Krillin’s Ki in one piercing disc.', cost: 44, power: 4.0, pierce: 0.4, clip: 'hbeamH_disc', vfx: 'disc', unlockLevel: 24, postgame: true, rageGain: 16 }),
  // ---- Vegeta
  L('Barrage', { id: 'saiyansmash', name: 'Saiyan Smash', desc: 'Elbow and knee.', element: 'phys', cost: 8, power: 1.5, hits: [0.4, 0.5], clip: 'hmelee_2', vfx: 'punch', sfx: 'hit', unlockLevel: 2 }),
  L('Beam', { id: 'pointblank', name: 'Point-Blank Blast', desc: 'A quick violet blast.', cost: 14, power: 1.8, clip: 'hbeam_galick', vfx: 'galick', unlockLevel: 4 }),
  L('Buff', { id: 'battlefury', name: 'Battle Fury', desc: 'Raise Vegeta’s ATK by 35% for 2 turns.', kind: 'buff', target: 'self', cost: 10, power: 0, status: { kind: 'atkUp', turns: 2, chance: 1, power: 0.35 }, clip: 'powerup', vfx: 'aura', sfx: 'charge', unlockLevel: 6, rageGain: 4 }),
  L('Debuff', { id: 'menace', name: 'Menace', desc: 'Vegeta glares: every foe’s ATK falls 20% for 3 turns.', kind: 'status', target: 'allEnemies', cost: 18, power: 0, status: { kind: 'atkDown', turns: 3, chance: 0.9, power: 0.2 }, clip: 'hshock', vfx: 'flare', sfx: 'charge', unlockLevel: 8, rageGain: 6 }),
  L('Barrage', { id: 'crusherkick', name: 'Crusher Kick', desc: 'Three heavy kicks that pierce a third of DEF.', element: 'phys', cost: 24, power: 2.6, pierce: 0.3, hits: [0.3, 0.3, 0.5], clip: 'hmelee_3', vfx: 'punch', sfx: 'hit', unlockLevel: 14, rageGain: 12 }),
  L('Area', { id: 'finishingbuster', name: 'Finishing Buster', desc: 'A violet wave that sweeps every foe.', target: 'allEnemies', cost: 34, power: 1.8, clip: 'hwave_galick', vfx: 'galick', unlockLevel: 16, rageGain: 12 }),
  L('Buff', { id: 'royalguard', name: 'Royal Guard', desc: 'Raise Vegeta’s DEF by 45% for 3 turns.', kind: 'buff', target: 'self', cost: 14, power: 0, status: { kind: 'defUp', turns: 3, chance: 1, power: 0.45 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 18, rageGain: 4 }),
  L('Finisher', { id: 'finalflash', name: 'Final Flash', desc: 'A twin burst of pure Saiyan pride.', cost: 52, power: 4.5, hits: [0.4, 0.6], clip: 'hvol_2_galick', vfx: 'galick', unlockLevel: 26, postgame: true, rageGain: 16 }),
  // ---- Goku
  L('Barrage', { id: 'dragonfist', name: 'Dragon Fist', desc: 'Three Turtle School strikes.', element: 'phys', cost: 14, power: 1.9, hits: [0.3, 0.3, 0.4], clip: 'hmelee_3', vfx: 'punch', sfx: 'hit', unlockLevel: 4 }),
  L('Beam', { id: 'kiblast', name: 'Ki Blast', desc: 'A quick, cheap Ki blast.', cost: 10, power: 1.4, clip: 'hbeam_kame', vfx: 'kame', unlockLevel: 6 }),
  L('Debuff', { id: 'backhand', name: 'Backhand Smash', desc: 'A heavy backhand that may stun (never bosses).', element: 'phys', cost: 14, power: 1.5, hits: [0.6], status: { kind: 'stun', turns: 1, chance: 0.4 }, clip: 'hmelee_1', vfx: 'punch', sfx: 'hit', unlockLevel: 7 }),
  L('Barrage', { id: 'instantstrike', name: 'Instant Strike', desc: 'Vanish and strike twice, ignoring 40% of DEF.', element: 'phys', cost: 12, power: 1.7, pierce: 0.4, hits: [0.3, 0.4], clip: 'hmelee_2', vfx: 'punch', sfx: 'hit', unlockLevel: 9 }),
  L('Heal', { id: 'kitransfer', name: 'Ki Transfer', desc: 'Give an ally 30% of their max HP.', kind: 'heal', target: 'ally', cost: 20, power: 0.3, clip: 'heal', vfx: 'heal', sfx: 'heal', guardable: false, unlockLevel: 10, rageGain: 5 }),
  L('Counter', { id: 'turtlestance', name: 'Turtle Stance', desc: 'Counter stance for 2 turns.', kind: 'buff', target: 'self', cost: 14, power: 0, status: { kind: 'counter', turns: 2, chance: 1, power: 0.45 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 11, rageGain: 4 }),
  L('Barrage', { id: 'meteorcombo', name: 'Meteor Combination', desc: 'Six rapid strikes.', element: 'phys', cost: 26, power: 2.6, hits: [0.15, 0.15, 0.15, 0.15, 0.15, 0.25], clip: 'hmelee_6', vfx: 'punch', sfx: 'hit', unlockLevel: 14, rageGain: 12 }),
  L('Support', { id: 'kisurge', name: 'Ki Surge', desc: 'The whole party regenerates for 3 turns.', kind: 'buff', target: 'allAllies', cost: 30, power: 0, status: { kind: 'regen', turns: 3, chance: 1, power: 0.06 }, clip: 'powerup', vfx: 'heal', sfx: 'heal', unlockLevel: 16, rageGain: 6 }),
  L('Finisher', { id: 'kaiokenkame', name: 'Kaioken Kamehameha', desc: 'A red-gold wave that costs 8% HP.', cost: 40, power: 3.4, hpCostFrac: 0.08, clip: 'hbeamH_kame', vfx: 'kame', baseOnly: true, unlockLevel: 25, postgame: true, rageGain: 15 }),
  // ---- Piccolo
  L('Barrage', { id: 'stretchpunch', name: 'Stretch Punch', desc: 'An arm that reaches across the field.', element: 'phys', cost: 8, power: 1.6, hits: [0.8], clip: 'hmelee_1', vfx: 'punch', sfx: 'hit', unlockLevel: 2 }),
  L('Area', { id: 'lightgrenade', name: 'Light Grenade', desc: 'A bright orb that bursts over every foe.', target: 'allEnemies', cost: 20, power: 1.2, clip: 'hwave_sbc', vfx: 'sbc', unlockLevel: 4, rageGain: 10 }),
  L('Barrage', { id: 'multiform', name: 'Multi-Form Assault', desc: 'Five clones strike at once.', element: 'phys', cost: 22, power: 1.8, hits: [0.15, 0.15, 0.15, 0.15, 0.25], clip: 'hmelee_5', vfx: 'punch', sfx: 'hit', unlockLevel: 6 }),
  L('Buff', { id: 'castoffweights', name: 'Cast Off Weights', desc: 'Raise Piccolo’s ATK by 30% for 3 turns.', kind: 'buff', target: 'self', cost: 12, power: 0, status: { kind: 'atkUp', turns: 3, chance: 1, power: 0.3 }, clip: 'powerup', vfx: 'aura', sfx: 'charge', unlockLevel: 8, rageGain: 4 }),
  L('Support', { id: 'allycover', name: 'Ally Cover', desc: 'Raise one ally’s DEF by 40% for 3 turns.', kind: 'buff', target: 'ally', cost: 16, power: 0, status: { kind: 'defUp', turns: 3, chance: 1, power: 0.4 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 10, rageGain: 5 }),
  L('Beam', { id: 'eyelaser', name: 'Eye Laser', desc: 'A needle of light that ignores 40% of DEF.', cost: 14, power: 1.6, pierce: 0.4, clip: 'hbeam_sbc', vfx: 'sbc', unlockLevel: 12 }),
  L('Support', { id: 'namekrenewal', name: 'Namekian Renewal', desc: 'The whole party regenerates for 4 turns.', kind: 'buff', target: 'allAllies', cost: 30, power: 0, status: { kind: 'regen', turns: 4, chance: 1, power: 0.06 }, clip: 'heal', vfx: 'heal', sfx: 'heal', guardable: false, unlockLevel: 15, rageGain: 6 }),
  L('Barrage', { id: 'demonbarrage', name: 'Demon Barrage', desc: 'Three piercing bursts.', cost: 40, power: 3.0, hits: [0.3, 0.3, 0.4], clip: 'hvol_3_sbc', vfx: 'sbc', unlockLevel: 23, postgame: true, rageGain: 14 }),
  L('Finisher', { id: 'maxsbc', name: 'Maximum Special Beam', desc: 'A spiralling beam that ignores 60% of DEF.', cost: 56, power: 4.4, pierce: 0.6, clip: 'hbeamH_sbc', vfx: 'sbc', unlockLevel: 26, postgame: true, rageGain: 16 }),
  // ---- Dende (guest)
  L('Support', { id: 'protectivechant', name: 'Protective Chant', desc: 'Raise the whole party’s DEF by 25% for 3 turns.', kind: 'buff', target: 'allAllies', cost: 26, power: 0, status: { kind: 'defUp', turns: 3, chance: 1, power: 0.25 }, clip: 'heal', vfx: 'heal', sfx: 'heal', guardable: false, unlockLevel: 1, rageGain: 5 }),
  L('Buff', { id: 'inspire', name: 'Inspire', desc: 'Raise one ally’s ATK by 30% for 3 turns.', kind: 'buff', target: 'ally', cost: 14, power: 0, status: { kind: 'atkUp', turns: 3, chance: 1, power: 0.3 }, clip: 'heal', vfx: 'heal', sfx: 'heal', guardable: false, unlockLevel: 1, rageGain: 4 }),
  // ---- Nail (guest)
  L('Barrage', { id: 'bladehand', name: 'Blade Hand', desc: 'Three slashing hand strikes.', element: 'phys', cost: 12, power: 1.7, hits: [0.3, 0.3, 0.4], clip: 'hmelee_3', vfx: 'punch', sfx: 'hit', unlockLevel: 1 }),
  L('Counter', { id: 'stretchblock', name: 'Stretch Block', desc: 'Counter stance for 2 turns.', kind: 'buff', target: 'self', cost: 10, power: 0, status: { kind: 'counter', turns: 2, chance: 1, power: 0.45 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 1, rageGain: 4 }),
  L('Finisher', { id: 'piercingthrust', name: 'Piercing Thrust', desc: 'A spear-hand that ignores half of DEF.', element: 'phys', cost: 22, power: 2.4, pierce: 0.5, hits: [0.7], clip: 'hmelee_1', vfx: 'punch', sfx: 'hit', unlockLevel: 8, rageGain: 12 }),
  L('Support', { id: 'warriorsrite', name: 'Warrior’s Rite', desc: 'Raise the whole party’s ATK by 20% for 3 turns.', kind: 'buff', target: 'allAllies', cost: 26, power: 0, status: { kind: 'atkUp', turns: 3, chance: 1, power: 0.2 }, clip: 'powerup', vfx: 'aura', sfx: 'charge', unlockLevel: 12, rageGain: 6 }),

  // ---- Future Trunks (secret postgame ally; Porunga wish 1). ssjOnly skills are equippable anywhere but usable only in Super Saiyan.
  L('Barrage', { id: 'swordrush', name: 'Sword Rush', desc: 'A dash and three quick sword cuts.', element: 'phys', cost: 12, power: 1.9, hits: [0.3, 0.3, 0.4], clip: 'hmelee_3', vfx: 'punch', sfx: 'hit', unlockLevel: 1, rageGain: 9 }),
  L('Beam', { id: 'burningattack', name: 'Burning Attack', desc: 'A golden palm blast fired point blank.', cost: 24, power: 2.5, clip: 'hbeamH_masenko', vfx: 'masenko', unlockLevel: 1, rageGain: 12 }),
  L('Finisher', { id: 'finishbuster', name: 'Finish Buster', desc: 'A violet blast that pierces a third of DEF.', cost: 36, power: 3.2, pierce: 0.35, clip: 'hbeamH_galick', vfx: 'galick', unlockLevel: 1, rageGain: 14 }),
  L('Buff', { id: 'kibarrier', name: 'Ki Barrier', desc: 'Raise Trunks’ DEF by 45% for 3 turns.', kind: 'buff', target: 'self', cost: 14, power: 0, status: { kind: 'defUp', turns: 3, chance: 1, power: 0.45 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 1, rageGain: 4 }),
  L('Counter', { id: 'phantomstep', name: 'Phantom Step', desc: 'Counter stance for 2 turns: a blurred step returns physical hits.', kind: 'buff', target: 'self', cost: 14, power: 0, status: { kind: 'counter', turns: 2, chance: 1, power: 0.5 }, clip: 'hbrace', vfx: 'aura', sfx: 'charge', unlockLevel: 4, rageGain: 4 }),
  L('Heal', { id: 'fieldmedicine', name: 'Field Medicine', desc: 'Restore 30% of one ally’s max HP with a Capsule Corp pill.', kind: 'heal', target: 'ally', cost: 18, power: 0.3, clip: 'heal', vfx: 'heal', sfx: 'heal', guardable: false, unlockLevel: 6, rageGain: 5 }),
  L('Support', { id: 'resolve', name: 'Resolve', desc: 'Raise the whole party’s ATK by 20% for 3 turns.', kind: 'buff', target: 'allAllies', cost: 26, power: 0, status: { kind: 'atkUp', turns: 3, chance: 1, power: 0.2 }, clip: 'powerup', vfx: 'aura', sfx: 'charge', unlockLevel: 10, rageGain: 6 }),
  L('Debuff', { id: 'chronoslash', name: 'Chrono Slash', desc: 'A slash that may stun (never bosses).', element: 'phys', cost: 18, power: 1.8, hits: [0.7], status: { kind: 'stun', turns: 1, chance: 0.4 }, clip: 'hmelee_1', vfx: 'punch', sfx: 'hit', unlockLevel: 14 }),
  L('Barrage', { id: 'crossingslash', name: 'Crossing Slash', desc: 'Two crossing cuts that ignore 30% of DEF.', element: 'phys', cost: 26, power: 2.7, pierce: 0.3, hits: [0.45, 0.55], clip: 'hmelee_2', vfx: 'punch', sfx: 'hit', unlockLevel: 18, rageGain: 12 }),
  L('Finisher', { id: 'ssjburning', name: 'Super Burning Attack', desc: 'SUPER SAIYAN ONLY. A blazing golden blast.', cost: 34, power: 3.7, clip: 'hbeamH_masenko', vfx: 'masenko', ssjOnly: true, unlockLevel: 20, rageGain: 14 }),
  L('Barrage', { id: 'ssjslashrush', name: 'Golden Slash Rush', desc: 'SUPER SAIYAN ONLY. Six golden cuts.', element: 'phys', cost: 30, power: 3.1, hits: [0.15, 0.15, 0.15, 0.15, 0.15, 0.25], clip: 'hmelee_6', vfx: 'punch', sfx: 'hit', ssjOnly: true, unlockLevel: 24, rageGain: 14 }),
  L('Finisher', { id: 'ssjbuster', name: 'Super Finish Buster', desc: 'SUPER SAIYAN ONLY. A huge piercing blast.', cost: 48, power: 4.6, pierce: 0.4, clip: 'hbeamH_galick', vfx: 'galick', ssjOnly: true, postgame: true, unlockLevel: 27, rageGain: 16 }),
  // Always available (no slot): the transformation and the Rage Art
  L('Transform', { id: 'ssjtrunks', name: 'Super Saiyan', desc: 'Go Super Saiyan for the rest of the battle: ATK +30%, DEF +15%, SPD +20%, unlocks Super Saiyan skills. Drains 5% max Ki each turn; ends if Ki runs out.', kind: 'buff', target: 'self', cost: 24, power: 0, status: { kind: 'ssjform', turns: 99, chance: 1 }, clip: 'ssjtrunks_fx', vfx: 'aura', sfx: 'charge', unlockLevel: 1, rageGain: 6 }),
  L('Rage Art', { id: 'swordstorm', name: 'Future Slash Storm', desc: 'RAGE ART. A storm of five sword cuts and a final burst.', element: 'phys', power: 4.4, hits: [0.15, 0.15, 0.2, 0.2, 0.55], clip: 'hmelee_5', vfx: 'punch', sfx: 'hit', rageArt: true, rageGain: 0, unlockLevel: 1 }),
  L('Attack', { id: 'atk_trunks', name: 'Attack', desc: 'A sword cut and a point-blank blast.', element: 'phys', power: 1, hits: [0.4, 0.55], clip: 'krillin_combo', vfx: 'punch', sfx: 'hit', rageGain: 7 }),
];
