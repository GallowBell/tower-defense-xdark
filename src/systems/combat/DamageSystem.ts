import type { TowerState } from '../../types/tower';
import type { EnemyState } from '../../types/enemy';

export interface DamageResult {
  /** True if the primary target died from this hit */
  killed: boolean;
  /** Gold reward — the primary target's reward plus any splash kills */
  goldEarned: number;
  /** Damage actually dealt to the primary target, after crit and armor */
  damageDealt: number;
  /** Whether this hit was a critical strike */
  wasCrit: boolean;
  /** Enemies other than the primary caught in the blast */
  splashHits: EnemyState[];
  /** Splash victims that died from this hit */
  splashKills: EnemyState[];
}

export class DamageSystem {
  /**
   * Apply tower damage to target enemy. Mutates enemy.hp and enemy.dead.
   *
   * Rules:
   *   1. Roll random (0-1). If < critRate, multiply damage by critDamage
   *   2. Subtract the enemy's armor; a hit always lands for at least 1
   *   3. Subtract the result from enemy.hp, clamped to a minimum of 0
   *   4. If hp reaches 0: set enemy.dead = true
   *   5. If the tower has a splashRadius, deal the same pre-armor damage to
   *      every other live enemy within that radius of the primary target
   *   6. Return a DamageResult covering the primary target and the blast
   *
   * The crit is rolled once and applies to the whole blast. Armor is applied
   * per victim, so a Cannon shell that shrugs off a Brute's armor still only
   * grazes it for the same reduction on every enemy it catches.
   *
   * @param enemies every active enemy — only consulted for splash damage.
   */
  applyHit(
    tower: TowerState,
    enemy: EnemyState,
    enemies: EnemyState[] = [],
  ): DamageResult {
    const def = tower.definition;
    const isCrit = Math.random() < def.critRate;
    const rawDamage = isCrit
      ? Math.floor(def.damage * def.critDamage)
      : def.damage;

    const damageDealt = this.damageEnemy(enemy, rawDamage);
    const killed = enemy.hp === 0;
    let goldEarned = killed ? enemy.reward : 0;

    const splashHits: EnemyState[] = [];
    const splashKills: EnemyState[] = [];

    if (def.splashRadius > 0) {
      for (const other of enemies) {
        if (other === enemy || other.dead || other.leaked) continue;

        const dx = other.x - enemy.x;
        const dy = other.y - enemy.y;
        if (Math.sqrt(dx * dx + dy * dy) > def.splashRadius) continue;

        this.damageEnemy(other, rawDamage);
        splashHits.push(other);

        if (other.hp === 0) {
          splashKills.push(other);
          goldEarned += other.reward;
        }
      }
    }

    return {
      killed,
      goldEarned,
      damageDealt,
      wasCrit: isCrit,
      splashHits,
      splashKills,
    };
  }

  /**
   * Apply one enemy's share of a hit: armor first, then hp.
   * @returns the damage that actually landed.
   */
  private damageEnemy(enemy: EnemyState, rawDamage: number): number {
    const dealt = Math.max(1, rawDamage - enemy.armor);
    enemy.hp = Math.max(0, enemy.hp - dealt);
    if (enemy.hp === 0) enemy.dead = true;
    return dealt;
  }
}
