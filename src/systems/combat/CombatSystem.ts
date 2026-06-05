import type { TowerState } from '../../types/tower';
import type { EnemyState } from '../../types/enemy';
import { TargetingSystem } from './TargetingSystem';
import { DamageSystem } from './DamageSystem';

export interface ShotEvent {
  /** Tower that fired */
  tower: TowerState;
  /** Enemy that was hit */
  target: EnemyState;
  /** Whether the shot killed the enemy */
  killed: boolean;
  /** Gold earned from this shot (0 if not killed) */
  goldEarned: number;
  /** Actual damage dealt (after crit multiplier) */
  damageDealt: number;
  /** Whether this shot was a critical hit */
  wasCrit: boolean;
}

export class CombatSystem {
  private targeting: TargetingSystem;
  private damage: DamageSystem;

  constructor() {
    this.targeting = new TargetingSystem();
    this.damage = new DamageSystem();
  }

  /**
   * Tick all towers for dt seconds.
   *
   * For each tower:
   *   1. Decrement tower.cooldown by dt (clamp to 0)
   *   2. If cooldown > 0: skip (tower still reloading)
   *   3. Find target via TargetingSystem.findTarget()
   *   4. If target found:
   *      a. Apply damage via DamageSystem.applyHit()
   *      b. Emit a ShotEvent (push to returned array)
   *      c. Reset tower.cooldown = 1 / tower.definition.fireRate
   *   5. If no target: do nothing (cooldown stays 0, ready to fire)
   *
   * Returns array of ShotEvents that occurred this tick.
   * NOTE: A tower fires AT MOST ONCE per tick regardless of dt size.
   */
  tick(towers: TowerState[], enemies: EnemyState[], dt: number): ShotEvent[] {
    const events: ShotEvent[] = [];

    for (const tower of towers) {
      // Step 1: decrement cooldown, clamp to 0
      tower.cooldown = Math.max(0, tower.cooldown - dt);

      // Step 2: if still reloading, skip
      if (tower.cooldown > 0) continue;

      // Step 3: find target
      const target = this.targeting.findTarget(tower, enemies);
      if (target === null) continue;

      // Step 4a: apply damage
      const result = this.damage.applyHit(tower, target);

      // Step 4b: emit ShotEvent
      events.push({
        tower,
        target,
        killed: result.killed,
        goldEarned: result.goldEarned,
        damageDealt: result.damageDealt,
        wasCrit: result.wasCrit,
      });

      // Step 4c: reset cooldown
      tower.cooldown = 1 / tower.definition.fireRate;
    }

    return events;
  }
}
