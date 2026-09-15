import Phaser from 'phaser';

import { SCENE_KEYS } from '../app/constants';
import { applyCameraScale } from '../app/applyRenderScale';
import { RENDER_SCALE } from '../app/renderScale';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  create(): void {
    // The canvas is rendered at RENDER_SCALE; this puts the camera back

    // into the fixed 1280x720 world every scene is laid out for.

    applyCameraScale(this, RENDER_SCALE);

    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}
