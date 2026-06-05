// Tower-related types

export type TowerArchetype = 'basic' | 'fast' | 'heavy';

export interface TowerDefinition {
  id: TowerArchetype;
  displayName: string;
  cost: number;
  damage: number;
  range: number;
  /** Shots per second */
  fireRate: number;
  /** Critical hit chance (0 to 1) */
  critRate: number;
  /** Critical hit damage multiplier */
  critDamage: number;
  color: number;
  radius: number;
}

export interface TowerState {
  uid: string;
  archetype: TowerArchetype;
  gridX: number;
  gridY: number;
  worldX: number;
  worldY: number;
  /** Time remaining until next shot, in seconds */
  cooldown: number;
  /** Upgrade level (1-based) */
  level: number;
  definition: TowerDefinition;
}
