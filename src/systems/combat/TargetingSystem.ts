import type { TowerState } from '../../types/tower';
import type { EnemyState } from '../../types/enemy';

export class TargetingSystem {
  /**
   * For a single tower, find the best target from a list of active enemies.
   *
   * Rules:
   *   1. Exclude dead and leaked enemies
   *   2. Exclude enemies outside tower's range (Euclidean distance between
   *      tower world pos and enemy world pos > tower.definition.range)
   *   3. Among remaining candidates, pick the enemy with the HIGHEST
   *      waypointIndex (furthest along the path = "first" targeting strategy)
   *   4. If two enemies share the same waypointIndex, pick the one closer
   *      to its next waypoint — approximate by comparing distance to tower
   *      (closer to exit = further from spawn = lower distance to tower
   *      is a fine tie-breaker: pick LOWEST distance to tower)
   *   5. Return null if no valid target found
   */
  findTarget(tower: TowerState, enemies: EnemyState[]): EnemyState | null {
    let best: EnemyState | null = null;
    let bestDist = Infinity;

    for (const enemy of enemies) {
      // Rule 1: skip dead and leaked
      if (enemy.dead || enemy.leaked) continue;

      // Rule 2: check range
      const dx = enemy.x - tower.worldX;
      const dy = enemy.y - tower.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > tower.definition.range) continue;

      // Rules 3 & 4: pick highest waypointIndex; tie-break on lowest distance
      if (best === null) {
        best = enemy;
        bestDist = dist;
      } else if (enemy.waypointIndex > best.waypointIndex) {
        best = enemy;
        bestDist = dist;
      } else if (enemy.waypointIndex === best.waypointIndex && dist < bestDist) {
        best = enemy;
        bestDist = dist;
      }
    }

    return best;
  }
}
