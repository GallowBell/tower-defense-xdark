import Phaser from 'phaser';
import type { TowerState } from '../../types/tower';

/**
 * Draws tower visuals using Phaser Graphics, NOT individual game objects.
 * Each tower archetype gets a distinct shape drawn on a shared Graphics object.
 *
 * Archer (basic):   Diamond (rotated square)
 * Gunner (fast):    Triangle pointing up
 * Cannon (heavy):   Pentagon (5-sided polygon)
 *
 * Supports optional color overrides for skin theming.
 */
export class TowerRenderer {
  draw(
    graphics: Phaser.GameObjects.Graphics,
    towers: TowerState[],
    colorOverrides?: Record<string, number>,
  ): void {
    for (const tower of towers) {
      const { worldX: x, worldY: y, definition } = tower;
      const color = colorOverrides?.[tower.archetype] ?? definition.color;
      const radius = definition.radius;

      if (tower.archetype === 'basic') {
        this.drawDiamond(graphics, x, y, radius, color);
      } else if (tower.archetype === 'fast') {
        this.drawTriangle(graphics, x, y, radius, color);
      } else if (tower.archetype === 'heavy') {
        this.drawPentagon(graphics, x, y, radius, color);
      }

      // Draw upgrade level dots (white dots, one per level beyond 1)
      if (tower.level > 1) {
        const dotCount = tower.level - 1;
        const dotRadius = 2;
        const spacing = 4;
        const dotY = y - radius - 6;
        for (let i = 0; i < dotCount; i++) {
          const dotX = x + (i - (dotCount - 1) / 2) * spacing;
          graphics.fillStyle(0xffffff, 0.8);
          graphics.fillCircle(dotX, dotY, dotRadius);
        }
      }
    }
  }

  private drawDiamond(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number, radius: number, color: number,
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
    x: number, y: number, radius: number, color: number,
  ): void {
    const h = radius * 0.866;
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
    x: number, y: number, radius: number, color: number,
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