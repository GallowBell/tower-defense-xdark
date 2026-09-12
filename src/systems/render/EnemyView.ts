import Phaser from 'phaser';

import { RENDER_DEPTH } from '../../app/constants';
import type { EnemyState } from '../../types/enemy';
import {
  TEXTURE_KEYS,
  enemyBodyTextureKey,
  enemyScaleFor,
  pixelScaleFor,
} from './textures';
import {
  WALK,
  advanceEnemyMotion,
  desiredFacing,
  flashStrength,
  hpBarColor,
  igniteHitFlash,
  restingEnemyMotion,
  walkBounce,
  walkSway,
  type EnemyMotionState,
  type WalkProfile,
} from './enemyMotion';

/** How fast an enemy swings onto a new heading, in radians per second. */
const TURN_RATE = Math.PI * 4;

/** Height of the health bar in pixels. */
const BAR_HEIGHT = 4;

/**
 * Plating colour. Deliberately fixed rather than skin-tinted: armour has to
 * mean the same thing in every theme.
 */
const ARMOR_COLOR = 0xd4d4d8;

/**
 * One enemy's visuals: a container holding a body, optional armour plating and
 * its own health bar.
 *
 * Enemies used to be a bare shape per enemy with every health bar stroked onto
 * one shared Graphics that was wiped each frame. That left an enemy with no
 * state of its own, so it could not turn to face where it was walking, react to
 * being hit, or die as anything other than an instant disappearance — and the
 * Brute's armour, the stat that gives each tower an enemy, was invisible.
 *
 * Clocks match TowerView: gait and hit flash advance on simulated time (so they
 * keep pace at 2x and freeze when paused), while death and leak are tweens,
 * because they answer an event rather than the simulation.
 */
export class EnemyView {
  readonly uid: string;

  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly armor: Phaser.GameObjects.Image | null;
  private readonly barBackground: Phaser.GameObjects.Image;
  private readonly barFill: Phaser.GameObjects.Image;
  private readonly profile: WalkProfile;
  private readonly motion: EnemyMotionState = restingEnemyMotion();
  private readonly baseColor: number;
  /** Rest scale of the body, before the gait's footfall swell. */
  private readonly bodyScale: number;

  private facing: number;
  private lastX: number;
  private lastY: number;
  private hpDrawnFor = -1;
  private destroyed = false;

  constructor(scene: Phaser.Scene, enemy: EnemyState, color: number) {
    this.uid = enemy.uid;
    this.scene = scene;
    this.profile = WALK[enemy.archetype];
    this.baseColor = color;
    this.lastX = enemy.x;
    this.lastY = enemy.y;
    // Enemies walk in from the left edge, so start them facing that way rather
    // than snapping round on their first step.
    this.facing = 0;

    const scale = enemyScaleFor(enemy.radius);
    this.bodyScale = scale;

    this.body = scene.add
      .image(0, 0, enemyBodyTextureKey(enemy.archetype))
      .setScale(scale)
      .setTint(color);

    // Armour is driven off the stat, not the archetype: anything that blunts
    // hits shows plating, whatever it happens to be.
    this.armor =
      enemy.armor > 0
        ? scene.add
            .image(0, 0, TEXTURE_KEYS.enemyArmor)
            .setScale(scale)
            .setTint(ARMOR_COLOR)
        : null;

    const barWidth = enemy.radius * 2;
    const barY = -enemy.radius - 8;
    this.barBackground = scene.add
      .image(-enemy.radius, barY, TEXTURE_KEYS.pixel)
      .setOrigin(0, 0.5)
      .setScale(pixelScaleFor(barWidth), pixelScaleFor(BAR_HEIGHT))
      .setTint(0x7f1d1d);
    this.barFill = scene.add
      .image(-enemy.radius, barY, TEXTURE_KEYS.pixel)
      .setOrigin(0, 0.5)
      .setScale(pixelScaleFor(barWidth), pixelScaleFor(BAR_HEIGHT));

    const children: Phaser.GameObjects.GameObject[] = [this.body];
    if (this.armor) children.push(this.armor);
    children.push(this.barBackground, this.barFill);

    this.container = scene.add
      .container(enemy.x, enemy.y, children)
      .setDepth(RENDER_DEPTH.enemies);

    this.syncHealthBar(enemy);
  }

  /**
   * Bring the view in line with the enemy's state for this frame.
   *
   * @param dtSeconds the frame's simulated seconds, so the flash fades on the
   *   same clock as the combat that caused it.
   */
  sync(enemy: EnemyState, dtSeconds: number): void {
    const dx = enemy.x - this.lastX;
    const dy = enemy.y - this.lastY;
    this.lastX = enemy.x;
    this.lastY = enemy.y;

    this.container.setPosition(enemy.x, enemy.y);

    const desired = desiredFacing(dx, dy, this.facing);
    this.facing = Phaser.Math.Angle.RotateTo(
      this.facing,
      desired,
      TURN_RATE * dtSeconds,
    );

    advanceEnemyMotion(
      this.motion,
      Math.hypot(dx, dy),
      dtSeconds,
      this.profile,
    );
    this.applyGait();

    if (enemy.hp !== this.hpDrawnFor) this.syncHealthBar(enemy);
  }

  /** Light the enemy up white. Called once per hit that lands on it. */
  flashHit(): void {
    igniteHitFlash(this.motion);
    this.applyFlash();
  }

  /** Shrink, spin and fade out, then destroy. */
  playDeath(): void {
    this.detachBar();
    this.scene.tweens.add({
      targets: this.container,
      scale: 0,
      alpha: 0,
      angle: 180,
      duration: 280,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  /**
   * Surge forward and flare out, then destroy.
   *
   * Deliberately the opposite shape of the death animation — this one grows and
   * brightens rather than shrinking away. A leak costs a life, so it should not
   * look like a kill.
   */
  playLeak(): void {
    this.detachBar();
    this.body.setTint(0xffffff);
    this.armor?.setTint(0xffffff);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1.8,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  /**
   * Pose the body for the current point in its gait.
   *
   * Sway is applied across the direction of travel rather than in screen space,
   * so an enemy walking down the map sways left-to-right on screen exactly as
   * one walking across it does. The footfall is a scale swell instead, for the
   * reason given on WalkProfile.bounceAmplitude.
   */
  private applyGait(): void {
    const bounce = walkBounce(this.motion.walkPhase, this.profile);
    const sway = walkSway(this.motion.walkPhase, this.profile);

    // Perpendicular to a heading of (cos, sin) is (-sin, cos).
    const offsetX = -Math.sin(this.facing) * sway;
    const offsetY = Math.cos(this.facing) * sway;
    const scale = this.bodyScale * bounce;

    this.body
      .setPosition(offsetX, offsetY)
      .setRotation(this.facing)
      .setScale(scale);
    this.armor
      ?.setPosition(offsetX, offsetY)
      .setRotation(this.facing)
      .setScale(scale);

    if (this.motion.flashLife > 0) this.applyFlash();
  }

  /** Wash the body toward white while the flash lasts. */
  private applyFlash(): void {
    const strength = flashStrength(this.motion.flashLife);
    if (strength <= 0) {
      this.body.setTint(this.baseColor);
      this.armor?.setTint(ARMOR_COLOR);
      return;
    }
    this.body.setTint(blend(this.baseColor, 0xffffff, strength));
    this.armor?.setTint(blend(ARMOR_COLOR, 0xffffff, strength));
  }

  private syncHealthBar(enemy: EnemyState): void {
    this.hpDrawnFor = enemy.hp;
    const ratio = Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
    this.barFill
      .setScale(
        pixelScaleFor(enemy.radius * 2 * ratio),
        pixelScaleFor(BAR_HEIGHT),
      )
      .setTint(hpBarColor(ratio))
      .setVisible(ratio > 0);
  }

  /**
   * Drop the health bar before a death or leak animation.
   *
   * A bar that spins and inflates with the corpse reads as a UI glitch; the
   * number it was showing stopped being true the moment the enemy died.
   */
  private detachBar(): void {
    this.barBackground.setVisible(false);
    this.barFill.setVisible(false);
  }
}

/** Mix two packed RGB colours, `t` of the way from `from` to `to`. */
function blend(from: number, to: number, t: number): number {
  const mix = (shift: number): number => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.round(a + (b - a) * t) << shift;
  };
  return mix(16) | mix(8) | mix(0);
}
