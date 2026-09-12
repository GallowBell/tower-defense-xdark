/**
 * Tower archetypes and their static data.
 * The placement and combat systems read these definitions to initialise towers.
 */

export type TowerArchetype = 'basic' | 'fast' | 'heavy';

export interface TowerDefinition {
  /** Matches the TowerArchetype key — used for lookups. */
  id: TowerArchetype;
  /** Human-readable name shown in the UI. */
  displayName: string;
  /** Gold cost to place this tower. */
  cost: number;
  /** Damage dealt per projectile hit. */
  damage: number;
  /** Attack range radius in pixels. */
  range: number;
  /** Attacks per second. */
  fireRate: number;
  /** Critical hit chance (0 to 1) */
  critRate: number;
  /** Critical hit damage multiplier */
  critDamage: number;
  /** Blast radius in pixels. 0 means the tower only hits its target. */
  splashRadius: number;
  /** Hex colour used for the tower's rendered circle. */
  color: number;
  /** Sprite / collision circle radius in pixels. */
  radius: number;
}

export const TOWER_DEFINITIONS: Record<TowerArchetype, TowerDefinition> = {
  basic: {
    id: 'basic',
    displayName: 'Archer',
    cost: 100,
    damage: 20,
    range: 160,
    fireRate: 1.5,
    critRate: 0.1,
    critDamage: 1.5,
    splashRadius: 0,
    color: 0x3b82f6,
    radius: 14,
  },
  fast: {
    id: 'fast',
    displayName: 'Gunner',
    cost: 75,
    damage: 8,
    range: 120,
    fireRate: 4.0,
    critRate: 0.2,
    critDamage: 2.0,
    splashRadius: 0,
    color: 0x22c55e,
    radius: 12,
  },
  heavy: {
    id: 'heavy',
    displayName: 'Cannon',
    cost: 175,
    damage: 80,
    range: 200,
    fireRate: 0.5,
    critRate: 0.05,
    critDamage: 3.0,
    // Just over one tile (48px): the Cannon's answer to massed waves, and the
    // reason it earns its price despite the worst raw damage-per-gold.
    splashRadius: 60,
    color: 0xeab308,
    radius: 16,
  },
};
