import Phaser from 'phaser';

import { RENDER_DEPTH } from '../../app/constants';
import { TEXTURE_KEYS, SPLASH_RING_RADIUS } from './textures';

/**
 * Expanding blast rings for splash-damage hits.
 *
 * The Cannon's blast used to be a circle stroked onto the shared shot Graphics,
 * which is wiped at the start of every frame — so the one visual that justifies
 * the game's most expensive tower existed for a single frame, roughly 16ms. A
 * ring that grows into the real splash radius and fades over a third of a
 * second is long enough to actually read, and shows the player the area the
 * damage covered rather than just that something happened.
 *
 * Pooled for the same reason FloatingTextPool is: a wave of Cannon fire should
 * not allocate.
 */
export class SplashRingPool {
  private readonly scene: Phaser.Scene;
  private readonly idle: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Expand a ring out to `radius` at (x, y) and fade it.
   *
   * @param radius the tower's real splash radius in pixels, so what the player
   *   sees is what the damage system used.
   */
  show(x: number, y: number, radius: number, color: number): void {
    const ring = this.idle.pop() ?? this.create();
    const finalScale = radius / SPLASH_RING_RADIUS;

    ring
      .setPosition(x, y)
      .setTint(color)
      .setScale(finalScale * 0.35)
      .setAlpha(0.9)
      .setVisible(true)
      .setActive(true);

    this.scene.tweens.add({
      targets: ring,
      scale: finalScale,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.easeOut',
      onComplete: () => this.release(ring),
    });
  }

  /** Drop every pooled object — call when the scene shuts down. */
  clear(): void {
    for (const ring of this.idle) ring.destroy();
    this.idle.length = 0;
  }

  private create(): Phaser.GameObjects.Image {
    return this.scene.add
      .image(0, 0, TEXTURE_KEYS.splashRing)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(RENDER_DEPTH.effects);
  }

  private release(ring: Phaser.GameObjects.Image): void {
    ring.setVisible(false).setActive(false);
    this.idle.push(ring);
  }
}
