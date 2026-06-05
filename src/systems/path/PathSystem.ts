import type { Vec2 } from '../../types/game';
import type { EnemyState } from '../../types/enemy';

/**
 * Pure-TS PathSystem — no Phaser dependency.
 * Moves an EnemyState along a sequence of world-pixel waypoints.
 */
export class PathSystem {
  /**
   * Advance a single enemy along its waypoint path by `dt` seconds.
   * Mutates `enemy.x`, `enemy.y`, `enemy.waypointIndex`, and `enemy.leaked`.
   *
   * Algorithm:
   *   1. While the enemy still has dt budget left:
   *      a. Target = worldWaypoints[waypointIndex]
   *      b. Compute distance to target
   *      c. If distance <= pixels to travel this tick → arrive, subtract
   *         consumed distance from dt budget, increment waypointIndex
   *         (if now past final waypoint: set leaked=true and return)
   *      d. Else: move enemy towards target by full dt budget and return
   *   2. enemy.leaked is set to true when waypointIndex >= worldWaypoints.length
   */
  advance(enemy: EnemyState, worldWaypoints: Vec2[], dt: number): void {
    // Already leaked or dead — nothing to do
    if (enemy.leaked || enemy.dead) return;
    // Zero speed enemy never moves
    if (enemy.speed <= 0) return;

    let remaining = dt;

    while (remaining > 0) {
      // Passed all waypoints → leaked
      if (enemy.waypointIndex >= worldWaypoints.length) {
        enemy.leaked = true;
        return;
      }

      const target = worldWaypoints[enemy.waypointIndex];
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Pixels available in this remaining budget
      const pixelsAvailable = enemy.speed * remaining;

      if (dist <= 0) {
        // Already at waypoint — advance to next without consuming budget
        enemy.waypointIndex += 1;
        if (enemy.waypointIndex >= worldWaypoints.length) {
          enemy.leaked = true;
          return;
        }
        continue;
      }

      if (dist <= pixelsAvailable) {
        // Arrive exactly at waypoint
        enemy.x = target.x;
        enemy.y = target.y;

        // Subtract only the time consumed to reach this waypoint
        remaining -= dist / enemy.speed;

        enemy.waypointIndex += 1;
        if (enemy.waypointIndex >= worldWaypoints.length) {
          enemy.leaked = true;
          return;
        }
        // Continue loop to consume remaining budget on next waypoint
      } else {
        // Move toward target, exhaust remaining budget
        const ratio = pixelsAvailable / dist;
        enemy.x += dx * ratio;
        enemy.y += dy * ratio;
        remaining = 0;
      }
    }
  }
}
