import Phaser from 'phaser';

import { RENDER_DEPTH } from '../../app/constants';
import type { TowerState } from '../../types/tower';
import {
  TEXTURE_KEYS,
  towerBaseTextureKey,
  towerBarrelTextureKey,
  baseScaleFor,
  barrelTipDistance,
} from './textures';
import {
  MOTION,
  FLASH_DURATION,
  advanceMotion,
  bobOffset,
  igniteMotion,
  recoilOffset,
  restingMotion,
  type MotionProfile,
  type MotionState,
} from './towerMotion';

/** How fast a barrel swings onto a new target, in radians per second. */
const TURN_RATE = Math.PI * 2.5;

/**
 * One tower's visuals: a container holding a base, a rotating barrel, a muzzle
 * flash and the level pips.
 *
 * Towers used to be strokes on a single shared Graphics that was wiped every
 * frame, which left them with no transform of their own — no rotation, no
 * per-tower tween, no independent depth. Giving each tower a container is what
 * makes aiming, recoil and idle motion expressible at all.
 *
 * Two clocks drive the animation, deliberately:
 *
 * - Recoil, flash and bob advance on the frame's *simulated* seconds, so they
 *   keep pace at 2x and stop dead when the run is paused, exactly like the
 *   combat they depict.
 * - Place, upgrade and sell are tweens. They are responses to a click rather
 *   than to the simulation, and `GameScene.applyTimeScale` already holds the
 *   tween clock to the same scale.
 */
export class TowerView {
  readonly uid: string;

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly base: Phaser.GameObjects.Image;
  private readonly barrel: Phaser.GameObjects.Image;
  private readonly flash: Phaser.GameObjects.Image;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly motion: MotionProfile;
  /** Distance from the tower centre to this archetype's muzzle. */
  private readonly tipDistance: number;

  /** Current barrel angle in radians; eased toward the target each frame. */
  private facing = -Math.PI / 2;
  private pipsDrawnForLevel = 0;

  /** Recoil, flash and bob. The arithmetic lives in ./towerMotion. */
  private readonly motionState: MotionState = restingMotion();
  private destroyed = false;

  constructor(scene: Phaser.Scene, tower: TowerState, color: number) {
    this.uid = tower.uid;
    this.scene = scene;
    this.motion = MOTION[tower.archetype];
    this.tipDistance = barrelTipDistance(tower.archetype);

    const radius = tower.definition.radius;

    this.flash = scene.add
      .image(0, 0, TEXTURE_KEYS.muzzleFlash)
      // Anchored at its inner edge, so it flares away from the muzzle.
      .setOrigin(0, 0.5)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);

    this.barrel = scene.add
      .image(0, 0, towerBarrelTextureKey(tower.archetype))
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
    // it points with. The flash sits on top of both — it is the brightest
    // thing on screen for the frames it exists.
    this.container = scene.add
      .container(tower.worldX, tower.worldY, [this.barrel, this.base, this.flash, this.pips])
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
    }

    advanceMotion(this.motionState, dtSeconds, this.motion);
    if (this.motionState.flashLife === 0) this.flash.setVisible(false);

    this.applyMotion();

    if (tower.level !== this.pipsDrawnForLevel) this.drawPips(tower);
  }

  /** Kick the barrel back and light the muzzle. Called once per shot fired. */
  fire(): void {
    igniteMotion(this.motionState);
    this.flash.setVisible(true);
    // Place the flash before the next frame draws, so a shot fired on a frame
    // that ran no simulation step still appears at the muzzle rather than at
    // the tower's centre.
    this.applyMotion();
  }

  /** Drop the tower onto the board when the player builds it. */
  playPlaceIn(): void {
    this.container.setScale(1.5).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      // Back overshoots, which is the point for scale — the tower lands and
      // squashes. Alpha gets its own ease because Phaser clamps it to 0..1, so
      // an overshooting fade would just saturate early and look like a cut.
      scale: { value: 1, ease: 'Back.easeOut' },
      alpha: { value: 1, ease: 'Quad.easeOut', duration: 160 },
      duration: 260,
    });
  }

  /** Punch the tower outward and back, to confirm an upgrade landed. */
  playUpgradePop(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.container.setScale(1).setAlpha(1);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1.28,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /**
   * Shrink away, then destroy. The caller must already have dropped this view
   * from its registry: a selling tower is no longer synced, it is just an
   * animation playing itself out.
   */
  playSellOut(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      scale: 0,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  /** Recolour after a skin change. */
  setColor(color: number): void {
    this.base.setTint(color);
    this.barrel.setTint(color);
    this.flash.setTint(color);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  /**
   * Position the moving parts from the current facing, recoil and bob.
   *
   * Everything is recomputed from scratch each frame rather than nudged,
   * because recoil runs *along* the barrel: rotating and kicking back are the
   * same two numbers resolved together, not two independent offsets.
   */
  private applyMotion(): void {
    const kick = recoilOffset(this.motionState.recoil, this.motion);
    const bob = bobOffset(this.motionState.bobPhase, this.motion);
    const cos = Math.cos(this.facing);
    const sin = Math.sin(this.facing);

    this.barrel.setRotation(this.facing);
    this.barrel.setPosition(-cos * kick, -sin * kick + bob);
    this.base.y = bob;

    if (this.motionState.flashLife > 0) {
      // The muzzle travels with the recoil, so the flash has to follow it.
      const tip = this.tipDistance - kick;
      const life = this.motionState.flashLife / FLASH_DURATION;
      this.flash
        .setPosition(cos * tip, sin * tip + bob)
        .setRotation(this.facing)
        // Stretches outward as it thins and fades.
        .setScale(1.3 - life * 0.5, 0.5 + life * 0.6)
        .setAlpha(life);
    }
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
