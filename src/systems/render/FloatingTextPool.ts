import Phaser from 'phaser';

import { RENDER_DEPTH } from '../../app/constants';

/**
 * Reusable floating damage numbers.
 *
 * Every shot used to allocate a Text object and a tween and then throw both
 * away — steady garbage at four shots a second per Gunner. This keeps a pool
 * and recycles it.
 */
export class FloatingTextPool {
  private readonly scene: Phaser.Scene;
  private readonly idle: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Float a number up from (x, y) and fade it out. */
  show(x: number, y: number, message: string, color: string, emphasised: boolean): void {
    const text = this.idle.pop() ?? this.create();

    text
      .setPosition(x, y)
      .setText(message)
      .setColor(color)
      .setFontSize(emphasised ? 18 : 14)
      .setAlpha(1)
      .setVisible(true)
      .setActive(true);

    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 800,
      onComplete: () => this.release(text),
    });
  }

  /** Drop every pooled object — call when the scene shuts down. */
  clear(): void {
    for (const text of this.idle) text.destroy();
    this.idle.length = 0;
  }

  private create(): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, '', {
        fontFamily: 'Arial',
        fontSize: '14px',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(RENDER_DEPTH.floatingText);
  }

  private release(text: Phaser.GameObjects.Text): void {
    text.setVisible(false).setActive(false);
    this.idle.push(text);
  }
}
