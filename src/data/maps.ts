import type { Ent, MapDef, ObjDef } from '../engine/world/mapTypes';

// ---------- tiny authoring helpers ----------
type Grid = string[][];
const G = (w: number, h: number, c = '.'): Grid => Array.from({ length: h }, () => Array<string>(w).fill(c));
const fill = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string) => { for (let y = Math.max(0, y0); y < Math.min(g.length, y1); y++) for (let x = Math.max(0, x0); x < Math.min(g[0].length, x1); x++) g[y][x] = c; };
const blob = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string) => { for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) g[y][x] = c; };
const path = (g: Grid, pts: [number, number][], c: string, r = 1) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); for (let k = 0; k <= n; k++) blob(g, ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, r + 0.4, r + 0.4, c); } };
const rows = (g: Grid) => g.map((r) => r.join(''));
const T = (o: string, x: number, y: number, s: number, solid?: [number, number], extra: Partial<ObjDef> = {}): ObjDef => ({ o, x, y, s, solid, ...extra });
const tree = (x: number, y: number, kind = 'tree_med', s = 0.5): ObjDef => T(kind, x, y, s, [0.9, 0.5]);
const rock = (x: number, y: number, kind = 'rock_med', s = 0.55): ObjDef => T(kind, x, y, s, [1.1, 0.7]);
const cliffRow = (y: number, x0: number, x1: number, step = 4): ObjDef[] => { const out: ObjDef[] = []; const names = ['cliff_wide', 'cliff_low', 'cliff_tall', 'cliff_m1', 'cliff_m2']; let i = 0; for (let x = x0; x < x1; x += step) { out.push(T(names[i++ % names.length], x + 2, y, 1.0, [4, 2.6])); } return out; };

// ================= SHORE: arrival =================
function shore(): MapDef {
  const W = 44, H = 26; const g = G(W, H);
  fill(g, 0, 0, 7, H, '~'); blob(g, 7, 6, 3, 4, '~'); blob(g, 7, 20, 3, 5, '~'); fill(g, 7, 0, 9, H, ','); // sea + beach
  path(g, [[8, 13], [16, 13], [26, 12], [43, 12]], ',', 1.6); blob(g, 14, 12, 4, 3, ',');
  blob(g, 30, 5, 5, 3, ','); blob(g, 20, 20, 4, 2, ',');
  return {
    id: 'shore', name: 'Azure Shore', sub: 'Namek · Landing site', w: W, h: H, ground: rows(g), spawn: { x: 10.5, y: 13.8 }, music: 'namek_day', stage: 'water', sky: 'day',
    objs: [
      ...cliffRow(2, 9, 43), T('lander', 13, 13, 0.85, [2.4, 1.2]),
      tree(11, 8, 'tree_big', 0.42), tree(15, 7, 'tree_med'), tree(19, 8, 'tree_s2'), tree(24, 7, 'tree_big', 0.42), tree(31, 9, 'tree_med'), tree(37, 8, 'tree_s1'),
      tree(11, 21, 'tree_med'), tree(17, 22, 'tree_s2'), tree(23, 23, 'tree_big', 0.42), tree(33, 20, 'tree_med'), tree(39, 22, 'tree_big', 0.42), tree(28, 19, 'tree_s1'),
      rock(22, 16), rock(30, 15, 'rock_big', 0.5), rock(36, 17, 'rock_s1'), rock(18, 10, 'rock_s2'), rock(10, 17, 'rock_s1'),
    ],
    ents: [
      { id: 'ship', kind: 'npc', x: 14.6, y: 14.3, ow: 'bulma', label: 'Bulma', script: 'shore_ship' },
      { id: 'fisher', kind: 'npc', x: 16, y: 17, obj: 'namek_f', scale: 0.55, dirs: { down: 'namek_f', up: 'namek_s', side: 'namek_s' }, script: 'shore_fisher', label: 'Namekian' },
      { id: 'chest_shore1', kind: 'chest', x: 26, y: 6, obj: 'crate_wood', scale: 0.9, chest: { items: { medkit: 2 } }, label: 'Crate' },
      { id: 'chest_shore2', kind: 'chest', x: 21, y: 21, obj: 'crate_wood', scale: 0.9, chest: { items: { kicapsule: 2 }, zeni: 60 }, label: 'Crate' },
      { id: 'shore_scouts', kind: 'trigger', x: 35, y: 12, w: 2, h: 9, script: 'shore_scouts', when: { not: 'scouts1' } },
      { id: 'shore_to_village', kind: 'exit', x: 43.2, y: 12, w: 1, h: 7, exit: { map: 'village', x: 2.5, y: 15 }, label: 'Aojan Village' },
      { id: 'shore_sack', kind: 'npc', x: 33.5, y: 18.5, obj: 'sack', scale: 0.8, script: 'shore_sack', label: 'Sack', when: { flag: ['q:shore_net', 'foe:shore_foe1'], not: 'qp:shore_sack' } },
      { id: 'shore_foe1', kind: 'foe', x: 29, y: 17, ow: 'soldier', foe: { foes: ['scout', 'scout'], patrol: [[29, 17], [32, 17]], title: 'Frieza Scouts' }, when: { flag: 'scouts1' } },
    ],
    encounters: { zones: [[10, 10, 43, 24]], table: [{ foes: ['scout'], weight: 3 }, { foes: ['scout', 'scout'], weight: 2 }] },
  };
}

// ================= VILLAGE =================
function village(): MapDef {
  const W = 46, H = 28; const g = G(W, H);
  path(g, [[0, 15], [14, 15], [24, 14], [45, 14]], ',', 1.6); blob(g, 24, 14, 5, 4, ','); path(g, [[24, 14], [24, 2]], ',', 1.3); path(g, [[33, 14], [33, 26]], ',', 1.1);
  blob(g, 8, 24, 3, 2, '~'); blob(g, 6, 25, 3, 2, '~');
  return {
    id: 'village', name: 'Aojan Village', sub: 'Namek · Namekian homes', w: W, h: H, ground: rows(g), spawn: { x: 3, y: 15 }, music: 'namek_village', stage: 'village', sky: 'day', safe: true,
    objs: [
      ...cliffRow(2, 0, 20), ...cliffRow(2, 28, 46),
      T('dome_cluster', 12, 10, 0.65, [4.4, 2]), T('v4_dome_horn_big', 18, 10, 0.78, [2.8, 1.4]), T('dome_cluster', 36, 10, 0.65, [4.4, 2], { flip: true }), T('v4_dome_horn_big', 40, 20, 0.78, [3, 1.4]), T('v4_dome_horn_big', 28, 22, 0.66, [2.4, 1.3]),
      T('dome_plain', 14, 22, 0.7, [3.2, 1.4]), T('spire1', 21, 11, 0.7, [0.8, 0.6]), T('spire2', 29, 10, 0.7, [0.8, 0.6]),
      tree(5, 9, 'tree_big', 0.42), tree(9, 6, 'v4_tree_blue_big', 0.62), tree(32, 7, 'tree_s2'), tree(43, 8, 'v4_tree_blue_big', 0.62), tree(6, 19, 'tree_s1'), tree(21, 25, 'tree_med'), tree(38, 25, 'tree_big', 0.42), tree(44, 17, 'tree_s2'),
      T('barrel', 27, 15.6, 0.7, [0.8, 0.6]), T('barrel', 28, 15.8, 0.7, [0.8, 0.6]), T('crate_wood', 20, 16.5, 0.8, [1, 0.7]),
      T('fence', 8.5, 17.5, 0.9, [3.4, 0.6]), rock(41, 13, 'rock_s1'), rock(3, 11, 'rock_s2'),
    ],
    ents: [
      { id: 'altar_save', kind: 'save', x: 24, y: 17, obj: 'altar', scale: 0.55, label: 'Dragon Ball Altar', solid: [3, 1.2] },
      { id: 'village_healer', kind: 'heal', x: 22.2, y: 13.2, obj: 'namek_elder_f', scale: 0.62, dirs: { down: 'namek_elder_f', up: 'namek_elder_b', side: 'namek_elder_f' }, label: 'Healer' },
      { id: 'village_comm', kind: 'npc', x: 22.6, y: 18.8, ow: 'bulma', script: 'postgame_comm', label: 'Capsule Comm', when: { flag: 'postgame_unlocked' } },
      { id: 'village_trader', kind: 'shop', x: 27, y: 13.3, obj: 'namek_f', scale: 0.58, dirs: { down: 'namek_f', up: 'namek_s', side: 'namek_s' }, script: 'village_shop', label: 'Trader' },
      { id: 'village_npc1', kind: 'npc', x: 10, y: 14, obj: 'namek_kid2_f', scale: 0.6, dirs: { down: 'namek_kid2_f', up: 'namek_kid1_b', side: 'namek_kid2_s' }, script: 'village_kid', label: 'Namekian child' },
      { id: 'village_npc2', kind: 'npc', x: 34.5, y: 17, obj: 'namek_s', scale: 0.58, dirs: { down: 'namek_f', up: 'namek_s', side: 'namek_s' }, script: 'village_elder_story', label: 'Namekian' },
      { id: 'dende_npc', kind: 'npc', x: 17, y: 14.5, ow: 'dende', script: 'dende_talk', label: 'Dende', when: { flag: 'dende_met' } },
      { id: 'chest_vil1', kind: 'chest', x: 8, y: 20, obj: 'crate_wood', scale: 0.9, chest: { items: { senzu: 1 } }, label: 'Chest' },
      { id: 'chest_vil2', kind: 'chest', x: 42, y: 15, obj: 'sack', scale: 0.9, chest: { items: { powercap: 1 }, zeni: 80 }, label: 'Sack' },
      { id: 'village_enter', kind: 'trigger', x: 5, y: 15, w: 2, h: 5, script: 'village_enter', when: { flag: 'scouts1', not: 'dende_met' } },
      { id: 'village_zarbon', kind: 'trigger', x: 24, y: 6, w: 7, h: 2, script: 'zarbon_fight', when: { flag: 'ball2', not: 'zarbon_done' } },
      { id: 'village_to_shore', kind: 'exit', x: 0.4, y: 15, w: 1, h: 6, exit: { map: 'shore', x: 41, y: 12.5 }, label: 'Azure Shore' },
      { id: 'village_to_landing', kind: 'exit', x: 45.4, y: 14, w: 1, h: 6, exit: { map: 'landing', x: 2.5, y: 14 }, label: 'Landing Zone', lock: { cond: { flag: 'dende_met' }, msg: 'Dende needs your help first.' } },
      { id: 'village_to_guru', kind: 'exit', x: 24, y: 1.6, w: 4, h: 1, exit: { map: 'guru', x: 20, y: 22 }, label: "Guru's Sanctuary", lock: { cond: { flag: 'zarbon_done' }, msg: 'The path north is blocked by Zarbon’s patrols.' } },
      { id: 'village_to_ridge', kind: 'exit', x: 33, y: 27.3, w: 3, h: 1, exit: { map: 'ridge', x: 3, y: 13 }, label: 'Highlands', lock: { cond: { flag: 'guru_done' }, msg: 'Nothing but wilderness that way… for now.' } },
    ],
  };
}

// ================= LANDING ZONE (Frieza camp) =================
function landing(): MapDef {
  const W = 46, H = 26; const g = G(W, H);
  fill(g, 10, 6, 42, 24, ','); blob(g, 26, 14, 14, 8, ','); path(g, [[0, 14], [12, 14]], ',', 1.6); path(g, [[40, 14], [45, 14]], ',', 1.6);
  return {
    id: 'landing', name: 'Frieza Landing Zone', sub: 'Namek · Enemy camp', w: W, h: H, ground: rows(g), spawn: { x: 3, y: 14 }, music: 'frieza_camp', stage: 'ruin', sky: 'day',
    objs: [
      ...cliffRow(2, 0, 46), T('ship_ufo', 26, 11, 0.62, [9.4, 2.6]), T('lander', 14, 8, 0.8, [2.4, 1.2]), T('lander', 38, 9, 0.8, [2.4, 1.2], { flip: true }),
      T('tent', 10, 20, 0.7, [4, 1.5]), T('crate_metal', 17, 18, 0.9, [1.2, 0.8]), T('crate_dark', 18.4, 18.4, 0.9, [1.2, 0.8]), T('crate_metal', 35, 19, 0.9, [1.2, 0.8]), T('tank_m', 31, 19, 0.8, [1.6, 1]),
      T('pod_round', 21, 21, 0.7, [1.6, 1]), T('pod_eye', 33, 22, 0.55, [1.6, 1]), tree(5, 8, 'tree_s2'), tree(44, 9, 'tree_med'), tree(6, 22, 'tree_big', 0.42), rock(24, 22, 'rock_big', 0.5), rock(41, 21, 'rock_s1'), rock(8, 12, 'rock_s2'),
    ],
    ents: [
      { id: 'landing_vegeta', kind: 'trigger', x: 8, y: 14, w: 2, h: 5, script: 'vegeta_arrive', when: { flag: 'dende_met', not: 'vegeta_arrived' } },
      { id: 'landing_cui', kind: 'trigger', x: 22, y: 15.5, w: 2, h: 6, script: 'cui_fight', when: { flag: 'vegeta_arrived', not: 'cui_done' } },
      { id: 'landing_dodoria', kind: 'trigger', x: 36, y: 15.5, w: 2, h: 6, script: 'dodoria_fight', when: { flag: 'cui_done', not: 'dodoria_done' } },
      { id: 'landing_frieza', kind: 'trigger', x: 26, y: 17, w: 8, h: 3, script: 'frieza_forms', when: { flag: ['piccolo_joined', 'cui_done', 'dodoria_done'], not: 'frieza3_done' } },
      { id: 'landing_frieza4', kind: 'trigger', x: 26, y: 17, w: 8, h: 3, script: 'frieza_final_form', when: { flag: ['frieza3_done', 'cui_done', 'dodoria_done'], not: 'krillin_dead' } },
      { id: 'landing_to_hold', kind: 'exit', x: 26, y: 12.3, w: 1.6, h: 1, exit: { map: 'hold', x: 12, y: 15 }, label: 'Ship hold', lock: { cond: { flag: 'dodoria_done' }, msg: 'The ramp is guarded by soldiers. Deal with Dodoria first.' } },
      { id: 'landing_foe1', kind: 'foe', x: 18, y: 22, ow: 'soldier', foe: { foes: ['guard', 'scout'], patrol: [[16, 22], [20, 22]], title: 'Camp patrol' }, when: { flag: 'cui_done' } },
      { id: 'landing_foe2', kind: 'foe', x: 33, y: 8, ow: 'soldier', foe: { foes: ['guard', 'guard'], patrol: [[31, 8], [36, 8]], title: 'Elite patrol' }, when: { flag: 'dodoria_done' } },
      { id: 'chest_land1', kind: 'chest', x: 12, y: 22, obj: 'crate_metal', scale: 0.9, chest: { items: { medkit: 2, kicapsule: 1 } }, label: 'Supply crate', when: { flag: 'cui_done' } },
      { id: 'ball6_pick', kind: 'ball', x: 14, y: 19.5, obj: 'dball6', scale: 0.85, script: 'ball6_pick', when: { flag: 'piccolo_joined', not: 'ball6' }, label: 'Dragon Ball' },
      { id: 'landing_altar', kind: 'save', x: 12.5, y: 16.5, obj: 'altar', scale: 0.4, label: 'Altar', solid: [2, 0.9] },
      { id: 'landing_to_village', kind: 'exit', x: 0.4, y: 14, w: 1, h: 6, exit: { map: 'village', x: 44, y: 14.5 }, label: 'Aojan Village' },
      { id: 'landing_to_cave', kind: 'exit', x: 45.4, y: 14, w: 1, h: 6, exit: { map: 'cave', x: 2.5, y: 12 }, label: 'Crystal Grotto', lock: { cond: { flag: 'dodoria_done' }, msg: 'Dodoria’s soldiers block the way east.' } },
      { id: 'landing_to_core_post', kind: 'exit', x: 23, y: 8, w: 2, h: 2, exit: { map: 'core', x: 6, y: 11 }, label: 'Namek’s Last Ground', when: { flag: ['postgame_unlocked', 'final_done'] } },
      { id: 'landing_to_core', kind: 'trigger', x: 23, y: 8, w: 2, h: 2, script: 'to_final', when: { flag: 'krillin_dead', not: 'final_done' } },
    ],
    encounters: { zones: [[12, 7, 40, 23]], table: [{ foes: ['scout', 'guard'], weight: 3 }, { foes: ['guard', 'guard'], weight: 2, minChapter: 2 }, { foes: ['guard', 'scout', 'scout'], weight: 1, minChapter: 2 }] },
  };
}

// ================= CAVE =================
function cave(): MapDef {
  const W = 36, H = 24; const g = G(W, H, 'x');
  path(g, [[0, 12], [10, 12], [14, 8], [22, 8], [26, 14], [32, 16]], 'c', 2.2); blob(g, 28, 17, 5, 4, 'c'); blob(g, 18, 8, 4, 3, 'c'); blob(g, 8, 18, 4, 3, 'c'); path(g, [[10, 12], [8, 18]], 'c', 1.4);
  return {
    id: 'cave', name: 'Crystal Grotto', sub: 'Namek · Underground', w: W, h: H, ground: rows(g), spawn: { x: 3, y: 12 }, music: 'namek_cave', stage: 'cave', sky: 'cave',
    objs: [
      T('crystals', 17, 9, 0.7, [2, 1]), T('crystals', 8, 19, 0.6, [2, 1]), T('crystals', 29, 18, 0.65, [2, 1]), rock(12, 9, 'rock_big', 0.45), rock(24, 12, 'rock_med'), rock(6, 14, 'rock_s1'), rock(31, 14, 'rock_s2'),
    ],
    ents: [
      { id: 'ball2_pick', kind: 'ball', x: 30, y: 17.5, obj: 'dball2', scale: 0.85, script: 'ball2_pick', when: { flag: 'dodoria_done', not: 'ball2' }, label: 'Dragon Ball' },
      { id: 'cave_child', kind: 'npc', x: 9.5, y: 16.6, obj: 'namek_kid2_f', scale: 0.6, dirs: { down: 'namek_kid2_f', up: 'namek_kid1_b', side: 'namek_kid2_s' }, script: 'cave_child', label: 'Namekian child', when: { flag: 'q:grotto_child', not: 'qp:grotto_child_found' } },
      { id: 'chest_cave1', kind: 'chest', x: 8, y: 20, obj: 'crate_dark', scale: 0.9, chest: { items: { guardcap: 1 } }, label: 'Chest' },
      { id: 'chest_cave2', kind: 'chest', x: 19, y: 6.5, obj: 'crate_wood', scale: 0.9, chest: { items: { megakit: 1, kicapsule: 2 } }, label: 'Chest' },
      { id: 'cave_to_landing', kind: 'exit', x: 0.4, y: 12, w: 1, h: 4, exit: { map: 'landing', x: 44, y: 14.5 }, label: 'Landing Zone' },
    ],
    encounters: { zones: [[2, 5, 34, 22]], table: [{ foes: ['scout', 'guard'], weight: 2 }, { foes: ['guard', 'guard'], weight: 3 }] },
  };
}

// ================= GURU =================
function guru(): MapDef {
  const W = 40, H = 26; const g = G(W, H);
  path(g, [[20, 25], [20, 14]], ',', 1.7); blob(g, 20, 13, 7, 4, ','); blob(g, 6, 20, 3, 2, '~');
  return {
    id: 'guru', name: 'Guru’s Sanctuary', sub: 'Namek · Highlands', w: W, h: H, ground: rows(g), spawn: { x: 20, y: 22 }, music: 'namek_sacred', stage: 'plain', sky: 'day', safe: true,
    objs: [
      ...cliffRow(2, 0, 40), T('temple', 20, 11, 0.62, [5.6, 2.6]), T('spire1', 12, 12, 0.7, [0.8, 0.6]), T('spire2', 28, 12, 0.7, [0.8, 0.6]),
      tree(6, 8, 'tree_big', 0.42), tree(34, 9, 'tree_big', 0.42), tree(10, 18, 'tree_med'), tree(30, 19, 'tree_med'), tree(14, 23, 'tree_s2'), tree(27, 23, 'tree_s1'), rock(35, 16), rock(5, 15, 'rock_s1'),
    ],
    ents: [
      { id: 'guru_trigger', kind: 'trigger', x: 20, y: 17, w: 6, h: 2, script: 'guru_scene', when: { flag: 'zarbon_done', not: 'guru_done' } },
      { id: 'guru_npc', kind: 'npc', x: 20, y: 14.5, obj: 'namek_elder_f', scale: 0.8, script: 'guru_talk', label: 'Guru' },
      { id: 'nail_npc', kind: 'npc', x: 24, y: 15.6, ow: 'nail', script: 'nail_talk', label: 'Nail', when: { flag: 'guru_done' } },
      { id: 'ball3_pick', kind: 'ball', x: 17, y: 15.5, obj: 'dball3', scale: 0.85, script: 'ball3_pick', when: { flag: 'guru_done', not: 'ball3' }, label: 'Dragon Ball' },
      { id: 'porunga_shrine', kind: 'npc', x: 28.5, y: 17.4, obj: 'altar', scale: 0.62, solid: [3, 1.2], script: 'porunga_shrine', label: 'Dragon Ball Shrine', when: { flag: 'postgame_unlocked' } },
      { id: 'guru_save', kind: 'save', x: 15, y: 18, obj: 'altar', scale: 0.4, label: 'Altar', solid: [2, 0.9] },
      { id: 'nail_fight_trigger', kind: 'trigger', x: 20, y: 20, w: 8, h: 2, script: 'nail_frieza', when: { flag: 'ginyu_done', not: 'piccolo_joined' } },
      { id: 'chest_guru', kind: 'chest', x: 33, y: 20, obj: 'crate_wood', scale: 0.9, chest: { items: { ragecap: 1, senzu: 1 } }, label: 'Offering' },
      { id: 'guru_to_village', kind: 'exit', x: 20, y: 25.4, w: 4, h: 1, exit: { map: 'village', x: 24, y: 4 }, label: 'Aojan Village' },
    ],
  };
}

// ================= RIDGE (Ginyu Force) =================
function ridge(): MapDef {
  const W = 52, H = 24; const g = G(W, H);
  path(g, [[0, 13], [14, 12], [26, 14], [40, 12], [51, 12]], ',', 1.6); blob(g, 26, 14, 5, 3, ','); blob(g, 10, 20, 4, 2, '~');
  return {
    id: 'ridge', name: 'Namek Highlands', sub: 'Namek · Wilderness', w: W, h: H, ground: rows(g), spawn: { x: 3, y: 13 }, music: 'ginyu_theme', stage: 'plain', sky: 'day',
    objs: [
      ...cliffRow(2, 0, 52), tree(6, 7, 'tree_big', 0.42), tree(11, 8, 'tree_med'), tree(19, 7, 'tree_s2'), tree(30, 8, 'tree_big', 0.42), tree(44, 8, 'tree_med'),
      tree(8, 18, 'tree_med'), tree(18, 20, 'tree_s1'), tree(33, 19, 'tree_med'), tree(46, 20, 'tree_big', 0.42), rock(23, 9, 'rock_big', 0.5), rock(37, 17), rock(48, 14, 'rock_s1'), rock(13, 16, 'rock_s2'),
    ],
    ents: [
      { id: 'ridge_guldo', kind: 'trigger', x: 12, y: 12.5, w: 2, h: 7, script: 'guldo_fight', when: { flag: 'guru_done', not: 'guldo_done' } },
      { id: 'ridge_recoome', kind: 'trigger', x: 24, y: 13.5, w: 2, h: 7, script: 'recoome_fight', when: { flag: 'guldo_done', not: 'recoome_done' } },
      { id: 'ridge_duo', kind: 'trigger', x: 36, y: 12.5, w: 2, h: 7, script: 'duo_fight', when: { flag: 'recoome_done', not: 'duo_done' } },
      { id: 'ridge_ginyu', kind: 'trigger', x: 46, y: 12, w: 2, h: 7, script: 'ginyu_fight', when: { flag: 'duo_done', not: 'ginyu_done' } },
      { id: 'hurt_namek', kind: 'npc', x: 16, y: 16, obj: 'namek_kid2_s', scale: 0.55, script: 'ridge_hurt', label: 'Frightened Namekian' },
      { id: 'ridge_foe1', kind: 'foe', x: 18, y: 9.5, ow: 'soldier', foe: { foes: ['guard', 'guard', 'scout'], patrol: [[16, 9.5], [21, 9.5]], title: 'Ambush party' }, when: { flag: 'guru_done' } },
      { id: 'chest_ridge1', kind: 'chest', x: 9, y: 9, obj: 'crate_wood', scale: 0.9, chest: { items: { medkit: 3 } }, label: 'Crate' },
      { id: 'chest_ridge2', kind: 'chest', x: 40, y: 20, obj: 'crate_dark', scale: 0.9, chest: { items: { speedcap: 1, vitalcap: 1 } }, label: 'Hidden cache' },
      { id: 'ball4_pick', kind: 'ball', x: 34, y: 17.5, obj: 'dball4', scale: 0.85, script: 'ball4_pick', when: { flag: 'ginyu_done', not: 'ball4' }, label: 'Dragon Ball' },
      { id: 'ridge_save', kind: 'save', x: 27, y: 17.5, obj: 'altar', scale: 0.4, label: 'Altar', solid: [2, 0.9] },
      { id: 'ridge_to_village', kind: 'exit', x: 0.4, y: 13, w: 1, h: 5, exit: { map: 'village', x: 33, y: 25 }, label: 'Aojan Village' },
      { id: 'ridge_rift', kind: 'sign', x: 48.2, y: 10.6, obj: 'v4_ice_crystal_big', scale: 0.55, solid: [1.4, 0.7], script: 'cooler_rift', label: 'Frozen rift', when: { flag: 'postgame_unlocked' } },
      { id: 'ridge_to_cooler', kind: 'exit', x: 51.6, y: 12.4, w: 1, h: 4, exit: { map: 'cooler_ruins', x: 2.6, y: 14.2 }, label: 'Frozen Ruins', when: { flag: 'cooler_trail_open' } },
    ],
    encounters: { zones: [[4, 6, 50, 22]], table: [{ foes: ['guard', 'guard'], weight: 3 }, { foes: ['guard', 'scout', 'scout'], weight: 2 }] },
  };
}

// ================= SHIP HOLD (interior) =================
function hold(): MapDef {
  const W = 28, H = 20; const g = G(W, H, 'x');
  fill(g, 2, 6, 26, 18, 'm'); fill(g, 10, 3, 18, 6, 'm');
  return {
    id: 'hold', name: 'Frieza’s Ship · Hold', sub: 'Namek · Warship', w: W, h: H, ground: rows(g), spawn: { x: 12, y: 15 }, music: 'frieza_ship', stage: 'ship', sky: 'ship',
    objs: [
      T('panel_tall', 4, 6, 0.6, [1.4, 1]), T('panel_vent', 7, 6, 0.9, [2.6, 0.6]), T('panel_a', 10, 6, 0.9, [2.6, 0.6]), T('panel_door', 14, 6, 0.9, [1.4, 0.6]), T('panel_vent', 18, 6, 0.9, [2.6, 0.6]), T('panel_a', 22, 6, 0.9, [2.6, 0.6]), T('panel_tall', 25, 6, 0.6, [1.4, 1]),
      T('tank_l', 5, 11, 0.9, [1.8, 1.2]), T('tank_m', 22, 11, 0.9, [1.6, 1.1]), T('crate_metal', 9, 16, 0.9, [1.2, 0.8]), T('crate_dark', 19, 16, 0.9, [1.2, 0.8]), T('pod_round', 14, 9.5, 0.7, [1.6, 1]),
    ],
    ents: [
      { id: 'chest_hold1', kind: 'chest', x: 14, y: 4.5, obj: 'crate_metal', scale: 0.9, chest: { items: { megakit: 2, senzu: 1 } }, label: 'Locker' },
      { id: 'chest_hold2', kind: 'chest', x: 24, y: 16, obj: 'crate_dark', scale: 0.9, chest: { items: { kicap: 1, powercap: 1 }, zeni: 150 }, label: 'Locker' },
      { id: 'ball5_pick', kind: 'ball', x: 21, y: 9, obj: 'dball5', scale: 0.85, script: 'ball5_pick', when: { flag: 'dodoria_done', not: 'ball5' }, label: 'Dragon Ball' },
      { id: 'hold_logbook', kind: 'npc', x: 4.5, y: 16.2, obj: 'crate_dark', scale: 0.9, script: 'hold_logbook', label: 'Order log' },
      { id: 'hold_foe1', kind: 'foe', x: 18, y: 13, ow: 'soldier', foe: { foes: ['guard', 'guard', 'guard'], patrol: [[16, 13], [21, 13]], title: 'Hold guards' } },
      { id: 'hold_foe2', kind: 'foe', x: 7, y: 14, ow: 'soldier', foe: { foes: ['guard', 'guard'], patrol: [[5, 14], [9, 14]], title: 'Hold guards' } },
      { id: 'hold_to_landing', kind: 'exit', x: 12, y: 18.4, w: 3, h: 1, exit: { map: 'landing', x: 26, y: 13.5 }, label: 'Landing Zone' },
    ],
    encounters: { zones: [[3, 7, 25, 17]], table: [{ foes: ['guard', 'guard'], weight: 3 }, { foes: ['guard', 'guard', 'guard'], weight: 2, minChapter: 2 }] },
  };
}

// ================= CORE (dying Namek, final stage) =================
function core(): MapDef {
  const W = 30, H = 18; const g = G(W, H, 'r');
  fill(g, 0, 0, W, 4, 'x'); blob(g, 15, 10, 9, 4, ',');
  return {
    id: 'core', name: 'Namek’s Last Ground', sub: 'Namek · Collapsing', w: W, h: H, ground: rows(g), spawn: { x: 6, y: 11 }, music: 'final_battle', stage: 'final', sky: 'final', safe: true,
    objs: [rock(4, 7, 'rock_big', 0.55), rock(26, 7, 'rock_big', 0.55), T('dead1', 9, 7, 0.9, [1, 0.5]), T('dead2', 22, 7, 0.9, [1, 0.5]), rock(13, 15, 'rock_s1'), rock(19, 15, 'rock_s2')],
    ents: [
      { id: 'core_to_landing', kind: 'exit', x: 0.4, y: 11.5, w: 1, h: 5, exit: { map: 'landing', x: 22.2, y: 12.4 }, label: 'Landing Zone', when: { flag: 'postgame_unlocked' } },
      { id: 'core_final', kind: 'trigger', x: 14, y: 11, w: 4, h: 3, script: 'final_battle', when: { flag: 'ssj', not: 'final_done' } },
      { id: 'core_epilogue', kind: 'trigger', x: 14, y: 11, w: 4, h: 3, script: 'epilogue', when: { flag: 'final_done', not: 'ending_seen' } },
      { id: 'core_altar', kind: 'save', x: 8.5, y: 12.8, obj: 'altar', scale: 0.4, label: 'Last Altar', solid: [2, 0.9] },
      { id: 'ball7_pick', kind: 'ball', x: 21, y: 13.5, obj: 'dball7', scale: 0.85, script: 'ball7_pick', when: { flag: 'ssj', not: 'ball7' }, label: 'Dragon Ball' },
    ],
  };
}

// ================= COOLER'S FROZEN RUINS (postgame) =================
function coolerRuins(): MapDef {
  const W = 46, H = 28; const g = G(W, H, 'x');
  path(g, [[0, 14], [9, 14], [16, 13], [24, 14], [31, 14]], 'i', 2.1);
  blob(g, 22, 14, 6, 5, 'i'); blob(g, 15, 6.5, 4.5, 3, 'i'); path(g, [[15, 6.5], [18, 12]], 'i', 1.6);
  blob(g, 27, 22, 4.5, 3, 'i'); path(g, [[27, 22], [24, 17]], 'i', 1.6);
  blob(g, 39, 14, 6.5, 8, 'i'); path(g, [[31, 14], [35, 14]], 'i', 2.4);
  blob(g, 19, 9.5, 1.5, 1.2, '~'); blob(g, 27, 9, 1.6, 1.3, '~'); blob(g, 18, 19, 1.6, 1.2, '~'); blob(g, 11, 17, 1.2, 1, '~');
  return {
    id: 'cooler_ruins', name: 'Cooler’s Frozen Ruins', sub: 'Capsule Corp Simulation · Unknown signal', w: W, h: H, ground: rows(g), spawn: { x: 3, y: 14 }, music: 'cooler_ruins', stage: 'frozen', sky: 'ice',
    objs: [
      T('v4_ice_crystal_big', 40, 5.4, 1.0, [3, 1.1]), T('v4_ice_crystal_big', 24, 7, 0.95, [2.4, 1]), T('v4_ice_crystal_big', 30, 20.5, 0.8, [2, 0.9]), T('v4_ice_crystal_big', 12, 8.5, 0.7, [1.8, 0.8]),
      T('v4_ice_pillar_crystal', 33.5, 11, 0.9, [1.6, 0.9]), T('v4_ice_pillar_crystal', 33.5, 18, 0.9, [1.6, 0.9]), T('v4_ice_crystal_big', 6, 9.5, 0.8, [2.2, 1]), T('v4_ice_crystal_big', 7, 21, 0.7, [2, 0.9]),
      T('v4_ice_tree_big', 20, 5.5, 0.8, [1, 0.6]), T('v4_ice_tree', 15, 10.5, 0.8, [0.9, 0.5]), T('v4_ice_tree', 36.5, 7.5, 0.8, [0.9, 0.5]), T('v4_ice_tree_big', 44, 20, 0.8, [1, 0.6]),
      T('v4_ice_banner', 38, 8.2, 0.9, [0.8, 0.5]), T('v4_ice_banner', 42, 8.2, 0.9, [0.8, 0.5]), T('v4_ice_banner', 30.5, 11.5, 0.8, [0.7, 0.5]),
    ],
    ents: [
      { id: 'cooler_to_ridge', kind: 'exit', x: 0.4, y: 14, w: 1, h: 5, exit: { map: 'ridge', x: 49.2, y: 12.6 }, label: 'Namek Highlands' },
      { id: 'cooler_save', kind: 'save', x: 8, y: 15.4, obj: 'altar', scale: 0.4, label: 'Altar', solid: [2, 0.9] },
      { id: 'cooler_comm', kind: 'npc', x: 5.5, y: 12.6, ow: 'bulma', label: 'Capsule Comm', script: 'cooler_comm' },
      { id: 'cr_foe1', kind: 'foe', x: 14, y: 14.3, ow: 'soldier', foe: { foes: ['frostguard', 'frostguard'], patrol: [[11, 14.3], [17, 14.3]], title: 'Frost patrol', hp: 1, atk: 1 } },
      { id: 'cr_foe2', kind: 'foe', x: 22, y: 16, ow: 'soldier', foe: { foes: ['frostguard', 'frostelite'], patrol: [[19.5, 16], [25, 16]], title: 'Ruin guards', hp: 1, atk: 1 } },
      { id: 'cr_foe3', kind: 'foe', x: 27, y: 22, ow: 'soldier', foe: { foes: ['frostelite', 'frostguard', 'frostguard'], patrol: [[25, 22], [29, 22]], title: 'Frozen vault guards', hp: 1, atk: 1 } },
      { id: 'chest_cr1', kind: 'chest', x: 15, y: 6.6, obj: 'crate_metal', scale: 0.9, chest: { items: { megakit: 3, senzu: 1 } }, label: 'Supply crate' },
      { id: 'chest_cr2', kind: 'chest', x: 27, y: 23.2, obj: 'crate_dark', scale: 0.9, chest: { items: { senzu: 2, kicap: 1 }, zeni: 900 }, label: 'Vault chest' },
      { id: 'cooler_presence', kind: 'prop', x: 40.2, y: 14.4, ow: 'cooler', label: 'Cooler', when: { not: 'cooler_defeated' } },
      { id: 'cooler_arena', kind: 'trigger', x: 35.3, y: 14, w: 1.6, h: 6, script: 'cooler_fight', when: { not: 'cooler_defeated' } },
      { id: 'cooler_rematch', kind: 'npc', x: 41.5, y: 12.2, ow: 'bulma', label: 'Training Rematch', script: 'cooler_rematch', when: { flag: 'cooler_defeated' } },
    ],
    encounters: { zones: [[10, 8, 34, 24]], table: [{ foes: ['frostguard', 'frostguard'], weight: 3, hp: 1, atk: 1 }, { foes: ['frostguard', 'frostelite'], weight: 2, hp: 1, atk: 1 }, { foes: ['frostelite', 'frostelite'], weight: 1, hp: 1, atk: 1 }] },
  };
}

export const MAPS: Record<string, MapDef> = {};
[shore(), village(), landing(), cave(), guru(), ridge(), hold(), core(), coolerRuins()].forEach((m) => { MAPS[m.id] = m; });
export const START_MAP = { map: 'shore', x: 10.5, y: 13.8 };
export type { Ent };
