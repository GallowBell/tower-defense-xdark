import { describe, it, expect } from 'vitest';

import { RENDER_DEPTH } from '../../src/app/constants';
import {
  TEXTURE_KEYS,
  towerBaseTextureKey,
  baseScaleFor,
  enemyBodyTextureKey,
  enemyScaleFor,
  pixelScaleFor,
} from '../../src/systems/render/textures';
import { ENEMY_DEFINITIONS } from '../../src/data/enemyDefinitions';
import type { EnemyArchetype } from '../../src/types/enemy';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import type { TowerArchetype } from '../../src/types/tower';

const ARCHETYPES: TowerArchetype[] = ['basic', 'fast', 'heavy'];
const ENEMY_ARCHETYPES: EnemyArchetype[] = ['basic', 'fast', 'tank'];

describe('RENDER_DEPTH', () => {
  it('stacks the playfield from tiles up to overlays', () => {
    const order = [
      RENDER_DEPTH.tiles,
      RENDER_DEPTH.rangeIndicator,
      RENDER_DEPTH.towers,
      RENDER_DEPTH.enemies,
      RENDER_DEPTH.projectiles,
      RENDER_DEPTH.effects,
      RENDER_DEPTH.floatingText,
      RENDER_DEPTH.overlay,
    ];

    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(order.length); // no two layers collide
  });

  it('keeps enemies above towers, so a passing enemy is never hidden', () => {
    expect(RENDER_DEPTH.enemies).toBeGreaterThan(RENDER_DEPTH.towers);
  });

  it('keeps the overlay above everything else', () => {
    const playfield = [
      RENDER_DEPTH.tiles,
      RENDER_DEPTH.towers,
      RENDER_DEPTH.enemies,
      RENDER_DEPTH.projectiles,
      RENDER_DEPTH.effects,
      RENDER_DEPTH.floatingText,
    ];
    expect(Math.max(...playfield)).toBeLessThan(RENDER_DEPTH.overlay);
  });
});

describe('texture keys', () => {
  it('gives every tower archetype its own base texture', () => {
    const keys = ARCHETYPES.map(towerBaseTextureKey);

    expect(new Set(keys).size).toBe(ARCHETYPES.length);
    for (const key of keys) expect(key).toMatch(/^td-tower-/);
  });

  it('covers exactly the archetypes that exist', () => {
    expect(Object.keys(TEXTURE_KEYS.towerBase).sort()).toEqual(
      Object.keys(TOWER_DEFINITIONS).sort(),
    );
  });

  it('namespaces the barrel key too, so nothing else can clobber it', () => {
    expect(TEXTURE_KEYS.towerBarrel).toMatch(/^td-/);
  });
});

describe('baseScaleFor', () => {
  it('scales the generated base down to the tower radius', () => {
    // The texture is drawn at radius 28; a 14px tower should render at half.
    expect(baseScaleFor(28)).toBeCloseTo(1);
    expect(baseScaleFor(14)).toBeCloseTo(0.5);
  });

  it('keeps every shipped archetype within a sane on-screen size', () => {
    for (const archetype of ARCHETYPES) {
      const scale = baseScaleFor(TOWER_DEFINITIONS[archetype].radius);
      expect(scale).toBeGreaterThan(0.2);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });
});

describe('enemy texture keys', () => {
  it('gives every enemy archetype its own body texture', () => {
    const keys = ENEMY_ARCHETYPES.map(enemyBodyTextureKey);

    expect(new Set(keys).size).toBe(ENEMY_ARCHETYPES.length);
    for (const key of keys) expect(key).toMatch(/^td-enemy-/);
  });

  it('covers exactly the enemy archetypes that exist', () => {
    expect(Object.keys(TEXTURE_KEYS.enemyBody).sort()).toEqual(
      Object.keys(ENEMY_DEFINITIONS).sort(),
    );
  });

  it('never collides a tower key with an enemy key', () => {
    const towerKeys = ARCHETYPES.map(towerBaseTextureKey);
    const enemyKeys = ENEMY_ARCHETYPES.map(enemyBodyTextureKey);

    expect(new Set([...towerKeys, ...enemyKeys]).size).toBe(towerKeys.length + enemyKeys.length);
  });

  it('namespaces the armour and pixel keys too', () => {
    expect(TEXTURE_KEYS.enemyArmor).toMatch(/^td-/);
    expect(TEXTURE_KEYS.pixel).toMatch(/^td-/);
  });
});

describe('enemyScaleFor', () => {
  it('scales the generated body down to the enemy radius', () => {
    // The texture is drawn at radius 24; a 12px enemy renders at half.
    expect(enemyScaleFor(24)).toBeCloseTo(1);
    expect(enemyScaleFor(12)).toBeCloseTo(0.5);
  });

  it('keeps every shipped enemy within a sane on-screen size', () => {
    for (const archetype of ENEMY_ARCHETYPES) {
      const scale = enemyScaleFor(ENEMY_DEFINITIONS[archetype].radius);
      expect(scale, archetype).toBeGreaterThan(0.2);
      expect(scale, archetype).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the size order of the enemies themselves', () => {
    const scales = ENEMY_ARCHETYPES.map(a => enemyScaleFor(ENEMY_DEFINITIONS[a].radius));
    const radii = ENEMY_ARCHETYPES.map(a => ENEMY_DEFINITIONS[a].radius);

    expect([...scales].sort((x, y) => x - y)).toEqual(
      radii.slice().sort((x, y) => x - y).map(enemyScaleFor),
    );
  });
});

describe('pixelScaleFor', () => {
  it('stretches the 4px block to an exact width', () => {
    expect(pixelScaleFor(4)).toBe(1);
    expect(pixelScaleFor(32)).toBe(8);
  });

  it('collapses to nothing at zero width, for an empty health bar', () => {
    expect(pixelScaleFor(0)).toBe(0);
  });
});
