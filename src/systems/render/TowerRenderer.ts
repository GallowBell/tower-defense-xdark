import Phaser from 'phaser';
import type { TowerState } from '../../types/tower';

/**
 * Draws tower visuals using Phaser Graphics, NOT individual game objects.
 * Each tower archetype gets a distinct shape drawn on a shared Graphics object.
 *
 * Archer (basic):   Diamond (rotated square) — draw a 4-point diamond.
 *                    Points: (x, y-r), (x+r, y), (x, y+r), (x-r, y)
 *                    Fill: definition.color
 * Gunner (fast):    Triangle pointing up
 *                    Points: (x, y-r), (x+r*0.866, y+r*0.5), (x-r*0.866, y+r*0.5)
 *                    Fill: definition.color
 * Cannon (heavy):   Pentagon (5-sided polygon)
 *                    Points at 5 evenly-spaced angles starting from -PI/2 (top)
 *                    Fill: definition.color
 *
 * All shapes get a 1px white (0xffffff, 0.3 alpha) stroke outline.
 */
export class TowerRenderer {
  draw(graphics: Phaser.GameObjects.Graphics, towers: TowerState[]): void {
    for (const tower of towers) {
      const { worldX: x, worldY: y, definition } = tower;
      const { radius, color } = definition;

      if (tower.archetype === 'basic') {
        this.drawDiamond(graphics, x, y, radius, color);
      } else if (tower.archetype === 'fast') {
        this.drawTriangle(graphics, x, y, radius, color);
      } else if (tower.archetype === 'heavy') {
        this.drawPentagon(graphics, x, y, radius, color);
      }
    }
  }

  private drawDiamond(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    color: number,
  ): void {
    graphics.fillStyle(color, 1);
    graphics.lineStyle(1, 0xffffff, 0.3);
    graphics.beginPath();
    graphics.moveTo(x, y - radius);
    graphics.lineTo(x + radius, y);
    graphics.lineTo(x, y + radius);
    graphics.lineTo(x - radius, y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private drawTriangle(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    color: number,
  ): void {
    const h = radius * 0.866; // sqrt(3)/2 * radius
    graphics.fillStyle(color, 1);
    graphics.lineStyle(1, 0xffffff, 0.3);
    graphics.beginPath();
    graphics.moveTo(x, y - radius);
    graphics.lineTo(x + h, y + radius * 0.5);
    graphics.lineTo(x - h, y + radius * 0.5);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }

  private drawPentagon(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    color: number,
  ): void {
    graphics.fillStyle(color, 1);
    graphics.lineStyle(1, 0xffffff, 0.3);
    graphics.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) {
        graphics.moveTo(px, py);
      } else {
        graphics.lineTo(px, py);
      }
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }
}