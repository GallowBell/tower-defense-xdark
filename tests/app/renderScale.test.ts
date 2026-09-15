import { describe, it, expect } from 'vitest';

import {
  MAX_RENDER_SCALE,
  canvasSizeFor,
  renderScaleFor,
} from '../../src/app/renderScale';
import { APP_DIMENSIONS } from '../../src/app/constants';

const W = APP_DIMENSIONS.width;
const H = APP_DIMENSIONS.height;

/** Physical pixels one world pixel covers on a given screen. */
function physicalPerWorldPixel(
  width: number,
  height: number,
  devicePixelRatio: number,
): number {
  return Math.min(width / W, height / H) * devicePixelRatio;
}

describe('renderScaleFor', () => {
  it('renders 1:1 on a screen exactly the size of the world', () => {
    expect(renderScaleFor({ width: W, height: H, devicePixelRatio: 1 })).toBe(
      1,
    );
  });

  it('supplies every physical pixel the screen will paint', () => {
    // The property that matters: the canvas must have at least as many pixels
    // as the display puts on screen, or it is being upscaled — which is
    // exactly what made the game blurry on a 2K monitor.
    const screens = [
      { width: 2560, height: 1440, devicePixelRatio: 1 }, // 2K
      { width: 1280, height: 720, devicePixelRatio: 2 }, // retina
      { width: 1920, height: 1080, devicePixelRatio: 1.5 },
      { width: 1600, height: 900, devicePixelRatio: 1 },
      { width: 2560, height: 1080, devicePixelRatio: 1 }, // ultrawide
    ];

    for (const screen of screens) {
      const label = `${screen.width}x${screen.height}@${screen.devicePixelRatio}`;
      const needed = physicalPerWorldPixel(
        screen.width,
        screen.height,
        screen.devicePixelRatio,
      );

      expect(renderScaleFor(screen), label).toBeGreaterThanOrEqual(
        Math.min(needed, MAX_RENDER_SCALE),
      );
    }
  });

  it('takes the limiting dimension, so a wide screen does not over-render', () => {
    // An ultrawide is letterboxed left and right by height: asking for the
    // width's ratio would render pixels that fall outside the canvas.
    const ultrawide = { width: 5120, height: 1440, devicePixelRatio: 1 };

    expect(renderScaleFor(ultrawide)).toBe(
      Math.min(1440 / H, MAX_RENDER_SCALE),
    );
  });

  it('never drops below 1, however small the window', () => {
    // A window smaller than the world is already downscaling; rendering below
    // world resolution would throw away detail the layout assumes.
    for (const screen of [
      { width: 640, height: 360, devicePixelRatio: 1 },
      { width: 320, height: 200, devicePixelRatio: 1 },
      { width: 100, height: 100, devicePixelRatio: 0.5 },
    ]) {
      expect(renderScaleFor(screen)).toBe(1);
    }
  });

  it('caps at MAX_RENDER_SCALE so an 8K screen cannot melt the GPU', () => {
    expect(
      renderScaleFor({ width: 7680, height: 4320, devicePixelRatio: 2 }),
    ).toBe(MAX_RENDER_SCALE);
  });

  it('survives a zero or missing viewport instead of dividing into nonsense', () => {
    expect(renderScaleFor({ width: 0, height: 0, devicePixelRatio: 1 })).toBe(
      1,
    );
    expect(renderScaleFor({ width: W, height: H, devicePixelRatio: 0 })).toBe(
      1,
    );
    expect(
      renderScaleFor({ width: -100, height: -100, devicePixelRatio: 1 }),
    ).toBe(1);
  });

  it('scales with pixel density on an otherwise identical screen', () => {
    const at1 = renderScaleFor({ width: W, height: H, devicePixelRatio: 1 });
    const at2 = renderScaleFor({ width: W, height: H, devicePixelRatio: 2 });

    expect(at2).toBeGreaterThan(at1);
  });
});

describe('canvasSizeFor', () => {
  it('keeps the world aspect ratio at every scale', () => {
    for (const scale of [1, 1.5, 2, MAX_RENDER_SCALE]) {
      const size = canvasSizeFor(scale);
      expect(size.width / size.height, `scale ${scale}`).toBeCloseTo(W / H, 2);
    }
  });

  it('returns whole pixels — a fractional canvas is not a thing', () => {
    const size = canvasSizeFor(1.5);
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });

  it('is the world size at scale 1', () => {
    expect(canvasSizeFor(1)).toEqual({ width: W, height: H });
  });
});
