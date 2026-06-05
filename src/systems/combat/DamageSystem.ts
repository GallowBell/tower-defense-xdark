import type { TowerState } from '../../types/tower';
import type { EnemyState } from '../../types/enemy';

export interface DamageResult {
  /** True if the enemy died from this hit */
  killed: boolean;
  /** Gold reward — set to enemy.reward only when killed, else 0 */
  goldEarned: number;
}

export class DamageSystem {
  /**
   * Apply tower damage to target enemy. Mutates enemy.hp and enemy.dead.
   *
   * Rules:
   *   1. Subtract tower.definition.damage from enemy.hp
   *   2. Clamp enemy.hp to minimum 0
   *   3. If hp reaches 0: set enemy.dead = true
   *   4. Return { killed: true, goldEarned: enemy.reward } if killed
   *   5. Return { killed: false, goldEarned: 0 } otherwise
   */
  applyHit(tower: TowerState, enemy: EnemyState): DamageResult {
    enemy.hp -= tower.definition.damage;

    // Rule 2: clamp to 0
    if (enemy.hp < 0) enemy.hp = 0;

    // Rule 3: check for death
    if (enemy.hp === 0) {
      enemy.dead = true;
      return { killed: true, goldEarned: enemy.reward };
    }

    return { killed: false, goldEarned: 0 };
  }
}
