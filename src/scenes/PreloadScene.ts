import Phaser from 'phaser';

import { GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { ensureTextures } from '../systems/render/textures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_COLORS.background);

    // Build the generated textures once, before any scene wants to draw with
    // them. They live in the global texture manager, so this survives restarts.
    ensureTextures(this);

    this.scene.start(SCENE_KEYS.MENU);
  }
}
