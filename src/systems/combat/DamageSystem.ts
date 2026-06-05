import type { TowerState } from '../../types/tower';
import type { EnemyState } from '../../types/enemy';

export interface DamageResult {
  /** True if the enemy died from this hit */
  killed: boolean;
  /** Gold reward — set to enemy.reward only when killed, else 0 */
  goldEarned: number;
  /** Actual damage dealt after crit multiplier */
  damageDealt: number;
  /** Whether this hit was a critical strike */
  wasCrit: boolean;
}

export class DamageSystem {
  /**
   * Apply tower damage to target enemy. Mutates enemy.hp and enemy.dead.
   * Rolls for critical hit based on tower.definition.critRate.
   *
   * Rules:
   *   1. Roll random (0-1). If < critRate, multiply damage by critDamage
   *   2. Subtract final damage from enemy.hp
   *   3. Clamp enemy.hp to minimum 0
   *   4. If hp reaches 0: set enemy.dead = true
   *   5. Return DamageResult with damageDealt, wasCrit, killed, goldEarned
   */
  applyHit(tower: TowerState, enemy: EnemyState): DamageResult {
    const def = tower.definition;
    const isCrit = Math.random() < def.critRate;
    const damage = isCrit ? Math.floor(def.damage * def.critDamage) : def.damage;

    enemy.hp -= damage;
    if (enemy.hp < 0) enemy.hp = 0;

    if (enemy.hp === 0) {
      enemy.dead = true;
      return { killed: true, goldEarned: enemy.reward, damageDealt: damage, wasCrit: isCrit };
    }

    return { killed: false, goldEarned: 0, damageDealt: damage, wasCrit: isCrit };
  }
}