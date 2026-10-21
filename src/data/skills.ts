import type { SkillDef } from '../types';
import { LIBRARY_SKILLS } from './skillsLibrary';

type Partial_ = Partial<SkillDef> & Pick<SkillDef, 'id' | 'name' | 'desc' | 'clip' | 'vfx'>;

function S(p: Partial_): SkillDef {
  return {
    kind: 'damage', target: 'enemy', element: 'ki', cost: 0, power: 1, hits: [1], rageGain: 8,
    sfx: 'beam', icon: 'attack', unlockLevel: 1, guardable: true, ...p,
  };
}

export const SKILLS: Record<string, SkillDef> = {};
const add = (...list: SkillDef[]) => list.forEach((s) => { SKILLS[s.id] = s; });

// ---------------- Heroes: basic attacks (each fighter moves differently) ----------------
add(
  S({ id: 'atk_gohan', name: 'Attack', desc: 'Punch, punch, kick.', element: 'phys', power: 1, hits: [0.34, 0.32, 0.5], clip: 'gohan_combo', vfx: 'punch', sfx: 'hit', icon: 'attack', rageGain: 7 }),
  S({ id: 'atk_krillin', name: 'Attack', desc: 'A quick one-two strike.', element: 'phys', power: 1, hits: [0.5, 0.55], clip: 'krillin_combo', vfx: 'punch', sfx: 'hit', icon: 'attack', rageGain: 7 }),
  S({ id: 'atk_vegeta', name: 'Attack', desc: 'Elbow, knee, point-blank blast.', element: 'phys', power: 1, hits: [0.3, 0.3, 0.55], clip: 'vegeta_combo', vfx: 'punch', sfx: 'hit', icon: 'attack', rageGain: 7 }),
  S({ id: 'atk_goku', name: 'Attack', desc: 'A four-hit Turtle School flurry.', element: 'phys', power: 1, hits: [0.25, 0.25, 0.25, 0.45], clip: 'goku_combo', vfx: 'punch', sfx: 'hit', icon: 'attack', rageGain: 7 }),
  S({ id: 'atk_piccolo', name: 'Attack', desc: 'A heavy chop and a Ki palm.', element: 'phys', power: 1, hits: [0.45, 0.65], clip: 'piccolo_combo', vfx: 'punch', sfx: 'hit', icon: 'attack', rageGain: 7 }),
  S({ id: 'atk_dende', name: 'Attack', desc: 'A desperate shove.', element: 'phys', power: 0.7, hits: [0.5, 0.5], clip: 'krillin_combo', vfx: 'punch', sfx: 'hit', icon: 'attack', rageGain: 4 }),
  S({ id: 'atk_nail', name: 'Attack', desc: 'A stretching Namekian strike.', element: 'phys', power: 1, hits: [0.5, 0.6], clip: 'piccolo_combo', vfx: 'punch', sfx: 'hit', icon: 'attack', rageGain: 7 }),
);

// ---------------- Gohan ----------------
add(
  S({ id: 'masenko', name: 'Masenko', desc: 'Both hands thrust forward: a golden Ki wave.', cost: 20, power: 2.0, clip: 'masenko', vfx: 'masenko', icon: 'masenko', rageGain: 12 }),
  S({ id: 'dragonkick', name: 'Dragon Kick Barrage', desc: 'Five rapid kicks that wear down defense.', element: 'phys', cost: 16, power: 1.9, hits: [0.2, 0.2, 0.2, 0.2, 0.3], clip: 'gohan_barrage', vfx: 'punch', sfx: 'hit', icon: 'attack', unlockLevel: 8, status: { kind: 'defDown', turns: 2, chance: 0.5, power: 0.15 } }),
  S({ id: 'hiddenpower', name: 'Hidden Power', desc: 'RAGE ART. Gohan unleashes the fury he has been holding back.', element: 'ki', power: 4.1, hits: [0.35, 0.65], clip: 'gohan_rage', vfx: 'masenko', icon: 'power', rageArt: true, rageGain: 0, unlockLevel: 1 }),
);
// ---------------- Krillin ----------------
add(
  S({ id: 'kienzan', unlockLevel: 11, name: 'Destructo Disc', desc: 'A spinning energy disc that slices through armor.', cost: 24, power: 2.4, pierce: 0.4, clip: 'destructo', vfx: 'disc', icon: 'kienzan', rageGain: 12 }),
  S({ id: 'solarflare', name: 'Solar Flare', desc: 'Blind every enemy. Blinded enemies may miss.', kind: 'status', target: 'allEnemies', cost: 14, power: 0, hits: [1], status: { kind: 'blind', turns: 3, chance: 0.85 }, clip: 'solarflare', vfx: 'flare', icon: 'solar', sfx: 'charge', rageGain: 6 }),
  S({ id: 'scatter', name: 'Scatter Bullet', desc: 'Six fast Ki bullets at one target.', cost: 20, power: 1.7, hits: [0.17, 0.17, 0.17, 0.17, 0.17, 0.17], clip: 'krillin_scatter', vfx: 'bullet', icon: 'charge', unlockLevel: 7 }),
  S({ id: 'discstorm', name: 'Twin Disc Storm', desc: 'RAGE ART. Three discs sweep every enemy.', target: 'allEnemies', power: 2.6, hits: [0.5, 0.5, 0.7], clip: 'krillin_discstorm', vfx: 'disc', icon: 'kienzan', rageArt: true, rageGain: 0 }),
);
// ---------------- Vegeta ----------------
add(
  S({ id: 'galick', name: 'Galick Gun', desc: 'A violet wave of pure Saiyan pride.', cost: 32, power: 2.6, clip: 'galick', vfx: 'galick', icon: 'galick', rageGain: 13 }),
  S({ id: 'barrage', unlockLevel: 12, name: 'Ki Barrage', desc: 'Eight rapid-fire Ki blasts.', cost: 18, power: 1.8, hits: [0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13], clip: 'vegeta_barrage', vfx: 'bullet', icon: 'charge', rageGain: 10 }),
  S({ id: 'gallantstrike', name: 'Saiyan Pride', desc: 'Raise Vegeta’s ATK for 3 turns.', kind: 'buff', target: 'self', cost: 14, power: 0, hits: [1], status: { kind: 'atkUp', turns: 3, chance: 1, power: 0.3 }, clip: 'powerup', vfx: 'aura', icon: 'power', sfx: 'charge', unlockLevel: 9, rageGain: 4 }),
  S({ id: 'bigbang', name: 'Big Bang Attack', desc: 'RAGE ART. A blinding sphere of Ki detonates on the foe.', power: 4.3, hits: [0.3, 0.7], clip: 'vegeta_bigbang', vfx: 'bigbang', icon: 'galick', rageArt: true, rageGain: 0 }),
);
// ---------------- Goku ----------------
add(
  S({ id: 'kamehameha', baseOnly: true, name: 'Kamehameha', desc: 'The Turtle School’s signature wave.', cost: 26, power: 2.4, clip: 'kamehameha', vfx: 'kame', icon: 'kamehameha', rageGain: 12 }),
  S({ id: 'kaioken', name: 'Kaioken', desc: 'Sacrifice 12% HP for ×1.4 ATK and +SPD for 3 turns.', kind: 'buff', target: 'self', cost: 10, power: 0, hits: [1], hpCostFrac: 0.12, status: { kind: 'kaioken', turns: 3, chance: 1, power: 0.4 }, clip: 'kaioken', vfx: 'aura_red', icon: 'power', sfx: 'charge', unlockLevel: 3, rageGain: 4 }),
  S({ id: 'kaiokenassault', baseOnly: true, name: 'Kaioken Assault', desc: 'A red-aura rush: four blistering strikes.', element: 'phys', cost: 30, power: 2.9, hits: [0.2, 0.2, 0.3, 0.5, 0.7].map((x) => x * 0.88), clip: 'goku_assault', vfx: 'punch_red', sfx: 'hit', icon: 'power', unlockLevel: 17, rageGain: 14 }),
  S({ id: 'spiritbomb', name: 'Spirit Bomb', desc: 'RAGE ART. Gather the life of Namek and hurl it at every enemy.', target: 'allEnemies', power: 4.4, hits: [1], clip: 'spiritbomb', vfx: 'spiritbomb', icon: 'power', rageArt: true, rageGain: 0 }),
  // Super Saiyan versions
  S({ id: 'ssjkame', name: 'Super Kamehameha', desc: 'A Super Saiyan’s full-power wave.', cost: 40, power: 3.7, clip: 'ssj_kamehameha', vfx: 'kame_ssj', icon: 'kamehameha', rageGain: 14 }),
  S({ id: 'ssjassault', name: 'Golden Assault', desc: 'Faster than the eye can follow: eight strikes.', element: 'phys', cost: 22, power: 3.0, hits: [0.1, 0.1, 0.12, 0.12, 0.14, 0.14, 0.18, 0.3], clip: 'ssj_assault', vfx: 'punch_gold', sfx: 'hit', icon: 'power', rageGain: 14 }),
  S({ id: 'ssjfury', name: 'Legend’s Fury', desc: 'RAGE ART. Goku overwhelms Frieza with golden power.', power: 5.6, hits: [0.2, 0.2, 0.2, 0.4], clip: 'ssj_fury', vfx: 'kame_ssj', icon: 'power', rageArt: true, rageGain: 0 }),
);
// ---------------- Piccolo ----------------
add(
  S({ id: 'specialbeam', name: 'Special Beam Cannon', desc: 'Two fingers charge a spiralling beam that pierces half of DEF.', cost: 38, power: 2.9, pierce: 0.5, clip: 'sbc', vfx: 'sbc', icon: 'specialbeam', rageGain: 13 }),
  S({ id: 'regenerate', name: 'Regeneration', desc: 'Restore 30% of one ally’s max HP.', kind: 'heal', target: 'ally', element: 'ki', cost: 22, power: 0.3, hits: [1], clip: 'heal', vfx: 'heal', icon: 'heal', sfx: 'heal', rageGain: 5, guardable: false }),
  S({ id: 'hellzone', name: 'Hellzone Grenade', desc: 'A sphere of Ki blasts around every enemy.', target: 'allEnemies', cost: 30, power: 1.5, hits: [0.25, 0.25, 0.25, 0.25], clip: 'hellzone', vfx: 'hellzone', icon: 'charge', unlockLevel: 19 }),
  S({ id: 'demonwave', name: 'Explosive Demon Wave', desc: 'RAGE ART. A shattering blast engulfs all foes.', target: 'allEnemies', power: 3.2, clip: 'piccolo_demonwave', vfx: 'demon', icon: 'specialbeam', rageArt: true, rageGain: 0 }),
);
// ---------------- Dende / Nail (guest allies) ----------------
add(
  S({ id: 'healtouch', name: 'Healing Touch', desc: 'Restore 38% of one ally’s max HP.', kind: 'heal', target: 'ally', cost: 18, power: 0.38, clip: 'heal', vfx: 'heal', icon: 'heal', sfx: 'heal', guardable: false }),
  S({ id: 'revitalize', name: 'Revitalize', desc: 'Restore 22% HP to the whole party.', kind: 'heal', target: 'allAllies', cost: 32, power: 0.22, clip: 'heal', vfx: 'heal', icon: 'heal', sfx: 'heal', guardable: false }),
  S({ id: 'namekrevive', name: 'Namekian Rite', desc: 'Revive a fallen ally at 40% HP.', kind: 'revive', target: 'downedAlly', cost: 45, power: 0.4, clip: 'heal', vfx: 'heal', icon: 'senzu', sfx: 'heal', guardable: false }),
  S({ id: 'nailbeam', name: 'Namekian Beam', desc: 'A concentrated Ki beam.', cost: 24, power: 2.2, clip: 'masenko', vfx: 'sbc', icon: 'specialbeam' }),
  S({ id: 'nailstretch', name: 'Stretch Strike', desc: 'RAGE ART. Nail strikes from impossible range.', power: 5.2, hits: [0.5, 0.6], clip: 'piccolo_combo', vfx: 'punch', sfx: 'hit', icon: 'power', rageArt: true, rageGain: 0 }),
  S({ id: 'dendehope', name: 'Dende’s Hope', desc: 'RAGE ART. Fully heal the party’s HP a little.', kind: 'heal', target: 'allAllies', power: 0.5, clip: 'heal', vfx: 'heal', icon: 'heal', sfx: 'heal', rageArt: true, rageGain: 0, guardable: false }),
);

add(...LIBRARY_SKILLS);

// ---------------- Sparking Combos (need >= 2 fighters with 50+ Rage; rewards synchronised hits) ----------------
add(
  S({ id: 'combo_gohan_krillin', name: 'Masenko Disc Rush', desc: 'COMBO · Gohan + Krillin. Disc sets up Masenko.', power: 3.6, hits: [0.5, 0.5, 0.9], target: 'enemy', clip: 'combo_gohan_krillin', vfx: 'masenko', icon: 'combo', rageGain: 0 }),
  S({ id: 'combo_goku_vegeta', name: 'Saiyan Crossfire', desc: 'COMBO · Goku + Vegeta. Rivals strike in perfect sync.', power: 4.4, hits: [0.3, 0.3, 0.4, 0.9], target: 'enemy', clip: 'combo_goku_vegeta', vfx: 'galick', icon: 'combo', rageGain: 0 }),
  S({ id: 'combo_piccolo_gohan', name: 'Master & Pupil Cannon', desc: 'COMBO · Piccolo + Gohan. Special Beam meets Masenko.', power: 4.2, hits: [0.6, 0.8], target: 'enemy', clip: 'combo_piccolo_gohan', vfx: 'sbc', pierce: 0.4, icon: 'combo', rageGain: 0 }),
  S({ id: 'combo_vegeta_krillin', name: 'Disc & Galick', desc: 'COMBO · Vegeta + Krillin. A reluctant team-up.', power: 3.8, hits: [0.5, 0.5, 0.8], target: 'enemy', clip: 'combo_vegeta_krillin', vfx: 'galick', icon: 'combo', rageGain: 0 }),
  S({ id: 'combo_z_trio', name: 'Z-Fighters Triple Strike', desc: 'COMBO · Goku + Gohan + Piccolo. Three generations of power.', target: 'allEnemies', power: 5.0, hits: [0.4, 0.4, 0.9], clip: 'combo_trio', vfx: 'kame_ssj', icon: 'combo', rageGain: 0 }),
);

// ---------------- Enemy skills ----------------
const E = (p: Partial_) => S({ element: 'phys', sfx: 'hit', rageGain: 0, ...p });
add(
  E({ id: 'e_energyshot', name: 'Energy Shot', desc: '', element: 'ki', power: 1.0, clip: 'e_shot', vfx: 'bullet_e', sfx: 'beam' }),
  E({ id: 'e_blasterbarrage', name: 'Blaster Barrage', desc: '', element: 'ki', power: 1.0, hits: [0.4, 0.4, 0.4], clip: 'e_barrage3', vfx: 'bullet_e', sfx: 'beam' }),
  E({ id: 'e_dirtyshot', name: 'Dirty Shot', desc: '', element: 'ki', power: 1.1, clip: 'e_shot', vfx: 'bullet_p', sfx: 'beam' }),
  E({ id: 'e_cuibarrage', name: 'Cui Barrage', desc: '', element: 'ki', power: 1.1, hits: [0.4, 0.4, 0.4], clip: 'e_barrage3', vfx: 'bullet_p', sfx: 'beam' }),
  E({ id: 'e_counterstance', name: 'Counter Stance', desc: 'Cui braces: physical hits will be reflected.', kind: 'buff', target: 'self', power: 0, status: { kind: 'counter', turns: 1, chance: 1, power: 0.4 }, clip: 'e_brace', vfx: 'aura', guardable: false, sfx: 'charge' }),
  E({ id: 'e_machcrush', name: 'Mach Crush', desc: '', power: 2.5, clip: 'e_heavy', vfx: 'punch', chargeTurns: 1 }),
  E({ id: 'e_dodoriabeam', name: 'Dodoria Beam', desc: '', element: 'ki', power: 1.4, pierce: 0.25, clip: 'e_beam', vfx: 'bullet_p', sfx: 'beam' }),
  E({ id: 'e_pummel', name: 'Pummel', desc: '', power: 1.3, hits: [0.6, 0.7], clip: 'e_melee2', vfx: 'punch' }),
  E({ id: 'e_elegantslash', name: 'Elegant Slash', desc: '', power: 1.3, hits: [0.5, 0.5], clip: 'e_melee2', vfx: 'punch' }),
  E({ id: 'e_moonslash', name: 'Moon Slash', desc: '', element: 'ki', power: 1.6, clip: 'e_beam', vfx: 'bullet_g', sfx: 'beam' }),
  E({ id: 'e_brutalrush', name: 'Brutal Rush', desc: '', power: 1.8, hits: [0.25, 0.25, 0.25, 0.4], clip: 'e_melee4', vfx: 'punch' }),
  E({ id: 'e_monstercrush', name: 'Monster Crush', desc: '', power: 2.8, clip: 'e_heavy', vfx: 'punch', chargeTurns: 1 }),
  E({ id: 'e_timefreezeprep', name: 'Time Freeze', desc: 'Guldo concentrates. Hit him hard to break the spell!', kind: 'special', target: 'allEnemies', power: 0, status: { kind: 'frozen', turns: 2, chance: 1 }, clip: 'e_freeze', vfx: 'freeze', chargeTurns: 1, guardable: false, sfx: 'charge' }),
  E({ id: 'e_psychicthrow', name: 'Psychic Throw', desc: '', element: 'ki', power: 1.2, clip: 'e_shot', vfx: 'freeze', status: { kind: 'seal', turns: 2, chance: 0.5 }, sfx: 'beam' }),
  E({ id: 'e_recoomekick', name: 'Recoome Kick', desc: '', power: 1.5, hits: [0.5, 0.5, 0.6], clip: 'e_melee3', vfx: 'punch' }),
  E({ id: 'e_recoomebomber', name: 'Recoome Bomber', desc: '', power: 2.0, clip: 'e_heavy', vfx: 'punch' }),
  E({ id: 'e_eraser', name: 'Eraser Gun', desc: '', element: 'ki', power: 3.2, clip: 'e_beam_big', vfx: 'eraser', chargeTurns: 1, sfx: 'beam' }),
  E({ id: 'e_bluehurricane', name: 'Blue Hurricane', desc: '', target: 'allEnemies', power: 1.0, hits: [0.35, 0.35, 0.35], clip: 'e_rush_all', vfx: 'punch' }),
  E({ id: 'e_speedrush', name: 'Speed Rush', desc: '', power: 1.5, hits: [0.2, 0.2, 0.2, 0.2, 0.3], clip: 'e_melee5', vfx: 'punch' }),
  E({ id: 'e_pincer', name: 'Ginyu Pincer', desc: 'Burter and Jeice attack together.', target: 'allEnemies', power: 1.7, hits: [0.6, 0.8], clip: 'e_pincer', vfx: 'punch' }),
  E({ id: 'e_crusherball', name: 'Crusher Ball', desc: '', element: 'ki', power: 2.7, clip: 'e_beam_big', vfx: 'crusher', chargeTurns: 1, sfx: 'beam' }),
  E({ id: 'e_burningattack', name: 'Burning Attack', desc: '', element: 'ki', power: 1.4, clip: 'e_shot', vfx: 'bullet_r', sfx: 'beam' }),
  E({ id: 'e_milkycannon', name: 'Milky Cannon', desc: '', element: 'ki', power: 2.0, clip: 'e_beam', vfx: 'bullet_p', sfx: 'beam' }),
  E({ id: 'e_ginyupunch', name: 'Ginyu Barrage', desc: '', power: 1.5, hits: [0.5, 0.5, 0.6], clip: 'e_melee3', vfx: 'punch' }),
  E({ id: 'e_bodychange', name: 'Body Change', desc: 'Ginyu seizes the strongest fighter’s body!', kind: 'special', target: 'enemy', power: 0, status: { kind: 'possessed', turns: 3, chance: 1 }, clip: 'e_bodychange', vfx: 'bodychange', guardable: false, sfx: 'charge' }),
  E({ id: 'e_deathbeam', name: 'Death Beam', desc: '', element: 'ki', power: 1.9, pierce: 0.35, clip: 'e_deathbeam', vfx: 'deathbeam', sfx: 'beam' }),
  E({ id: 'e_tailwhip', name: 'Tail Whip', desc: '', power: 1.3, hits: [0.5, 0.6], clip: 'e_melee2', vfx: 'punch' }),
  E({ id: 'e_hornCharge', name: 'Horn Charge', desc: '', power: 1.9, hits: [0.3, 0.3, 0.5], clip: 'e_melee3', vfx: 'punch' }),
  E({ id: 'e_supernova', name: 'Supernova Spark', desc: '', target: 'allEnemies', element: 'ki', power: 1.4, clip: 'e_beam_all', vfx: 'eraser', sfx: 'beam' }),
  E({ id: 'e_deathstorm', name: 'Death Storm', desc: '', target: 'allEnemies', element: 'ki', power: 1.1, hits: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2], clip: 'e_storm', vfx: 'deathbeam', sfx: 'beam' }),
  E({ id: 'e_tailLash', name: 'Tail Lash', desc: '', power: 1.6, hits: [0.4, 0.4, 0.6], clip: 'e_melee3', vfx: 'punch' }),
  E({ id: 'e_deathwave', name: 'Death Wave', desc: '', target: 'allEnemies', element: 'ki', power: 1.9, clip: 'e_beam_all', vfx: 'deathbeam', sfx: 'beam' }),
  E({ id: 'e_deathslicer', name: 'Death Slicer', desc: '', element: 'ki', power: 2.2, pierce: 0.4, clip: 'e_beam', vfx: 'disc', sfx: 'beam' }),
  E({ id: 'e_finalbarrage', name: 'Death Beam Volley', desc: '', element: 'ki', power: 1.6, hits: [0.17, 0.17, 0.17, 0.17, 0.17, 0.17, 0.17], clip: 'e_volley', vfx: 'deathbeam', sfx: 'beam' }),
  E({ id: 'e_deathball', name: 'Death Ball', desc: 'Frieza gathers a planet-killing sphere. Interrupt him or brace!', target: 'allEnemies', element: 'ki', power: 3.4, clip: 'e_deathball', vfx: 'deathball', chargeTurns: 2, sfx: 'beam' }),
  // ---- Postgame: Frost Guards and Cooler ----
  E({ id: 'e_froststrike', name: 'Frost Strike', desc: '', power: 1.4, hits: [0.5, 0.5], clip: 'e_melee2', vfx: 'punch' }),
  E({ id: 'e_iceslam', name: 'Ice Slam', desc: '', power: 2.3, clip: 'e_heavy', vfx: 'punch', chargeTurns: 1 }),
  E({ id: 'e_coolertail', name: 'Tail Lash', desc: '', power: 1.55, hits: [0.4, 0.4, 0.6], clip: 'e_melee3', vfx: 'punch' }),
  E({ id: 'e_coolerbeam', name: 'Frost Beam', desc: '', element: 'ki', power: 2.1, pierce: 0.3, clip: 'e_beam', vfx: 'bullet_p', sfx: 'beam' }),
  E({ id: 'e_coolerbarrage', name: 'Cold Barrage', desc: '', element: 'ki', power: 1.7, hits: [0.17, 0.17, 0.17, 0.17, 0.17, 0.17, 0.17], clip: 'e_volley', vfx: 'deathbeam', sfx: 'beam' }),
  E({ id: 'e_coolerchill', name: 'Chill Aura', desc: 'Cooler’s aura saps the party: every ally’s ATK falls for 3 turns.', kind: 'status', target: 'allEnemies', power: 0, status: { kind: 'atkDown', turns: 3, chance: 1, power: 0.2 }, clip: 'e_freeze', vfx: 'freeze', guardable: false, sfx: 'charge' }),
  E({ id: 'e_frostarmor', name: 'Frost Armor', desc: 'Cooler hardens his armour: physical hits will be reflected. Use Ki techniques!', kind: 'buff', target: 'self', power: 0, status: { kind: 'counter', turns: 1, chance: 1, power: 0.5 }, clip: 'e_brace', vfx: 'aura', guardable: false, sfx: 'charge' }),
  E({ id: 'e_coolernova', name: 'Supernova Cascade', desc: 'Cooler gathers a wide blast. Hit him hard to interrupt it, or Active Guard!', target: 'allEnemies', element: 'ki', power: 2.0, hits: [1], clip: 'e_beam_all', vfx: 'eraser', chargeTurns: 1, sfx: 'beam' }),
  E({ id: 'e_coolerbomb', name: 'Supernova Bomb', desc: 'Cooler raises a star of ice and fire. Interrupt him with a heavy blow or perfect-guard it!', target: 'allEnemies', element: 'ki', power: 3.6, clip: 'e_deathball', vfx: 'deathball', chargeTurns: 2, sfx: 'beam' }),
  E({ id: 'e_tauntingflick', name: 'Casual Flick', desc: '', power: 1.1, clip: 'e_melee1', vfx: 'punch' }),
);
