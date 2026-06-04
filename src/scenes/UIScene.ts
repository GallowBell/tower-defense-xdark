import Phaser from 'phaser';

import { APP_CONFIG } from '../app/config';
import { GAME_COLORS, SCENE_KEYS } from '../app/constants';

export class UIScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.UI);
  }

  create(): void {
    const { gold, lives, wave } = APP_CONFIG.hudDefaults;

    this.add.rectangle(170, 44, 300, 64, Phaser.Display.Color.HexStringToColor(GAME_COLORS.panel).color, 0.95);

    this.add.text(32, 24, `Gold: ${gold}   Lives: ${lives}   Wave: ${wave}`, {
      color: GAME_COLORS.text,
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    });
  }
}
