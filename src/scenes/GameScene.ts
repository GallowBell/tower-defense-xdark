import Phaser from 'phaser';

import { APP_CONFIG } from '../app/config';
import { GAME_COLORS, SCENE_KEYS, UI_COPY } from '../app/constants';

export class GameScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    const { width, height } = APP_CONFIG.dimensions;
    const playfieldPadding = 64;
    const pathHeight = 96;

    this.cameras.main.setBackgroundColor(GAME_COLORS.background);

    this.add.rectangle(
      width / 2,
      height / 2,
      width - playfieldPadding * 2,
      height - playfieldPadding * 2,
      GAME_COLORS.battlefield,
      1,
    );

    this.add.rectangle(
      width / 2,
      height / 2,
      width - playfieldPadding * 2,
      pathHeight,
      GAME_COLORS.path,
      0.85,
    );

    this.add.rectangle(
      width / 2,
      height * 0.76,
      width - playfieldPadding * 2,
      120,
      GAME_COLORS.buildZone,
      0.35,
    );

    this.add
      .text(width / 2, height * 0.18, UI_COPY.gameplayHint, {
        color: GAME_COLORS.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
      })
      .setOrigin(0.5);

    if (!this.scene.isActive(SCENE_KEYS.UI)) {
      this.scene.launch(SCENE_KEYS.UI);
    }
  }
}
