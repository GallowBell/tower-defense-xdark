/**
 * Enemy archetypes and their static data.
 * Runtime enemy instances read these definitions to initialise their stats.
 */

export type EnemyArchetype = 'basic' | 'fast' | 'tank';

export interface EnemyDefinition {
  /** Matches the EnemyArchetype key — used for lookups. */
  id: EnemyArchetype;
  /** Human-readable name shown in the UI. */
  displayName: string;
  /** Maximum (and starting) hit-points. */
  hp: number;
  /** Movement speed in pixels per second. */
  speed: number;
  /** Gold awarded to the player on kill. */
  reward: number;
  /** Sprite / collision circle radius in pixels. */
  radius: number;
  /** Hex colour used for the enemy's rendered circle. */
  color: number;
}

export const ENEMY_DEFINITIONS: Record<EnemyArchetype, EnemyDefinition> = {
  basic: {
    id: 'basic',
    displayName: 'Grunt',
    hp: 80,
    speed: 80,
    reward: 10,
    radius: 12,
    color: 0xef4444,
  },
  fast: {
    id: 'fast',
    displayName: 'Runner',
    hp: 40,
    speed: 160,
    reward: 8,
    radius: 10,
    color: 0xf97316,
  },
  tank: {
    id: 'tank',
    displayName: 'Brute',
    hp: 300,
    speed: 40,
    reward: 25,
    radius: 16,
    color: 0x6b21a8,
  },
};
