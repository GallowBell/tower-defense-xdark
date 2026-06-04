import Phaser from 'phaser';

import { GAME_COLORS, SCENE_KEYS } from '../app/constants';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_COLORS.background);
    this.scene.start(SCENE_KEYS.MENU);
  }
}
