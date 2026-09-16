import Phaser from 'phaser';

import { APP_DIMENSIONS } from './constants';

/**
 * Put a scene's camera back into world coordinates.
 *
 * The canvas is rendered at `scale` times the world's 1280x720, so without this
 * a scene would see a 2560x1440 coordinate space and everything laid out for
 * 1280x720 would sit in the top-left quarter. Zooming the camera by the same
 * factor makes one world pixel cover `scale` canvas pixels — which is the whole
 * point — and re-centring puts world (0,0) back at the canvas corner, since
 * Phaser zooms a camera about its midpoint rather than its origin.
 */
export function applyCameraScale(scene: Phaser.Scene, scale: number): void {
  const camera = scene.cameras?.main;
  if (!camera) return;

  camera.setZoom(scale);
  camera.centerOn(APP_DIMENSIONS.width / 2, APP_DIMENSIONS.height / 2);
}
