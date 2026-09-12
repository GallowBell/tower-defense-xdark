import Phaser from 'phaser';

import { GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { ensureTextures } from '../systems/render/textures';
import { applyCameraScale } from '../app/applyRenderScale';
import { RENDER_SCALE } from '../app/renderScale';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.PRELOAD);
  }

  create(): void {
    // The canvas is rendered at RENDER_SCALE; this puts the camera back

    // into the fixed 1280x720 world every scene is laid out for.

    applyCameraScale(this, RENDER_SCALE);

    this.cameras.main.setBackgroundColor(GAME_COLORS.background);

    // Build the generated textures once, before any scene wants to draw with
    // them. They live in the global texture manager, so this survives restarts.
    ensureTextures(this);

    this.scene.start(SCENE_KEYS.MENU);
  }
}
