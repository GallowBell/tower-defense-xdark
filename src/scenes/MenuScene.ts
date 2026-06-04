import Phaser from 'phaser';

import { APP_CONFIG } from '../app/config';
import { APP_TITLE, GAME_COLORS, SCENE_KEYS, UI_COPY } from '../app/constants';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.MENU);
  }

  create(): void {
    const { width, height } = APP_CONFIG.dimensions;

    this.cameras.main.setBackgroundColor(GAME_COLORS.background);

    this.add
      .text(width / 2, height * 0.35, APP_TITLE, {
        color: GAME_COLORS.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.45, 'Milestone 0 bootstrap complete.', {
        color: GAME_COLORS.mutedText,
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.58, UI_COPY.menuPrompt, {
        color: GAME_COLORS.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: '24px',
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', this.startGame, this);
    this.input.keyboard?.once('keydown-SPACE', this.startGame, this);
  }

  private startGame(): void {
    this.scene.start(SCENE_KEYS.GAME);
  }
}
