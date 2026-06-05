export interface Projectile {
  uid: string;
  startX: number;
  startY: number; // tower position
  targetX: number;
  targetY: number; // enemy position at fire time
  targetUid: string; // enemy to track
  progress: number; // 0..1 along the path
  speed: number; // units per second (e.g. 500 px/s)
  color: number; // color of the projectile dot
  alive: boolean;
}

export interface ActiveEnemy {
  uid: string;
  x: number;
  y: number;
  dead: boolean;
}

/**
 * Manages projectiles that fly from tower to enemy.
 * Each projectile tracks its target enemy and moves toward it.
 * If the target dies mid-flight, the projectile still travels to its last known pos.
 */
export class ProjectileSystem {
  private projectiles: Projectile[] = [];
  private nextUid: number = 0;

  /**
   * Fire a projectile from (sx, sy) toward target enemy.
   * @param sx — source x (tower)
   * @param sy — source y (tower)
   * @param target — the target enemy's current state
   * @param color — color of the projectile dot
   * @returns the created projectile uid
   */
  fire(
    sx: number,
    sy: number,
    target: { uid: string; x: number; y: number },
    color: number,
  ): string {
    const uid = `proj_${this.nextUid++}`;
    this.projectiles.push({
      uid,
      startX: sx,
      startY: sy,
      targetX: target.x,
      targetY: target.y,
      targetUid: target.uid,
      progress: 0,
      speed: 500,
      color,
      alive: true,
    });
    return uid;
  }

  /**
   * Advance all projectiles by dt seconds.
   * Projectiles move toward their target's current position (tracking).
   * @param dt — delta time in seconds
   * @param enemies — current enemy states array, used for tracking live targets
   * @returns array of projectiles that REACHED their target this tick
   *          (these projectiles are marked dead and should be processed by the caller)
   */
  update(dt: number, enemies: ActiveEnemy[]): Projectile[] {
    const reached: Projectile[] = [];

    for (const proj of this.projectiles) {
      if (!proj.alive) continue;

      // Find the target enemy
      const target = enemies.find((e) => e.uid === proj.targetUid);

      // If target is still alive, re-aim toward it
      if (target && !target.dead) {
        proj.targetX = target.x;
        proj.targetY = target.y;
      }
      // If target is dead, keep last known target position (no update)

      // Calculate distance to target
      const dx = proj.targetX - proj.startX;
      const dy = proj.targetY - proj.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Advance progress
      if (distance > 0) {
        proj.progress += (proj.speed * dt) / distance;
      } else {
        // Target is at same position as tower; instantly complete
        proj.progress = 1;
      }

      // Check if reached
      if (proj.progress >= 1.0) {
        proj.alive = false;
        reached.push(proj);
      }
    }

    // Remove dead projectiles
    this.projectiles = this.projectiles.filter((p) => p.alive);

    return reached;
  }

  /**
   * Get all alive projectiles (for rendering).
   */
  getAlive(): Projectile[] {
    return this.projectiles.filter((p) => p.alive);
  }

  /**
   * Reset all projectiles (e.g. on new game).
   */
  reset(): void {
    this.projectiles = [];
    this.nextUid = 0;
  }
}