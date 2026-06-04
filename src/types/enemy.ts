// Enemy-related types

export type EnemyId = string & { __brand: 'EnemyId' };

export type EnemyArchetype = 'basic' | 'fast' | 'tank';

export interface EnemyDefinition {
  id: EnemyArchetype;
  displayName: string;
  hp: number;
  speed: number;
  reward: number;
  radius: number;
  /** Phaser hex color, e.g. 0xef4444 */
  color: number;
}

export interface EnemyState {
  uid: EnemyId;
  archetype: EnemyArchetype;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  waypointIndex: number;
  x: number;
  y: number;
  radius: number;
  color: number;
  dead: boolean;
  leaked: boolean;
}
