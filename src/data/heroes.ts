import type { HeroDef, HeroId, ItemDef } from '../types';

export const HEROES: Record<HeroId, HeroDef> = {
  trunks: {
    signature: 4, id: 'trunks', name: 'Trunks', portrait: 'trunks', sprite: 'trunks', color: '#9a8cf0', role: 'Sword and Ki, Super Saiyan (secret ally)',
    base: { hp: 290, ki: 130, atk: 48, def: 20, spd: 28 }, growth: { hp: 26, ki: 10, atk: 4.1, def: 1.7, spd: 0.9 },
    skills: ['swordrush', 'burningattack', 'finishbuster', 'kibarrier', 'phantomstep', 'fieldmedicine', 'resolve', 'chronoslash', 'crossingslash', 'ssjburning', 'ssjslashrush', 'ssjbuster'],
    extra: ['ssjtrunks'], rageArt: 'swordstorm', attackClip: 'vegeta_combo', heightPx: 140,
  },
  gohan: {
    signature: 2, id: 'gohan', name: 'Gohan', portrait: 'gohan', sprite: 'gohan', color: '#c9a7f3', role: 'Hidden power, Ki waves',
    base: { hp: 210, ki: 88, atk: 33, def: 14, spd: 19 }, growth: { hp: 23, ki: 9, atk: 3.6, def: 1.4, spd: 0.7 },
    skills: ['masenko', 'dragonkick', 'wildfury', 'potentialguard', 'stunstrike', 'kishout', 'parrystance', 'angerstrike', 'twinmasenko', 'rallycry', 'maxpotential'], rageArt: 'hiddenpower', attackClip: 'gohan_combo', heightPx: 108,
  },
  krillin: {
    signature: 3, id: 'krillin', name: 'Krillin', portrait: 'krillin', sprite: 'krillin', color: '#f4b46d', role: 'Speed, utility, blind',
    base: { hp: 180, ki: 108, atk: 29, def: 14, spd: 26 }, growth: { hp: 20, ki: 10, atk: 2.9, def: 1.5, spd: 1.0 },
    skills: ['kienzan', 'solarflare', 'scatter', 'quickjab', 'focusbeam', 'firstaid', 'quickstep', 'distraction', 'hushbeam', 'discvolley', 'afterimage', 'laststand'], rageArt: 'discstorm', attackClip: 'krillin_combo', heightPx: 120,
  },
  vegeta: {
    signature: 3, id: 'vegeta', name: 'Vegeta', portrait: 'vegeta', sprite: 'vegeta', color: '#b6c8f2', role: 'Raw power, barrage',
    base: { hp: 260, ki: 112, atk: 45, def: 19, spd: 24 }, growth: { hp: 25, ki: 10, atk: 4.0, def: 1.7, spd: 0.8 },
    skills: ['galick', 'barrage', 'gallantstrike', 'saiyansmash', 'pointblank', 'battlefury', 'menace', 'crusherkick', 'finishingbuster', 'royalguard', 'finalflash'], rageArt: 'bigbang', attackClip: 'vegeta_combo', heightPx: 142,
  },
  goku: {
    signature: 3, id: 'goku', name: 'Goku', portrait: 'goku', sprite: 'goku', color: '#f6ac53', role: 'Balanced, Kaioken, Super Saiyan',
    base: { hp: 300, ki: 145, atk: 49, def: 21, spd: 27 }, growth: { hp: 27, ki: 11, atk: 4.2, def: 1.8, spd: 0.9 },
    skills: ['kamehameha', 'kaioken', 'kaiokenassault', 'dragonfist', 'kiblast', 'backhand', 'instantstrike', 'kitransfer', 'turtlestance', 'meteorcombo', 'kisurge', 'kaiokenkame'], rageArt: 'spiritbomb', attackClip: 'goku_combo', heightPx: 152,
  },
  piccolo: {
    signature: 3, id: 'piccolo', name: 'Piccolo', portrait: 'piccolo', sprite: 'piccolo', color: '#86db91', role: 'Piercing beam, support',
    base: { hp: 275, ki: 140, atk: 44, def: 20, spd: 23 }, growth: { hp: 26, ki: 11, atk: 3.8, def: 1.7, spd: 0.7 },
    skills: ['specialbeam', 'regenerate', 'hellzone', 'stretchpunch', 'lightgrenade', 'multiform', 'castoffweights', 'allycover', 'eyelaser', 'namekrenewal', 'demonbarrage', 'maxsbc'], rageArt: 'demonwave', attackClip: 'piccolo_combo', heightPx: 160,
  },
  dende: {
    signature: 3, id: 'dende', name: 'Dende', portrait: 'dende', sprite: 'dende', color: '#9fe3a3', role: 'Healer (guest)',
    base: { hp: 120, ki: 140, atk: 12, def: 8, spd: 18 }, growth: { hp: 12, ki: 12, atk: 1, def: 0.8, spd: 0.5 },
    skills: ['healtouch', 'revitalize', 'namekrevive', 'protectivechant', 'inspire'], rageArt: 'dendehope', attackClip: 'krillin_combo', heightPx: 96,
  },
  nail: {
    signature: 1, id: 'nail', name: 'Nail', portrait: 'nail', sprite: 'nail', color: '#8cd98f', role: 'Namekian warrior (guest)',
    base: { hp: 320, ki: 120, atk: 46, def: 22, spd: 26 }, growth: { hp: 24, ki: 9, atk: 3.6, def: 1.7, spd: 0.8 },
    skills: ['nailbeam', 'bladehand', 'stretchblock', 'piercingthrust', 'warriorsrite'], rageArt: 'nailstretch', attackClip: 'piccolo_combo', heightPx: 168,
  },
};

export const ATTACK_SKILL: Record<HeroId, string> = {
  trunks: 'atk_trunks', gohan: 'atk_gohan', krillin: 'atk_krillin', vegeta: 'atk_vegeta', goku: 'atk_goku', piccolo: 'atk_piccolo', dende: 'atk_dende', nail: 'atk_nail',
};

// Skills that replace a base skill once Goku has transformed.
export const SSJ_SKILLS = ['ssjkame', 'ssjassault'];
export const SSJ_RAGE_ART = 'ssjfury';

export const ITEMS: Record<string, ItemDef> = {
  medkit: { id: 'medkit', name: 'Med Kit', desc: 'Restore 120 HP to one ally.', icon: 'heal', hp: 120, price: 60 },
  megakit: { id: 'megakit', name: 'Mega Med Kit', desc: 'Restore 320 HP to one ally.', icon: 'heal', hp: 320, price: 180 },
  kicapsule: { id: 'kicapsule', name: 'Ki Capsule', desc: 'Restore 60 Ki to one ally.', icon: 'charge', ki: 60, price: 70 },
  senzu: { id: 'senzu', name: 'Senzu Bean', desc: 'Fully restore HP and Ki; revives a fallen ally.', icon: 'senzu', full: true, revive: true },
  powercap: { id: 'powercap', name: 'Power Capsule', desc: 'Equip: +6 ATK.', icon: 'power', price: 320, capsule: { atk: 6 } },
  guardcap: { id: 'guardcap', name: 'Guard Capsule', desc: 'Equip: +5 DEF.', icon: 'defend', price: 320, capsule: { def: 5 } },
  vitalcap: { id: 'vitalcap', name: 'Vital Capsule', desc: 'Equip: +60 HP.', icon: 'heal', price: 300, capsule: { hp: 60 } },
  kicap: { id: 'kicap', name: 'Ki Reserve Capsule', desc: 'Equip: +25 Ki.', icon: 'charge', price: 260, capsule: { ki: 25 } },
  speedcap: { id: 'speedcap', name: 'Swift Capsule', desc: 'Equip: +4 SPD.', icon: 'attack', price: 340, capsule: { spd: 4 } },
  frostcore: { id: 'frostcore', name: 'Frost Core Capsule', desc: 'Equip: +10 ATK, +8 DEF, +80 HP. Cooler’s trophy: only one exists.', icon: 'power', capsule: { atk: 10, def: 8, hp: 80 } },
  dragoncrest: { id: 'dragoncrest', name: 'Namekian Dragon Crest', desc: 'Equip: +9 ATK, +9 DEF, +90 HP, +30 Ki, Rage fills 10% faster. A legendary relic: only one exists.', icon: 'power', capsule: { atk: 9, def: 9, hp: 90, ki: 30, rageGain: 0.1 } },
  ragecap: { id: 'ragecap', name: 'Fury Capsule', desc: 'Equip: Rage fills 25% faster.', icon: 'combo', price: 400, capsule: { rageGain: 0.25 } },
};
