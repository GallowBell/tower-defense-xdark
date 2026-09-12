import Phaser from 'phaser';

import type { EnemyArchetype } from '../../types/enemy';
import type { TowerArchetype } from '../../types/tower';

/**
 * Procedurally generated textures.
 *
 * Every texture is drawn in WHITE and coloured at use time with setTint. That
 * is what keeps the skin system working: a theme swaps colours, so baking a
 * colour into the texture would freeze every tower into the default palette.
 *
 * Generating them in code also means no binary art in the repo and nothing to
 * download at boot — the same approach ParticleManager already uses for its
 * particle dot.
 */

/** Prefix keeps these from colliding with any other generated texture. */
const PREFIX = 'td';

export const TEXTURE_KEYS = {
  towerBase: {
    basic: `${PREFIX}-tower-basic`,
    fast: `${PREFIX}-tower-fast`,
    heavy: `${PREFIX}-tower-heavy`,
  },
  towerBarrel: `${PREFIX}-tower-barrel`,
  muzzleFlash: `${PREFIX}-muzzle-flash`,
  splashRing: `${PREFIX}-splash-ring`,
  enemyBody: {
    basic: `${PREFIX}-enemy-basic`,
    fast: `${PREFIX}-enemy-fast`,
    tank: `${PREFIX}-enemy-tank`,
  },
  enemyArmor: `${PREFIX}-enemy-armor`,
  pixel: `${PREFIX}-pixel`,
} as const;

/** Texture key for an enemy archetype's body. */
export function enemyBodyTextureKey(archetype: EnemyArchetype): string {
  return TEXTURE_KEYS.enemyBody[archetype];
}

/** Texture key for an archetype's base. */
export function towerBaseTextureKey(archetype: TowerArchetype): string {
  return TEXTURE_KEYS.towerBase[archetype];
}

/**
 * Size each base is drawn at. Bases are generated large and scaled down per
 * tower, so a level-4 Cannon stays crisp.
 */
const BASE_SIZE = 64;
const BASE_RADIUS = 28;

/** Barrel dimensions: long enough to read as a direction at a glance. */
const BARREL_W = 34;
const BARREL_H = 12;

/**
 * Distance from the tower centre to the muzzle, in barrel-local pixels.
 *
 * The barrel pivots at origin 0.1, so 90% of its length sticks out past the
 * centre. Anything that wants to sit at the firing end — the muzzle flash —
 * needs this rather than its own guess.
 */
export const BARREL_TIP_DISTANCE = BARREL_W * 0.9;

/** Muzzle flash bounds. Drawn pointing +x so it shares the barrel's rotation. */
const FLASH_W = 30;
const FLASH_H = 24;

/**
 * Radius the splash ring is drawn at. Callers scale by
 * `splashRadius / SPLASH_RING_RADIUS` to match a tower's real blast.
 */
export const SPLASH_RING_RADIUS = 60;
const RING_SIZE = 128;

/**
 * Enemy bodies are generated at this radius and scaled down per enemy, the same
 * way tower bases are. Every body points +x so that rotating the sprite to the
 * direction of travel actually reads.
 */
const ENEMY_SIZE = 64;
const ENEMY_RADIUS = 24;

/** A plain white block, stretched into health bars. */
const PIXEL_SIZE = 4;

/**
 * Create every texture this module owns, once per game.
 *
 * Safe to call repeatedly — Phaser keeps textures in a global manager that
 * outlives a scene, so a restart must not regenerate them.
 */
export function ensureTextures(scene: Phaser.Scene): void {
  ensureTowerBase(scene, 'basic', drawDiamond);
  ensureTowerBase(scene, 'fast', drawTriangle);
  ensureTowerBase(scene, 'heavy', drawPentagon);
  ensureBarrel(scene);
  ensureMuzzleFlash(scene);
  ensureSplashRing(scene);
  ensureEnemyBody(scene, 'basic', drawGrunt);
  ensureEnemyBody(scene, 'fast', drawRunner);
  ensureEnemyBody(scene, 'tank', drawBrute);
  ensureEnemyArmor(scene);
  ensurePixel(scene);
}

type ShapeDrawer = (g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number) => void;

function ensureTowerBase(scene: Phaser.Scene, archetype: TowerArchetype, draw: ShapeDrawer): void {
  const key = towerBaseTextureKey(archetype);
  if (scene.textures.exists(key)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = BASE_SIZE / 2;

  // Soft outer ring reads as a plinth and keeps the silhouette distinct
  // against both the path and the build tiles.
  g.fillStyle(0xffffff, 0.22);
  g.fillCircle(c, c, BASE_RADIUS);

  g.fillStyle(0xffffff, 1);
  g.lineStyle(2, 0xffffff, 0.65);
  draw(g, c, c, BASE_RADIUS - 6);

  g.generateTexture(key, BASE_SIZE, BASE_SIZE);
  g.destroy();
}

function ensureBarrel(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.towerBarrel)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, (BARREL_H - 6) / 2, BARREL_W - 6, 6);
  // Flared muzzle, so the firing end is obvious once the barrel rotates.
  g.fillRect(BARREL_W - 8, 0, 8, BARREL_H);

  g.generateTexture(TEXTURE_KEYS.towerBarrel, BARREL_W, BARREL_H);
  g.destroy();
}

/**
 * A stubby flare that reads as a gunshot at 30px: a broad diamond of light
 * with a hot core near the muzzle.
 */
function ensureMuzzleFlash(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.muzzleFlash)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const cy = FLASH_H / 2;

  g.fillStyle(0xffffff, 0.5);
  g.beginPath();
  g.moveTo(0, cy);
  g.lineTo(FLASH_W * 0.45, cy - FLASH_H * 0.5);
  g.lineTo(FLASH_W, cy);
  g.lineTo(FLASH_W * 0.45, cy + FLASH_H * 0.5);
  g.closePath();
  g.fillPath();

  g.fillStyle(0xffffff, 1);
  g.fillCircle(FLASH_W * 0.28, cy, FLASH_H * 0.22);

  g.generateTexture(TEXTURE_KEYS.muzzleFlash, FLASH_W, FLASH_H);
  g.destroy();
}

/** A plain ring, scaled and faded outward to show a blast's real reach. */
function ensureSplashRing(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.splashRing)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.lineStyle(5, 0xffffff, 1);
  g.strokeCircle(RING_SIZE / 2, RING_SIZE / 2, SPLASH_RING_RADIUS);
  g.generateTexture(TEXTURE_KEYS.splashRing, RING_SIZE, RING_SIZE);
  g.destroy();
}

function ensureEnemyBody(scene: Phaser.Scene, archetype: EnemyArchetype, draw: ShapeDrawer): void {
  const key = enemyBodyTextureKey(archetype);
  if (scene.textures.exists(key)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = ENEMY_SIZE / 2;

  g.fillStyle(0xffffff, 1);
  g.lineStyle(2, 0xffffff, 0.55);
  draw(g, c, c, ENEMY_RADIUS);

  g.generateTexture(key, ENEMY_SIZE, ENEMY_SIZE);
  g.destroy();
}

/**
 * Armour plating, drawn as banded plates across the front half of a body.
 *
 * Layered over whichever body carries it rather than baked into the Brute,
 * because armour is a stat any enemy could have. It is also the one thing here
 * that is NOT tinted with the enemy's colour: plating reads as metal in every
 * skin, so that "this one shrugs off small hits" stays legible after a theme
 * change.
 */
function ensureEnemyArmor(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.enemyArmor)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = ENEMY_SIZE / 2;

  // Three plates stacked toward the leading edge, each a little shorter.
  const plates: [number, number][] = [
    [0.30, 0.80],
    [0.58, 0.62],
    [0.84, 0.38],
  ];
  for (const [along, across] of plates) {
    const x = c + ENEMY_RADIUS * along;
    const halfHeight = ENEMY_RADIUS * across;
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(x - 3, c - halfHeight, 5, halfHeight * 2);
  }

  // Rivet line down the spine, so the plating still reads at a small scale.
  g.fillStyle(0xffffff, 0.55);
  g.fillRect(c - ENEMY_RADIUS * 0.2, c - 1.5, ENEMY_RADIUS * 1.1, 3);

  g.generateTexture(TEXTURE_KEYS.enemyArmor, ENEMY_SIZE, ENEMY_SIZE);
  g.destroy();
}

function ensurePixel(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.pixel)) return;

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
  g.generateTexture(TEXTURE_KEYS.pixel, PIXEL_SIZE, PIXEL_SIZE);
  g.destroy();
}

/** Grunt: a round body with a blunt leading edge. */
function drawGrunt(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  g.fillCircle(cx, cy, r);
  g.strokeCircle(cx, cy, r);
  // Snout: a small wedge past the leading edge, so its heading is readable.
  g.beginPath();
  g.moveTo(cx + r * 0.55, cy - r * 0.55);
  g.lineTo(cx + r * 1.2, cy);
  g.lineTo(cx + r * 0.55, cy + r * 0.55);
  g.closePath();
  g.fillPath();
}

/** Runner: a long arrowhead — all of its silhouette points where it is going. */
function drawRunner(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  g.beginPath();
  g.moveTo(cx + r * 1.25, cy);
  g.lineTo(cx - r * 0.55, cy - r * 0.85);
  g.lineTo(cx - r * 0.15, cy);
  g.lineTo(cx - r * 0.55, cy + r * 0.85);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

/** Brute: a heavy slab, wider than it is long. */
function drawBrute(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  const halfLength = r * 0.85;
  const halfWidth = r;
  const chamfer = r * 0.34;

  g.beginPath();
  g.moveTo(cx - halfLength, cy - halfWidth + chamfer);
  g.lineTo(cx - halfLength + chamfer, cy - halfWidth);
  g.lineTo(cx + halfLength - chamfer, cy - halfWidth);
  g.lineTo(cx + halfLength, cy - halfWidth + chamfer);
  g.lineTo(cx + halfLength, cy + halfWidth - chamfer);
  g.lineTo(cx + halfLength - chamfer, cy + halfWidth);
  g.lineTo(cx - halfLength + chamfer, cy + halfWidth);
  g.lineTo(cx - halfLength, cy + halfWidth - chamfer);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function drawDiamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx + r, cy);
  g.lineTo(cx, cy + r);
  g.lineTo(cx - r, cy);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function drawTriangle(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  const h = r * 0.866;
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.lineTo(cx + h, cy + r * 0.5);
  g.lineTo(cx - h, cy + r * 0.5);
  g.closePath();
  g.fillPath();
  g.strokePath();
}

function drawPentagon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
  g.strokePath();
}

/** Scale factor to render a base texture at a tower's collision radius. */
export function baseScaleFor(radius: number): number {
  return (radius * 2) / (BASE_RADIUS * 2);
}

/** Scale factor to render an enemy body or its plating at a given radius. */
export function enemyScaleFor(radius: number): number {
  return radius / ENEMY_RADIUS;
}

/** Horizontal scale that stretches the pixel texture to a given width. */
export function pixelScaleFor(width: number): number {
  return width / PIXEL_SIZE;
}
