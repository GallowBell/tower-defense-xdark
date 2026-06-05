import Phaser from 'phaser';
import type { EnemyState } from '../../types/enemy';

/**
 * Draws enemy visuals using Phaser Graphics.
 * Each enemy archetype gets a distinct shape.
 *
 * basic (Grunt): Circle — use Phaser.GameObjects.Arc (existing approach)
 *                fill: color
 * fast (Runner): Small diamond — similar to tower diamond but smaller
 *                (x, y-r), (x+r, y), (x, y+r), (x-r, y)
 *                fill: color
 * tank (Brute):  Square — fillRect centered on x,y with side = radius*2
 *                fill: color
 */
export class EnemyRenderer {
  /**
   * Create a Phaser.GameObjects.GameObject for the enemy type.
   * Returns a single game object that can be positioned/destroyed per-enemy.
   *
   * @param scene — Phaser.Scene to create game objects within
   * @param enemy — the enemy state
   * @returns a Phaser game object to track position with
   */
  createObject(
    scene: Phaser.Scene,
    enemy: EnemyState,
  ): Phaser.GameObjects.GameObject {
    if (enemy.archetype === 'basic') {
      const circle = scene.add.circle(enemy.x, enemy.y, enemy.radius, enemy.color);
      circle.setData('enemyUid', enemy.uid);
      return circle;
    }

    if (enemy.archetype === 'fast') {
      // Diamond shape rendered as positioned Graphics
      const g = scene.add.graphics();
      g.fillStyle(enemy.color, 1);
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
    const rect = scene.add.rectangle(enemy.x, enemy.y, side, side, enemy.color);
    rect.setData('enemyUid', enemy.uid);
    return rect;
  }
}