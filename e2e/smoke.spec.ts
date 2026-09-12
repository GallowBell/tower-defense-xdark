import { test, expect, type Page } from '@playwright/test';

/**
 * Canvas coordinates, derived from the scenes rather than guessed.
 * MenuScene lays three 340px map cards with 30px gaps across a 1280px canvas;
 * the playfield grid is 48px tiles offset by (32, 48).
 */
const MAP_CARD_1 = { x: 270, y: 346 };
const START_WAVE = { x: 1230, y: 28 };
const PAUSE = { x: 1130, y: 28 };
const SPEED = { x: 1010, y: 28 };

/** Centre of a build tile, matching gridToWorld(). */
function tile(col: number, row: number): { x: number; y: number } {
  return { x: 32 + col * 48 + 24, y: 48 + row * 48 + 24 };
}

/**
 * Collect anything the page reports as broken. A thrown error in a Phaser scene
 * surfaces here and nowhere else, which is the main thing these tests exist for.
 */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function bootToMenu(page: Page): Promise<void> {
  await page.goto('');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1500);
}

async function startRun(page: Page): Promise<void> {
  await page.mouse.click(MAP_CARD_1.x, MAP_CARD_1.y);
  await page.waitForTimeout(1000);
}

test.describe('browser smoke', () => {
  test('boots to the menu with a canvas and no errors', async ({ page }) => {
    const errors = watchForErrors(page);

    await bootToMenu(page);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('plays a wave: build, start, fight, sell', async ({ page }) => {
    const errors = watchForErrors(page);

    await bootToMenu(page);
    await startRun(page);

    // Two Archers either side of the path's corner (200 starting gold).
    const first = tile(9, 3);
    const second = tile(11, 5);
    await page.mouse.click(first.x, first.y);
    await page.waitForTimeout(250);
    await page.mouse.click(second.x, second.y);
    await page.waitForTimeout(250);

    await page.mouse.click(START_WAVE.x, START_WAVE.y);
    await page.waitForTimeout(5000); // enemies spawn, towers fire, some die

    // Right-click sells; a stale view or a double refund would throw here.
    await page.mouse.click(first.x, first.y, { button: 'right' });
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test('the board moves while running and is static while paused', async ({
    page,
  }) => {
    const errors = watchForErrors(page);

    await bootToMenu(page);
    await startRun(page);

    const spot = tile(5, 3);
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(250);
    await page.mouse.click(START_WAVE.x, START_WAVE.y);
    await page.waitForTimeout(7000); // enemies in range, tower firing

    // Control half. If this ever stops being true the second half is
    // meaningless, because a frozen-solid game would satisfy it trivially.
    const runningA = await page.locator('canvas').screenshot();
    await page.waitForTimeout(700);
    const runningB = await page.locator('canvas').screenshot();
    expect(
      Buffer.compare(runningA, runningB),
      'the board should be animating while a wave runs',
    ).not.toBe(0);

    await page.mouse.click(PAUSE.x, PAUSE.y);
    await page.waitForTimeout(150);

    const pausedA = await page.locator('canvas').screenshot();
    await page.waitForTimeout(1500);
    const pausedB = await page.locator('canvas').screenshot();
    expect(
      Buffer.compare(pausedA, pausedB),
      'the board should be completely static while paused',
    ).toBe(0);

    expect(errors).toEqual([]);
  });

  test('runs at double speed without errors', async ({ page }) => {
    const errors = watchForErrors(page);

    await bootToMenu(page);
    await startRun(page);

    const spot = tile(9, 3);
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(250);
    await page.mouse.click(START_WAVE.x, START_WAVE.y);
    await page.mouse.click(SPEED.x, SPEED.y);
    await page.waitForTimeout(4000);

    expect(errors).toEqual([]);
  });
});
