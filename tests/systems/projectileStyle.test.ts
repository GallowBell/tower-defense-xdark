import { describe, it, expect } from 'vitest';

import {
  PROJECTILE_STYLES,
  projectileStyleFor,
  trailPuff,
} from '../../src/systems/render/projectileStyle';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import type { TowerArchetype } from '../../src/types/tower';

const ARCHETYPES: TowerArchetype[] = ['basic', 'fast', 'heavy'];

describe('projectile styles', () => {
  it('covers every tower archetype', () => {
    for (const archetype of ARCHETYPES) {
      expect(projectileStyleFor(archetype), archetype).toBeDefined();
    }
  });

  it('gives each archetype a visibly different shot', () => {
    const shapes = ARCHETYPES.map(a => {
      const s = projectileStyleFor(a);
      return `${s.headRadius}:${s.trailLength}:${s.speed}`;
    });
    expect(new Set(shapes).size).toBe(ARCHETYPES.length);
  });

  it('makes the Cannon shell fat and slow and the Gunner tracer small and fast', () => {
    expect(PROJECTILE_STYLES.heavy.headRadius).toBeGreaterThan(PROJECTILE_STYLES.fast.headRadius);
    expect(PROJECTILE_STYLES.fast.speed).toBeGreaterThan(PROJECTILE_STYLES.heavy.speed);
  });

  it('crosses a tower’s own range fast enough to stay in step with its damage', () => {
    // Damage lands the instant a tower fires; the projectile is decoration
    // chasing it. Much over a third of a second and the shell visibly arrives
    // after the number it caused.
    for (const archetype of ARCHETYPES) {
      const flightTime = TOWER_DEFINITIONS[archetype].range / projectileStyleFor(archetype).speed;
      expect(flightTime, archetype).toBeLessThan(0.5);
    }
  });
});

describe('trail puffs', () => {
  it('taper in both size and opacity toward the tail', () => {
    for (const archetype of ARCHETYPES) {
      const style = projectileStyleFor(archetype);
      let previous = trailPuff(0, style);

      for (let i = 1; i < style.trailSegments; i++) {
        const puff = trailPuff(i, style);
        expect(puff.distance, archetype).toBeGreaterThan(previous.distance);
        expect(puff.radius, archetype).toBeLessThan(previous.radius);
        expect(puff.alpha, archetype).toBeLessThan(previous.alpha);
        previous = puff;
      }
    }
  });

  it('never draws a puff on top of the head', () => {
    for (const archetype of ARCHETYPES) {
      expect(trailPuff(0, projectileStyleFor(archetype)).distance, archetype).toBeGreaterThan(0);
    }
  });

  it('ends exactly at the declared trail length', () => {
    for (const archetype of ARCHETYPES) {
      const style = projectileStyleFor(archetype);
      const last = trailPuff(style.trailSegments - 1, style);
      expect(last.distance, archetype).toBeCloseTo(style.trailLength, 10);
    }
  });

  it('fades the tail to nothing, so a trail has no hard end', () => {
    for (const archetype of ARCHETYPES) {
      const style = projectileStyleFor(archetype);
      expect(trailPuff(style.trailSegments - 1, style).alpha, archetype).toBeCloseTo(0, 10);
    }
  });

  it('keeps every puff visible and non-negative in size', () => {
    for (const archetype of ARCHETYPES) {
      const style = projectileStyleFor(archetype);
      for (let i = 0; i < style.trailSegments; i++) {
        const puff = trailPuff(i, style);
        expect(puff.radius, `${archetype}[${i}]`).toBeGreaterThanOrEqual(0);
        expect(puff.alpha, `${archetype}[${i}]`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
