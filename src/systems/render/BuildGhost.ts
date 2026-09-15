import Phaser from 'phaser';

import { RENDER_DEPTH } from '../../app/constants';
import { TOWER_DEFINITIONS } from '../../entities/towers/towerDefinitions';
import type { TowerArchetype } from '../../types/tower';
import type { PlacementRejection } from '../placement/PlacementSystem';
import {
  towerBaseTextureKey,
  towerBarrelTextureKey,
  baseScaleFor,
  SUPERSAMPLED_SCALE,
} from './textures';

/** Tint for a tile the tower can go on. */
const VALID_COLOR = 0x4ade80;
/** Tint for a tile it cannot. */
const INVALID_COLOR = 0xf87171;

/**
 * A preview of the tower the player is about to build.
 *
 * Building used to be blind: nothing showed whether a tile was legal, what the
 * tower would cover, or whether the gold was there, until after the click had
 * already spent it. This draws the answer under the cursor instead.
 *
 * The verdict comes from `validatePlacement`, the same function the click runs,
 * rather than from rules re-derived here — a ghost that shows green where the
 * click is refused is worse than no ghost at all.
 */
export class BuildGhost {
  private readonly base: Phaser.GameObjects.Image;
  private readonly barrel: Phaser.GameObjects.Image;
  private readonly range: Phaser.GameObjects.Graphics;

  /** What the range circle was last drawn for, so it is not redrawn per frame. */
  private rangeSignature = '';

  constructor(scene: Phaser.Scene) {
    this.range = scene.add
      .graphics()
      .setDepth(RENDER_DEPTH.rangeIndicator)
      .setVisible(false);

    this.barrel = scene.add
      .image(0, 0, towerBarrelTextureKey('basic'))
      .setScale(SUPERSAMPLED_SCALE)
      .setOrigin(0.1, 0.5)
      .setRotation(-Math.PI / 2)
      .setDepth(RENDER_DEPTH.towers)
      .setAlpha(0.45)
      .setVisible(false);

    this.base = scene.add
      .image(0, 0, towerBaseTextureKey('basic'))
      .setDepth(RENDER_DEPTH.towers)
      .setAlpha(0.45)
      .setVisible(false);
  }

  /**
   * Show the preview on a tile.
   *
   * @param rejection why the tile is refused, or null when it is good.
   */
  show(
    worldX: number,
    worldY: number,
    archetype: TowerArchetype,
    rejection: PlacementRejection | null,
  ): void {
    const definition = TOWER_DEFINITIONS[archetype];
    const valid = rejection === null;
    const color = valid ? VALID_COLOR : INVALID_COLOR;

    this.base
      .setTexture(towerBaseTextureKey(archetype))
      .setScale(baseScaleFor(definition.radius))
      .setPosition(worldX, worldY)
      .setTint(color)
      .setVisible(true);

    this.barrel
      .setTexture(towerBarrelTextureKey(archetype))
      .setPosition(worldX, worldY)
      .setTint(color)
      .setVisible(true);

    // The range circle only makes sense for a tower that can actually be
    // built; drawing it over every stretch of road the cursor crosses is noise.
    if (!valid) {
      this.range.setVisible(false);
      this.rangeSignature = '';
      return;
    }

    const signature = `${archetype}:${worldX}:${worldY}`;
    if (signature !== this.rangeSignature) {
      this.rangeSignature = signature;
      this.range.clear();
      this.range.lineStyle(1, VALID_COLOR, 0.5);
      this.range.strokeCircle(worldX, worldY, definition.range);
      this.range.fillStyle(VALID_COLOR, 0.07);
      this.range.fillCircle(worldX, worldY, definition.range);
    }
    this.range.setVisible(true);
  }

  hide(): void {
    this.base.setVisible(false);
    this.barrel.setVisible(false);
    this.range.setVisible(false);
    this.rangeSignature = '';
  }

  destroy(): void {
    this.base.destroy();
    this.barrel.destroy();
    this.range.destroy();
  }
}
