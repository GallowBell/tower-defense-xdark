import type { TowerArchetype, TowerState, TowerDefinition } from '../../types/tower';
import type { MapDefinition } from '../../data/mapDefinitions';
import type { GameState, Vec2 } from '../../types/game';
import { isBuildable, gridToWorld } from '../../utils/grid';
import { TOWER_DEFINITIONS } from '../../entities/towers/towerDefinitions';

export interface PlacementResult {
  success: boolean;
  reason?: 'not_buildable' | 'occupied' | 'insufficient_gold' | 'invalid_state';
  tower?: TowerState;
  goldSpent?: number;
}

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
    if (gameState !== 'idle' && gameState !== 'wave_cleared') {
      return { success: false, reason: 'invalid_state' };
    }
    if (!isBuildable(map, gridX, gridY)) {
      return { success: false, reason: 'not_buildable' };
    }
    if (existingTowers.some(t => t.gridX === gridX && t.gridY === gridY)) {
      return { success: false, reason: 'occupied' };
    }
    const def: TowerDefinition = TOWER_DEFINITIONS[archetype];
    if (gold < def.cost) {
      return { success: false, reason: 'insufficient_gold' };
    }
    const pos: Vec2 = gridToWorld(gridX, gridY);
    const tower: TowerState = {
      uid: `tower_${this.nextUid++}`,
      archetype,
      gridX,
      gridY,
      worldX: pos.x,
      worldY: pos.y,
      cooldown: 0,
      definition: def,
    };
    return { success: true, tower, goldSpent: def.cost };
  }
}
