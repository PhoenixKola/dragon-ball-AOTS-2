// Shared contracts for combat, animation, world and save data.

export type Side = 'ally' | 'enemy';
export type HeroId = 'trunks' | 'gohan' | 'krillin' | 'vegeta' | 'goku' | 'piccolo' | 'dende' | 'nail';
export type StatKey = 'hp' | 'ki' | 'atk' | 'def' | 'spd';
export type Stats = Record<StatKey, number>;

export type TargetMode = 'enemy' | 'allEnemies' | 'ally' | 'allAllies' | 'self' | 'downedAlly';
export type SkillKind = 'damage' | 'heal' | 'status' | 'buff' | 'revive' | 'special';
export type Element = 'phys' | 'ki' | 'energy';

export type StatusKind =
  | 'stun'      // skips next action
  | 'blind'     // physical/ki attacks may miss
  | 'seal'      // cannot use Ki skills
  | 'atkUp' | 'defUp' | 'atkDown' | 'defDown' | 'spdUp'
  | 'regen'
  | 'frozen'    // time-stop (Guldo): skips actions, breaks when the caster is hurt
  | 'charging'  // telegraphed charge before a heavy attack
  | 'counter'   // counter stance: reflects physical hits
  | 'sparking'  // personal power-up mode
  | 'possessed' // body-changed: acts for the enemy
  | 'kaioken'
  | 'ssjform';   // Future Trunks' battle-long Super Saiyan state (never shared with Goku's `ssj` flag)

export interface StatusEffect {
  kind: StatusKind;
  turns: number;
  power?: number;
  source?: string;
  fresh?: boolean; // applied during the owner's own turn: skip the first tick
}

export interface SkillStatus {
  kind: StatusKind;
  turns: number;
  chance: number; // 0..1
  power?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  desc: string;
  kind: SkillKind;
  target: TargetMode;
  element: Element;
  cost: number;          // Ki
  power: number;         // multiplier on attacker ATK (damage) or flat heal fraction of target max HP (heal)
  hits: number[];        // per-hit damage fraction; one animation hit marker per entry
  rageGain: number;
  clip: string;          // animation clip id (see engine/animation/clips)
  vfx: string;           // projectile / impact family id
  sfx: string;
  icon: string;
  unlockLevel: number;
  guardable: boolean;    // enemy skills: can be Active-Guarded
  pierce?: number;       // fraction of DEF ignored
  status?: SkillStatus;
  hpCostFrac?: number;   // fraction of current HP sacrificed (Kaioken)
  rageArt?: boolean;     // personal ultra technique, consumes full Rage
  chargeTurns?: number;  // enemy telegraph: spend N turns charging first
  ssjOnly?: boolean;     // Super Saiyan Trunks only: equippable anywhere, usable only while the form is active
  baseOnly?: boolean;    // replaced by a Super Saiyan version: not available while Goku is Super Saiyan
  role?: string;         // loadout label: Beam, Barrage, Area, Support, Heal, Buff, Debuff, Counter, Finisher
  postgame?: boolean;    // learned through postgame training (level 23+), shown with a badge
}

export interface HeroDef {
  id: HeroId;
  name: string;
  portrait: string;
  sprite: string;
  color: string;
  base: Stats;
  growth: Stats;
  skills: string[];       // library: the first `signature` ids are the original signature moves (default loadout fills with them first), the rest are the v5 library
  signature: number;
  extra?: string[];       // always-available skills that never use a loadout slot (Trunks' Super Saiyan transformation)
  rageArt: string;
  attackClip: string;
  heightPx: number;       // on-screen standing height at logical battle resolution
  role: string;
}

export type AiPattern =
  | { kind: 'weighted' }
  | { kind: 'cycle'; moves: string[] };

export interface EnemyPhase {
  atHpFrac: number;           // triggers when hp/hpMax <= this
  toForm?: string;            // swap to another form id (sprite, stats, moves)
  healFrac?: number;
  message: string;
  addStatus?: StatusEffect;
}

export interface EnemyMoveDef {
  skill: string;
  weight: number;
  when?: 'always' | 'bothAlive' | 'afterCharge' | 'hpBelowHalf' | 'noCounter' | 'partyRageHigh';
}

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  stats: Stats;
  exp: number;
  zeni: number;
  heightPx: number;
  moves: EnemyMoveDef[];
  pattern?: AiPattern;
  phases?: EnemyPhase[];
  boss?: boolean;
  intro?: string;
  theme?: 'battle' | 'boss' | 'frieza' | 'ginyu' | 'cooler';
  role: string;
  drops?: { item: string; chance: number }[];
}

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  hp?: number;
  ki?: number;
  full?: boolean;
  revive?: boolean;
  cure?: boolean;
  price?: number;
  capsule?: Partial<Stats> & { rageGain?: number };
}

// ---- runtime combat ----
export interface Fighter {
  uid: string;
  defId: string;            // hero id or enemy id
  side: Side;
  name: string;
  sprite: string;
  slot: number;
  level: number;
  stats: Stats;             // max values (hp,ki are maxima)
  hp: number;
  ki: number;
  rage: number;
  statuses: StatusEffect[];
  defending: boolean;
  alive: boolean;
  skills: string[];
  heightPx: number;
  form: string;
  phaseIdx: number;
  chargedMove?: string;     // enemy mid-charge
  chargeLeft?: number;
  turnsTaken: number;
  boss: boolean;
  chargeDmg: number;        // damage taken while charging (interrupt tracking)
  rageGainMult: number;     // capsule bonus
  ssj: boolean;             // Goku Super Saiyan form flag
  actedThisRound: boolean;
  defendStreak?: number;    // consecutive Defend commands (Rage is only granted for the first)
}

export type GuardGrade = 'perfect' | 'good' | 'none';

export interface HitStep {
  index: number;
  actorId: string;
  targetId: string;
  skillId: string;
  hitFrac: number;
  last: boolean;
}

export interface HitResult {
  step: HitStep;
  damage: number;
  heal: number;
  crit: boolean;
  missed: boolean;
  guard: GuardGrade;
  countered: number;
  killed: boolean;
  statusApplied?: StatusKind;
  targetHp: number;
  actorHp: number;
  message?: string;
}

export interface ActionPlan {
  id: number;
  actorId: string;
  skillId: string;
  comboId?: string;
  targetIds: string[];
  steps: HitStep[];
  guardTargets: string[];   // ally uids that will be threatened (enemy attacks)
  isItem?: string;
  charging?: boolean;       // this action is a telegraph only
}

export type Command =
  | { kind: 'attack'; target: string }
  | { kind: 'skill'; skill: string; target?: string }
  | { kind: 'defend' }
  | { kind: 'item'; item: string; target: string }
  | { kind: 'sparking' }
  | { kind: 'combo'; combo: string; target?: string }
  | { kind: 'flee' };

export type BattleOutcome = 'ongoing' | 'victory' | 'defeat' | 'fled';

export interface BattleLogEntry { text: string; tone?: 'info' | 'good' | 'bad' | 'warn' }
