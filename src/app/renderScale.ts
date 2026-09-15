import { APP_DIMENSIONS } from './constants';

/**
 * How many canvas pixels to render per world pixel.
 *
 * The game is a fixed 1280x720 world that Phaser's FIT mode stretches to the
 * screen. Stretching is a CSS operation: it does not add pixels, so on anything
 * bigger or denser than 1280x720 the canvas was being blown up from a backing
 * store half the size it was displayed at. Measured before this existed:
 *
 *   2560x1440 @dpr 1     0.50 of the pixels needed
 *   1280x720  @dpr 2     0.51
 *   1920x1080 @dpr 1.5   0.45
 *
 * Phaser 3 has no built-in answer: `resolution` was removed in 3.24 and never
 * replaced, and `ScaleManager.zoom` only affects the CSS size under scale mode
 * NONE — under FIT the backing store is fixed at the game size and zoom is
 * ignored outright. So the scale has to be carried by the game size itself,
 * with every camera zoomed by the same factor to put world coordinates back
 * where the game expects them. A tower still sits at x=488 whatever the screen.
 */

/**
 * Ceiling on the multiplier.
 *
 * A 4K screen wants 3x, which is 3840x2160 of canvas — fine for a game this
 * simple. Past that the cost grows quadratically for pixels nobody can see, so
 * an 8K display renders at 3x and is upscaled the rest of the way.
 */
export const MAX_RENDER_SCALE = 3;

/** Viewport measurements this calculation needs. Passed in so it is testable. */
export interface ViewportMetrics {
  width: number;
  height: number;
  devicePixelRatio: number;
}

/**
 * Canvas pixels per world pixel for a given viewport.
 *
 * FIT scales the world by `min(width / 1280, height / 720)` to fill the screen,
 * and the browser then paints each of those CSS pixels with `devicePixelRatio`
 * physical ones. Multiplying the two gives the physical pixels one world pixel
 * actually covers, which is precisely how many the canvas has to supply to look
 * sharp.
 *
 * Never returns less than 1: a window smaller than the world is already
 * downscaling, and rendering below world resolution would throw away detail the
 * layout assumes.
 */
export function renderScaleFor(viewport: ViewportMetrics): number {
  const { width, height, devicePixelRatio } = viewport;

  // A zero or negative viewport happens in headless and during teardown; fall
  // back to the world's own resolution rather than dividing into nonsense.
  if (!(width > 0) || !(height > 0)) return 1;

  const fitScale = Math.min(
    width / APP_DIMENSIONS.width,
    height / APP_DIMENSIONS.height,
  );
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;

  return clamp(fitScale * dpr, 1, MAX_RENDER_SCALE);
}

/** Read the current browser viewport. */
export function currentViewport(): ViewportMetrics {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/** The canvas size needed to render the world at `scale`. */
export function canvasSizeFor(scale: number): {
  width: number;
  height: number;
} {
  return {
    width: Math.round(APP_DIMENSIONS.width * scale),
    height: Math.round(APP_DIMENSIONS.height * scale),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Canvas pixels per world pixel, fixed for the life of the page.
 *
 * Read once rather than per-scene so every camera agrees with the canvas size
 * the game was constructed with. It lives here rather than next to the game
 * config because every scene needs it, and importing it from there would make
 * a cycle: game.ts already imports all of them.
 */
export const RENDER_SCALE = renderScaleFor(currentViewport());
