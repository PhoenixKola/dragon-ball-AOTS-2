import type { Ent, MapDef } from './mapTypes';
import type { GameState } from '../../systems/gameState';

/** The only way the world scene talks to the app: typed callbacks, one source of truth (GameState). */
export interface WorldContext {
  map: MapDef;
  getState(): GameState;
  /** False once a newer world scene has been requested: a scene that is about to be replaced must not touch the game state. */
  isCurrent(): boolean;
  version(): number;               // bumps whenever flags/inventory change so the scene can refresh entities
  locked(): boolean;
  leadSprite(): string;            // battle-sprite fallback
  leadOverworld(): { entity: string; provisional: boolean } | null;
  encounterMultiplier(): number;   // 0 = off
  onInteract(e: Ent): void;
  onZone(e: Ent): void;
  onFoe(e: Ent): void;
  onEncounter(): void;
  onStep(): void;
}
