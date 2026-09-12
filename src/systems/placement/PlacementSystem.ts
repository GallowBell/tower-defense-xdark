import type { TowerArchetype, TowerState, TowerDefinition } from '../../types/tower';
import type { MapDefinition } from '../../data/mapDefinitions';
import type { GameState, Vec2 } from '../../types/game';
import { isBuildable, gridToWorld } from '../../utils/grid';
import { TOWER_DEFINITIONS } from '../../entities/towers/towerDefinitions';

/** Why a tower cannot go on a tile. */
export type PlacementRejection =
  | 'not_buildable'
  | 'occupied'
  | 'insufficient_gold'
  | 'invalid_state';

export interface PlacementResult {
  success: boolean;
  reason?: PlacementRejection;
  tower?: TowerState;
  goldSpent?: number;
}

/**
 * Decide whether a tower may go on a tile, without building anything.
 *
 * Split out of `attempt` so the build preview can ask the same question the
 * click will answer. Duplicating these rules in the renderer would be worse
 * than having no preview at all: a ghost that shows green where the click is
 * refused actively lies to the player.
 *
 * @returns the reason it is refused, or null when the tile is good.
 */
export function validatePlacement(
  map: MapDefinition,
  existingTowers: TowerState[],
  gold: number,
  gameState: GameState,
  gridX: number,
  gridY: number,
  archetype: TowerArchetype,
): PlacementRejection | null {
  if (!BUILDABLE_STATES.includes(gameState)) return 'invalid_state';
  if (!isBuildable(map, gridX, gridY)) return 'not_buildable';
  if (existingTowers.some(t => t.gridX === gridX && t.gridY === gridY)) return 'occupied';
  if (gold < TOWER_DEFINITIONS[archetype].cost) return 'insufficient_gold';
  return null;
}

/**
 * States the player is allowed to build in.
 *
 * 'wave_active' is included deliberately: gold earned mid-wave used to be dead
 * weight until the wave ended, and a leak was something you could only watch.
 */
const BUILDABLE_STATES: readonly GameState[] = ['idle', 'wave_cleared', 'wave_active'];

export class PlacementSystem {
  private nextUid = 0;

  /** Returns a PlacementResult — does NOT mutate any external state */
  attempt(
    map: MapDefinition,
    existingTowers: TowerState[],
    gold: number,
    gameState: GameState,
    gridX: number,
    gridY: number,
    archetype: TowerArchetype,
  ): PlacementResult {
    const rejection = validatePlacement(
      map, existingTowers, gold, gameState, gridX, gridY, archetype,
    );
    if (rejection !== null) return { success: false, reason: rejection };

    const def: TowerDefinition = TOWER_DEFINITIONS[archetype];
    const pos: Vec2 = gridToWorld(gridX, gridY);
    const tower: TowerState = {
      uid: `tower_${this.nextUid++}`,
      archetype,
      gridX,
      gridY,
      worldX: pos.x,
      worldY: pos.y,
      cooldown: 0,
      targetUid: null,
      level: 1,
      investedGold: def.cost,
      baseDefinition: def,
      definition: def,
    };
    return { success: true, tower, goldSpent: def.cost };
  }
}
