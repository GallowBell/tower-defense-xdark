import Phaser from 'phaser';
import type { EnemyState } from '../../types/enemy';

/**
 * Draws enemy visuals using Phaser game objects.
 * Each enemy archetype gets a distinct shape.
 *
 * Supports optional color override for skin theming.
 */
export class EnemyRenderer {
  /**
   * Create a visual game object for the enemy.
   *
   * @param scene — Phaser.Scene to create game objects within
   * @param enemy — the enemy state
   * @param colorOverride — optional color to use instead of enemy.color (for skin theming)
   * @returns a Phaser game object to track position with
   */
  createObject(
    scene: Phaser.Scene,
    enemy: EnemyState,
    colorOverride?: number,
  ): Phaser.GameObjects.GameObject {
    const color = colorOverride ?? enemy.color;

    if (enemy.archetype === 'basic') {
      const circle = scene.add.circle(enemy.x, enemy.y, enemy.radius, color);
      circle.setData('enemyUid', enemy.uid);
      return circle;
    }

    if (enemy.archetype === 'fast') {
      const g = scene.add.graphics();
      g.fillStyle(color, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(0, -enemy.radius),
          new Phaser.Geom.Point(enemy.radius, 0),
          new Phaser.Geom.Point(0, enemy.radius),
          new Phaser.Geom.Point(-enemy.radius, 0),
        ],
        true,
      );
      g.setPosition(enemy.x, enemy.y);
      g.setData('enemyUid', enemy.uid);
      return g;
    }

    // tank (Brute): Square
    const side = enemy.radius * 2;
    const rect = scene.add.rectangle(enemy.x, enemy.y, side, side, color);
    rect.setData('enemyUid', enemy.uid);
    return rect;
  }
}