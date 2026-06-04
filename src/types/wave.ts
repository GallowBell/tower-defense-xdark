// Wave-related types

import type { EnemyArchetype } from './enemy';

export interface SpawnEntry {
  archetype: EnemyArchetype;
  count: number;
  /** Seconds between spawns */
  interval: number;
}

export interface WaveDefinition {
  index: number;
  entries: SpawnEntry[];
  /** Bonus gold awarded on wave clear */
  goldBonus: number;
}
