import type { EnemyState } from '../../types/enemy';

/**
 * Manages visual particle effects for the game.
 * Uses Phaser's built-in particle emitter system.
 * Generates particle textures programmatically — no asset files needed.
 */
export class ParticleManager {
  private scene: Phaser.Scene;
  private initialized = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Generate the particle dot texture once. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(4, 4, 4);
    gfx.generateTexture('particle', 8, 8);
    gfx.destroy();
  }

  /** Burst of colored particles at a point. Auto-destroys emitter. */
  burstAt(x: number, y: number, color: number, count: number = 8): void {
    this.init();
    try {
      const emitter = this.scene.add.particles(x, y, 'particle', {
        speed: { min: 60, max: 200 },
        scale: { start: 1, end: 0 },
        lifespan: { min: 200, max: 400 },
        tint: color,
        emitting: false,
      });
      emitter.explode(count);
      this.scene.time.delayedCall(600, () => {
        if (emitter.active) emitter.destroy();
      });
    } catch {
      // Particle API version mismatch — silently ignore
    }
  }

  /** Enemy death: burst matching the enemy's color. */
  enemyDeath(enemy: EnemyState): void {
    this.burstAt(enemy.x, enemy.y, enemy.color, 8);
  }

  /** Tower fires: small flash at tower position. */
  towerFire(x: number, y: number, color: number): void {
    this.burstAt(x, y, color, 3);
  }

  /** Tower upgrade: golden sparkle burst. */
  towerUpgrade(x: number, y: number): void {
    this.burstAt(x, y, 0xfbbf24, 12);
  }

  /** Enemy leaked: red angry burst at edge. */
  enemyLeaked(x: number, y: number): void {
    this.burstAt(x, y, 0xef4444, 6);
  }
}