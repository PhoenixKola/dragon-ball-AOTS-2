import type { HeroId } from '../../types';
import type { StageKind } from '../scenes/stageBackgrounds';

export const TILE = 32;

/** Story condition: every `flag` set, no `not` flag set. */
export interface Cond { flag?: string | string[]; not?: string | string[]; has?: Record<string, number> }   // `has`: inventory holds at least this many of each item

export type EntKind = 'npc' | 'chest' | 'exit' | 'trigger' | 'save' | 'heal' | 'ball' | 'foe' | 'sign' | 'shop' | 'prop';

export interface Ent {
  id: string;
  kind: EntKind;
  x: number; y: number;          // tile coordinates (feet / zone centre)
  w?: number; h?: number;        // zone size in tiles (triggers, exits)
  obj?: string;                  // atlas object name (sprite)
  ow?: string;                   // overworld character set (validated 4-direction frames), e.g. 'bulma'
  scale?: number;
  flip?: boolean;
  label?: string;
  when?: Cond;                   // entity exists only while true
  script?: string;               // id in SCRIPTS
  exit?: { map: string; x: number; y: number };
  lock?: { cond: Cond; msg: string };   // exit is blocked until cond holds
  chest?: { items?: Record<string, number>; zeni?: number };
  foe?: { foes: string[]; patrol?: [number, number][]; title?: string; once?: boolean; hp?: number; atk?: number };
  dirs?: { down: string; up: string; side: string }; // npc sprites per facing
  solid?: [number, number];
}

export interface ObjDef { o: string; x: number; y: number; s: number; solid?: [number, number]; flip?: boolean; tint?: number; depthBias?: number }

export interface MapDef {
  id: string;
  name: string;
  sub: string;
  w: number; h: number;
  ground: string[];              // chars: . grass, , dirt, ~ water, m metal, c cave floor, r scorched rock, x void
  objs: ObjDef[];
  ents: Ent[];
  spawn: { x: number; y: number };
  music: string;
  stage: StageKind;
  sky: 'day' | 'ship' | 'cave' | 'final' | 'ice';
  encounters?: { zones: [number, number, number, number][]; table: { foes: string[]; weight: number; minChapter?: number; maxChapter?: number; hp?: number; atk?: number }[] };
  safe?: boolean;
}

export type Speaker = string;
export type Line = [Speaker, string];

export interface BattleSpec {
  foes: string[];
  stage?: StageKind;
  title?: string;
  party?: HeroId[];                    // forced roster (story-justified); otherwise the player's party
  guests?: { id: HeroId; level?: number }[];
  surviveRounds?: number;              // battle counts as won once this many rounds have passed
  scriptedEnd?: { defId: string; hpFrac: number };
  allowFlee?: boolean;
  noGameOver?: boolean;                // defeat continues the story with the party restored
  theme?: 'battle' | 'boss' | 'frieza' | 'ginyu' | 'final' | 'cooler';
  intro?: string;
  tutorial?: boolean;
  noRewards?: boolean;                 // training rematch: no XP, Zeni or drops
  tag?: string;                        // postgame bookkeeping (e.g. 'cooler'): best clear, win counters
  hp?: number;                         // tuned enemy HP multiplier (see docs/BALANCE_TABLE.md)
  atk?: number;                        // tuned enemy ATK multiplier
}

export type Step =
  | { say: Line[] }
  | { set: string | string[] }
  | { clear: string | string[] }
  | { battle: BattleSpec; win?: Step[]; lose?: Step[] }
  | { give: Record<string, number> }
  | { zeni: number }
  | { ball: number }
  | { join: HeroId; level?: number; fused?: boolean }
  | { leave: HeroId }
  | { warp: { map: string; x: number; y: number } }
  | { cutscene: string }
  | { transform: 'ssj' }
  | { heal: true }
  | { restore: number }                // heals this fraction (0-1) of every hero's MISSING HP and Ki
  | { training: number }
  | { chapter: number }
  | { music: string }
  | { toast: string }
  | { ending: true }
  | { porunga: true }                               // opens Porunga's summoning (postgame; needs all seven balls)
  | { if: Cond; then: Step[]; else?: Step[] }
  | { shop: string }
  | { unlockCombo: string }
  | { fade: 'out' | 'in' }
  | { run: string }
  | { wait: number }
  | { xp: number }                                  // shared XP for the whole roster (milestones, quest rewards)
  | { take: Record<string, number> }                // consume inventory items (use behind an `if` with `has`)
  | { quest: { id: string; do: 'start' | 'complete' } }
  | { party: HeroId[] }                            // story lineup: only joined heroes, 1 to 3
  | { radar: string }                               // the named speaker reads out where the missing Dragon Balls are (only places already unlocked)
  | { ask: { text: string; yes: string; no: string; onNo: Step[] } };   // Continue / Cancel prompt; Cancel runs onNo and ends the script
