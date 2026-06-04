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
  definition: TowerDefinition;
}
