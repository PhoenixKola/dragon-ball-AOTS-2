import type { HeroId, Stats } from '../types';
import { HEROES, ITEMS } from '../data/heroes';
import { MAPS } from '../data/maps';
import { COMBOS } from '../data/combos';
import { newMember, type PartyMember, statsOf, CAPSULE_SLOTS, MAX_LEVEL, POINTS_PER_LEVEL, MAX_EQUIPPED } from './party';
import { SKILLS } from '../data/skills';
import { newGameState, syncBalls, SAVE_VERSION, type Facing, type GameState } from './gameState';

export const SLOT_COUNT = 3;
const KEY = (slot: number) => `aots2.save.v3.slot${slot}`;
const BAK = (slot: number) => `aots2.save.v3.slot${slot}.bak`;
export const AUTOSAVE_SLOT = 0;
export const LEGACY_KEY = 'aots2-namek-save-v2';
const LEGACY_BACKUP = 'aots2.legacy.v2.backup';

const SAFE_KEY = /^[A-Za-z0-9_:\-]{1,64}$/;
const HERO_IDS = Object.keys(HEROES) as HeroId[];
const STAT_KEYS: (keyof Stats)[] = ['hp', 'ki', 'atk', 'def', 'spd'];

export interface SlotMeta { slot: number; empty: boolean; corrupt?: boolean; mapName?: string; chapter?: number; playMs?: number; savedAt?: number; levels?: { id: HeroId; level: number }[]; balls?: number; version?: number }

export type Parsed = { ok: true; state: GameState } | { ok: false; error: string };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && Math.floor(v) === v && v >= lo && v <= hi ? v : null);
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

/** Strict whitelist validation: builds a fresh object, never copies unknown keys (no prototype pollution). */
export function validateState(raw: unknown): Parsed {
  if (!isObj(raw)) return { ok: false, error: 'Save is not an object' };
  if (raw.version !== SAVE_VERSION) return { ok: false, error: `Unsupported save version ${String(raw.version)}` };
  const out = newGameState();
  const map = typeof raw.mapId === 'string' && Object.prototype.hasOwnProperty.call(MAPS, raw.mapId) ? MAPS[raw.mapId] : null;
  if (!map) return { ok: false, error: 'Unknown map' };
  const x = num(raw.x, 0, map.w), y = num(raw.y, 0, map.h);
  if (x === null || y === null) return { ok: false, error: 'Position out of bounds' };
  out.mapId = map.id; out.x = x; out.y = y;
  if (!['down', 'up', 'left', 'right'].includes(raw.facing as string)) return { ok: false, error: 'Bad facing' };
  out.facing = raw.facing as Facing;
  const ch = int(raw.chapter, 0, 7); if (ch === null) return { ok: false, error: 'Bad chapter' }; out.chapter = ch;
  if (!isObj(raw.flags)) return { ok: false, error: 'Bad flags' };
  out.flags = Object.create(null) as Record<string, boolean>;
  for (const [k, v] of Object.entries(raw.flags)) { if (!SAFE_KEY.test(k) || k === '__proto__') return { ok: false, error: 'Bad flag name' }; if (v !== true) return { ok: false, error: 'Bad flag value' }; out.flags[k] = true; }
  if (!Array.isArray(raw.roster) || raw.roster.length < 1 || raw.roster.length > HERO_IDS.length) return { ok: false, error: 'Bad roster' };
  const roster: PartyMember[] = []; const seen = new Set<string>();
  for (const r of raw.roster) {
    if (!isObj(r) || !HERO_IDS.includes(r.id as HeroId) || seen.has(r.id as string)) return { ok: false, error: 'Bad roster member' };
    seen.add(r.id as string);
    const level = int(r.level, 1, MAX_LEVEL); if (level === null) return { ok: false, error: 'Bad level' };
    const m = newMember(r.id as HeroId, level);
    const xp = num(r.xp, 0, 1e7); if (xp === null) return { ok: false, error: 'Bad xp' }; m.xp = xp;
    const unspent = int(r.unspent, 0, 999); if (unspent === null) return { ok: false, error: 'Bad points' }; m.unspent = unspent;
    if (!isObj(r.alloc)) return { ok: false, error: 'Bad allocation' };
    let spent = 0;
    for (const k of STAT_KEYS) { const v = int(r.alloc[k], 0, 999); if (v === null) return { ok: false, error: 'Bad allocation' }; m.alloc[k] = v; spent += v; }
    if (spent + unspent > (level - 1) * POINTS_PER_LEVEL + 30) return { ok: false, error: 'Too many training points' };
    if (!Array.isArray(r.capsules) || r.capsules.length > CAPSULE_SLOTS) return { ok: false, error: 'Bad capsules' };
    m.capsules = [];
    for (const c of r.capsules) { if (typeof c !== 'string' || !ITEMS[c]?.capsule) return { ok: false, error: 'Bad capsule' }; m.capsules.push(c); }
    // optional (v5): the equipped loadout. Missing = default loadout (old saves). Present = at most four distinct skills of this hero that are already learned.
    if (r.equipped !== undefined) {
      if (!Array.isArray(r.equipped) || r.equipped.length > MAX_EQUIPPED) return { ok: false, error: 'Bad loadout' };
      const eq: string[] = [];
      for (const id of r.equipped) {
        if (typeof id !== 'string' || !HEROES[m.id].skills.includes(id) || !SKILLS[id] || SKILLS[id].unlockLevel > level || eq.includes(id)) return { ok: false, error: 'Bad loadout skill' };
        eq.push(id);
      }
      m.equipped = eq;
    }
    if (r.potential !== undefined) { if (typeof r.potential !== 'boolean') return { ok: false, error: 'Bad potential flag' }; if (r.potential) { if (!out.flags.wish_potential) return { ok: false, error: 'Potential without the wish' }; m.potential = true; } }
    if (m.id === 'trunks' && !out.flags.wish_trunks) return { ok: false, error: 'Trunks without the wish' };
    m.ssj = r.ssj === true && m.id === 'goku'; m.fused = r.fused === true && m.id === 'piccolo';
    const st = statsOf(m);
    const hp = int(r.hp, 0, st.hp), ki = int(r.ki, 0, st.ki);
    if (hp === null || ki === null) return { ok: false, error: 'HP/Ki out of range' }; m.hp = hp; m.ki = ki;
    roster.push(m);
  }
  out.roster = roster;
  if (!Array.isArray(raw.party) || raw.party.length < 1 || raw.party.length > 3) return { ok: false, error: 'Bad party' };
  const party: HeroId[] = [];
  for (const p of raw.party) { if (!seen.has(p as string) || party.includes(p as HeroId)) return { ok: false, error: 'Party/roster mismatch' }; party.push(p as HeroId); }
  out.party = party;
  if (!isObj(raw.inventory)) return { ok: false, error: 'Bad inventory' };
  out.inventory = {};
  for (const [k, v] of Object.entries(raw.inventory)) { if (!ITEMS[k]) return { ok: false, error: 'Unknown item ' + k }; const n = int(v, 0, 99); if (n === null) return { ok: false, error: 'Bad item count' }; if (n > 0) out.inventory[k] = n; }
  const zeni = int(raw.zeni, 0, 999999); if (zeni === null) return { ok: false, error: 'Bad zeni' }; out.zeni = zeni;
  const balls = int(raw.balls, 0, 7); if (balls === null) return { ok: false, error: 'Bad dragon balls' }; out.balls = balls;
  if (!Array.isArray(raw.combos)) return { ok: false, error: 'Bad combos' };
  out.combos = [];
  for (const c of raw.combos) { if (!COMBOS.some((r) => r.id === c)) return { ok: false, error: 'Unknown combo' }; out.combos.push(c as string); }
  const play = num(raw.playMs, 0, 1e10); if (play === null) return { ok: false, error: 'Bad playtime' }; out.playMs = play;
  if (!isObj(raw.stats)) return { ok: false, error: 'Bad stats' };
  for (const k of ['battles', 'wins', 'steps', 'defeats'] as const) { const v = int(raw.stats[k], 0, 1e9); if (v === null) return { ok: false, error: 'Bad stats' }; out.stats[k] = v; }
  if (raw.postgame !== undefined) {
    if (!isObj(raw.postgame)) return { ok: false, error: 'Bad postgame block' };
    const tw = int(raw.postgame.trainingWins, 0, 1e9), cc = int(raw.postgame.coolerClears, 0, 1e6), cb = int(raw.postgame.coolerBestRounds, 0, 999);
    if (tw === null || cc === null || cb === null) return { ok: false, error: 'Bad postgame stats' };
    out.postgame = { trainingWins: tw, coolerClears: cc, coolerBestRounds: cb };
  }
  out.savedAt = num(raw.savedAt, 0, 1e15) ?? Date.now();
  // Ownership is the ball1..ball7 flags; a stored count that disagrees is discarded in memory (nothing is invented, the file is untouched until the next save, which backs up the old one).
  syncBalls(out);
  return { ok: true, state: out };
}

function checksum(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
export const serialize = (state: GameState) => { const body = JSON.stringify(state); return JSON.stringify({ body, sum: checksum(body) }); };
export function deserialize(text: string): Parsed {
  try {
    const env = JSON.parse(text) as unknown;
    if (isObj(env) && typeof env.body === 'string' && typeof env.sum === 'string') {
      if (checksum(env.body) !== env.sum) return { ok: false, error: 'Checksum mismatch (file edited or corrupted)' };
      return validateState(JSON.parse(env.body));
    }
    return validateState(env); // plain exported JSON
  } catch { return { ok: false, error: 'Not valid JSON' }; }
}

const store = (): Storage | null => { try { return localStorage; } catch { return null; } };

export function writeSlot(slot: number, state: GameState): boolean {
  const ls = store(); if (!ls) return false;
  try {
    state.savedAt = Date.now(); state.version = SAVE_VERSION;
    const prev = ls.getItem(KEY(slot));
    if (prev) ls.setItem(BAK(slot), prev); // keep the previous good save as a backup
    ls.setItem(KEY(slot), serialize(state));
    return true;
  } catch { return false; }
}
export function readSlot(slot: number): Parsed | null {
  const ls = store(); if (!ls) return null;
  const raw = ls.getItem(KEY(slot));
  if (!raw) return null;
  const p = deserialize(raw);
  if (p.ok) return p;
  const bak = ls.getItem(BAK(slot));
  if (bak) { const q = deserialize(bak); if (q.ok) return q; }
  return p;
}
export function deleteSlot(slot: number) { const ls = store(); if (!ls) return; ls.removeItem(KEY(slot)); ls.removeItem(BAK(slot)); }
export function slotMeta(slot: number): SlotMeta {
  const r = readSlot(slot);
  if (!r) return { slot, empty: true };
  if (!r.ok) return { slot, empty: false, corrupt: true };
  const s = r.state;
  return { slot, empty: false, mapName: MAPS[s.mapId]?.name, chapter: s.chapter, playMs: s.playMs, savedAt: s.savedAt, levels: s.party.map((id) => ({ id, level: s.roster.find((m) => m.id === id)!.level })), balls: s.balls, version: s.version };
}
export const allSlots = () => Array.from({ length: SLOT_COUNT + 1 }, (_, i) => slotMeta(i));

export function exportText(state: GameState) { return JSON.stringify({ ...state, savedAt: Date.now() }, null, 2); }
export function importText(text: string): Parsed { return deserialize(text); }

// ---------------- legacy v2 migration ----------------
/** Old linear event index -> new story checkpoint flags. */
const LEGACY_CHECKPOINTS: { minIndex: number; flags: string[]; map: string; x: number; y: number; chapter: number }[] = [
  { minIndex: 0, flags: [], map: 'shore', x: 12, y: 15, chapter: 0 },
  { minIndex: 4, flags: ['scouts1'], map: 'shore', x: 36, y: 13, chapter: 1 },
  { minIndex: 6, flags: ['scouts1', 'dende_met', 'ball1'], map: 'village', x: 17, y: 15, chapter: 1 },
  { minIndex: 9, flags: ['scouts1', 'dende_met', 'ball1', 'vegeta_arrived', 'vegeta_joined', 'cui_done', 'dodoria_done'], map: 'landing', x: 38, y: 14, chapter: 2 },
  { minIndex: 10, flags: ['scouts1', 'dende_met', 'ball1', 'vegeta_arrived', 'vegeta_joined', 'cui_done', 'dodoria_done', 'ball2'], map: 'village', x: 24, y: 10, chapter: 2 },
  { minIndex: 12, flags: ['scouts1', 'dende_met', 'ball1', 'vegeta_arrived', 'vegeta_joined', 'cui_done', 'dodoria_done', 'ball2', 'zarbon_done'], map: 'guru', x: 20, y: 22, chapter: 2 },
  { minIndex: 14, flags: ['scouts1', 'dende_met', 'ball1', 'vegeta_arrived', 'vegeta_joined', 'cui_done', 'dodoria_done', 'ball2', 'zarbon_done', 'guru_done', 'nail_known', 'ball3'], map: 'village', x: 33, y: 24, chapter: 3 },
];

export function migrateLegacy(): { state: GameState; note: string } | null {
  const ls = store(); if (!ls) return null;
  const raw = ls.getItem(LEGACY_KEY);
  if (!raw) return null;
  try {
    ls.setItem(LEGACY_BACKUP, raw); // never mutate the original; keep an extra copy
    const old = JSON.parse(raw) as { index?: number; actors?: Record<string, { lv?: number }>; inventory?: Record<string, number>; coins?: number; balls?: number };
    if (!old || typeof old !== 'object' || typeof old.index !== 'number') return null;
    const idx = old.index;
    const cp = [...LEGACY_CHECKPOINTS].reverse().find((c) => idx >= c.minIndex) ?? LEGACY_CHECKPOINTS[0];
    const s = newGameState();
    for (const f of cp.flags) s.flags[f] = true;
    s.mapId = cp.map; s.x = cp.x; s.y = cp.y; s.chapter = cp.chapter;
    s.roster = []; s.party = [];
    const lv = (id: HeroId, dflt: number) => Math.max(1, Math.min(MAX_LEVEL, Math.round(old.actors?.[id]?.lv ?? dflt)));
    const ids: HeroId[] = ['gohan', 'krillin'];
    if (cp.flags.includes('vegeta_joined')) ids.push('vegeta');
    for (const id of ids) { const m = newMember(id, lv(id, 5)); s.roster.push(m); if (s.party.length < 3) s.party.push(id); }
    const inv = old.inventory ?? {};
    s.inventory = { medkit: Math.min(99, Math.max(0, Math.floor(inv.medkit ?? 3))), kicapsule: Math.min(99, Math.max(0, Math.floor(inv.capsule ?? 2))), senzu: Math.min(99, Math.max(0, Math.floor(inv.senzu ?? 0))) };
    s.zeni = Math.max(0, Math.min(999999, Math.floor(old.coins ?? 100)));
    syncBalls(s);
    return { state: s, note: `Imported your v2 save (event ${idx}) as a checkpoint in "${MAPS[cp.map].name}". Later story progress from the prototype is not carried over because the saga was re-sequenced. Your original save is untouched.` };
  } catch { return null; }
}
