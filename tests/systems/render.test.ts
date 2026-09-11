import { describe, it, expect } from 'vitest';

import { RENDER_DEPTH } from '../../src/app/constants';
import { TEXTURE_KEYS, towerBaseTextureKey, baseScaleFor } from '../../src/systems/render/textures';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import type { TowerArchetype } from '../../src/types/tower';

const ARCHETYPES: TowerArchetype[] = ['basic', 'fast', 'heavy'];

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
