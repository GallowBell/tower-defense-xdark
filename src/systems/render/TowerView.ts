import Phaser from 'phaser';

import { RENDER_DEPTH } from '../../app/constants';
import type { TowerState } from '../../types/tower';
import { TEXTURE_KEYS, towerBaseTextureKey, baseScaleFor } from './textures';

/** How fast a barrel swings onto a new target, in radians per second. */
const TURN_RATE = Math.PI * 2.5;

/**
 * One tower's visuals: a container holding a base, a rotating barrel and the
 * level pips.
 *
 * Towers used to be strokes on a single shared Graphics that was wiped every
 * frame, which left them with no transform of their own — no rotation, no
 * per-tower tween, no independent depth. Giving each tower a container is what
 * makes aiming (and, next, recoil and idle motion) expressible at all.
 */
export class TowerView {
  readonly uid: string;

  private readonly container: Phaser.GameObjects.Container;
  private readonly base: Phaser.GameObjects.Image;
  private readonly barrel: Phaser.GameObjects.Image;
  private readonly pips: Phaser.GameObjects.Graphics;

  /** Current barrel angle in radians; eased toward the target each frame. */
  private facing = -Math.PI / 2;
  private pipsDrawnForLevel = 0;

  constructor(scene: Phaser.Scene, tower: TowerState, color: number) {
    this.uid = tower.uid;

    const radius = tower.definition.radius;

    this.barrel = scene.add
      .image(0, 0, TEXTURE_KEYS.towerBarrel)
      // Pivot at the inner end, so the barrel swings around the tower centre.
      .setOrigin(0.1, 0.5)
      .setTint(color)
      .setRotation(this.facing);

    this.base = scene.add
      .image(0, 0, towerBaseTextureKey(tower.archetype))
      .setScale(baseScaleFor(radius))
      .setTint(color);

    this.pips = scene.add.graphics();

    // Barrel under the base: the base reads as the tower, the barrel as what
    // it points with.
    this.container = scene.add
      .container(tower.worldX, tower.worldY, [this.barrel, this.base, this.pips])
      .setDepth(RENDER_DEPTH.towers);

    this.drawPips(tower);
  }

  /**
   * Bring the view in line with the tower's state for this frame.
   *
   * @param target world position of the enemy being tracked, or null.
   * @param dtSeconds frame time already scaled by the game's speed multiplier,
   *   so aiming keeps pace when the player runs at 2x.
   */
  sync(tower: TowerState, target: { x: number; y: number } | null, dtSeconds: number): void {
    if (target) {
      const desired = Phaser.Math.Angle.Between(tower.worldX, tower.worldY, target.x, target.y);
      this.facing = Phaser.Math.Angle.RotateTo(this.facing, desired, TURN_RATE * dtSeconds);
      this.barrel.setRotation(this.facing);
    }

    if (tower.level !== this.pipsDrawnForLevel) this.drawPips(tower);
  }

  /** Recolour after a skin change. */
  setColor(color: number): void {
    this.base.setTint(color);
    this.barrel.setTint(color);
  }

  destroy(): void {
    this.container.destroy();
  }

  /** One white pip per level above 1, centred above the tower. */
  private drawPips(tower: TowerState): void {
    this.pipsDrawnForLevel = tower.level;
    this.pips.clear();

    const count = tower.level - 1;
    if (count <= 0) return;

    const spacing = 5;
    const y = -tower.definition.radius - 8;
    this.pips.fillStyle(0xffffff, 0.85);
    for (let i = 0; i < count; i++) {
      this.pips.fillCircle((i - (count - 1) / 2) * spacing, y, 2);
    }
  }
}
