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
  /** Enemies other than the target caught in the blast (splash towers only) */
  splashHits: EnemyState[];
  /** Splash victims that died from this shot */
  splashKills: EnemyState[];
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
   *   2. Find a target via TargetingSystem.findTarget() and record it on the
   *      tower as targetUid — every tick, reloading or not
   *   3. If cooldown > 0: skip (tower still reloading)
   *   4. If target found:
   *      a. Apply damage via DamageSystem.applyHit(), passing the enemy list
   *         so splash towers can catch everything around the target
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

      // Step 2: acquire a target BEFORE the reload check, and remember it.
      // Renderers aim at tower.targetUid, so it has to stay current while the
      // tower is reloading — otherwise the barrel tracks a corpse. Targeting is
      // a distance check per live enemy, so running it every tick is cheap.
      const target = this.targeting.findTarget(tower, enemies);
      tower.targetUid = target?.uid ?? null;

      // Step 3: if still reloading, or nothing in range, do not fire
      if (tower.cooldown > 0) continue;
      if (target === null) continue;

      // Step 4a: apply damage — the full enemy list feeds splash towers
      const result = this.damage.applyHit(tower, target, enemies);

      // Step 4b: emit ShotEvent
      events.push({
        tower,
        target,
        killed: result.killed,
        goldEarned: result.goldEarned,
        damageDealt: result.damageDealt,
        wasCrit: result.wasCrit,
        splashHits: result.splashHits,
        splashKills: result.splashKills,
      });

      // Step 4c: reset cooldown
      tower.cooldown = 1 / tower.definition.fireRate;
    }

    return events;
  }
}
