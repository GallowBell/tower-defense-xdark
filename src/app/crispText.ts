import Phaser from 'phaser';

import { RENDER_SCALE } from './renderScale';

/**
 * Make every Text object render at the canvas's resolution.
 *
 * Text is the one thing a zoomed camera cannot sharpen on its own. Phaser
 * rasterises glyphs into a texture sized by `style.resolution`, which defaults
 * to 1, and the camera then scales that bitmap up like any other image — so on
 * a 2K screen the HUD was a 2x upscale of 1x glyphs while the shapes around it
 * were sharp.
 *
 * This overrides the built-in `text` factory rather than threading a style
 * property through the twenty-odd places that create text, so it also covers
 * code written later. The override is exactly Phaser's own implementation with
 * a default merged in; a caller that passes its own `resolution` still wins.
 *
 * Call once before the game is constructed.
 */
export function installCrispText(): void {
  // `register` silently refuses to overwrite a factory that already exists —
  // it is guarded by `hasOwnProperty` — and Phaser registers its own `text`
  // at import time, so re-registering alone does nothing at all. `remove`
  // exists for exactly this and has to come first.
  Phaser.GameObjects.GameObjectFactory.remove('text');
  Phaser.GameObjects.GameObjectFactory.register(
    'text',
    function (
      this: Phaser.GameObjects.GameObjectFactory,
      x: number,
      y: number,
      text: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle,
    ) {
      return this.displayList.add(
        new Phaser.GameObjects.Text(this.scene, x, y, text, {
          resolution: RENDER_SCALE,
          ...style,
        }),
      );
    },
  );
}
