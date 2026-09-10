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
  /** Blast radius in pixels. 0 means the tower only hits its target. */
  splashRadius: number;
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
  /** Total gold sunk into this tower: purchase price plus every upgrade paid for. */
  investedGold: number;
  /**
   * The archetype's level-1 stats, never mutated. Upgrades are always derived
   * from this, so the curve cannot compound on its own output.
   */
  baseDefinition: TowerDefinition;
  /** Current stats: baseDefinition adjusted for the tower's level. */
  definition: TowerDefinition;
}
