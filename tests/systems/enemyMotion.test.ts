import { describe, it, expect } from 'vitest';

import {
  WALK,
  HIT_FLASH_DURATION,
  advanceEnemyMotion,
  desiredFacing,
  flashStrength,
  hpBarColor,
  igniteHitFlash,
  restingEnemyMotion,
  walkBounce,
  walkSway,
} from '../../src/systems/render/enemyMotion';
import { ENEMY_DEFINITIONS } from '../../src/data/enemyDefinitions';
import type { EnemyArchetype } from '../../src/types/enemy';

const ARCHETYPES: EnemyArchetype[] = ['basic', 'fast', 'tank'];
const STEP = 1 / 60;

describe('gait cadence', () => {
  it('advances with distance covered, not with time', () => {
    const moving = restingEnemyMotion(0);
    const still = restingEnemyMotion(0);

    advanceEnemyMotion(moving, 10, STEP, WALK.basic);
    advanceEnemyMotion(still, 0, STEP, WALK.basic);

    expect(moving.walkPhase).toBeGreaterThan(0);
    expect(still.walkPhase).toBe(0);
  });

  it('completes exactly one cycle over one stride length', () => {
    for (const archetype of ARCHETYPES) {
      const profile = WALK[archetype];
      const state = restingEnemyMotion(0);

      advanceEnemyMotion(state, profile.strideLength, STEP, profile);

      // A full cycle wraps back to the start.
      expect(state.walkPhase, archetype).toBeCloseTo(0, 10);
    }
  });

  it('steps faster for a faster enemy covering the same ground', () => {
    // The Runner and the Brute both walk 100px; the Runner should take more
    // strides doing it. This falls out of stride length alone — no per-frame
    // speed term is involved anywhere.
    const runnerStrides = 100 / WALK.fast.strideLength;
    const bruteStrides = 100 / WALK.tank.strideLength;

    expect(runnerStrides).toBeGreaterThan(bruteStrides);
  });

  it('keeps its phase inside one cycle over a long walk', () => {
    const state = restingEnemyMotion(0.4);
    for (let i = 0; i < 600; i++) {
      advanceEnemyMotion(state, 3.7, STEP, WALK.tank);
      expect(state.walkPhase).toBeGreaterThanOrEqual(0);
      expect(state.walkPhase).toBeLessThan(1);
    }
  });

  it('leaves the state untouched on a paused frame', () => {
    // Paused means no simulated seconds and no travel, so nothing may move.
    const state = restingEnemyMotion(0.3);
    igniteHitFlash(state);
    const snapshot = { ...state };

    advanceEnemyMotion(state, 0, 0, WALK.basic);

    expect(state).toEqual(snapshot);
  });

  it('staggers spawns so a pack does not march in lockstep', () => {
    const phases = new Set(
      Array.from({ length: 20 }, () => restingEnemyMotion().walkPhase),
    );
    expect(phases.size).toBeGreaterThan(1);
  });
});

describe('gait pose', () => {
  it('swells the body without ever shrinking it below rest', () => {
    const profile = WALK.tank;
    const state = restingEnemyMotion(0);

    for (let i = 0; i < 200; i++) {
      advanceEnemyMotion(state, 1.3, STEP, profile);
      const bounce = walkBounce(state.walkPhase, profile);
      expect(bounce).toBeGreaterThanOrEqual(1);
      expect(bounce).toBeLessThanOrEqual(1 + profile.bounceAmplitude);
    }
  });

  it('swells twice per cycle — once per foot', () => {
    const profile = WALK.basic;
    // Quarter and three-quarter phase are the two peaks; 0 and 0.5 are the
    // two rest points between them.
    expect(walkBounce(0, profile)).toBeCloseTo(1, 10);
    expect(walkBounce(0.25, profile)).toBeCloseTo(
      1 + profile.bounceAmplitude,
      10,
    );
    expect(walkBounce(0.5, profile)).toBeCloseTo(1, 10);
    expect(walkBounce(0.75, profile)).toBeCloseTo(
      1 + profile.bounceAmplitude,
      10,
    );
  });

  it('sways to both sides, once per cycle', () => {
    const profile = WALK.fast;
    expect(walkSway(0.25, profile)).toBeCloseTo(profile.swayAmplitude, 10);
    expect(walkSway(0.75, profile)).toBeCloseTo(-profile.swayAmplitude, 10);
  });

  it('stays within its sway amplitude', () => {
    const profile = WALK.fast;
    const state = restingEnemyMotion(0);
    for (let i = 0; i < 300; i++) {
      advanceEnemyMotion(state, 2.1, STEP, profile);
      expect(Math.abs(walkSway(state.walkPhase, profile))).toBeLessThanOrEqual(
        profile.swayAmplitude,
      );
    }
  });

  it('gives the heaviest enemy the longest stride and the biggest swell', () => {
    expect(WALK.tank.strideLength).toBeGreaterThan(WALK.basic.strideLength);
    expect(WALK.basic.strideLength).toBeGreaterThan(WALK.fast.strideLength);
    expect(WALK.tank.bounceAmplitude).toBeGreaterThan(
      WALK.fast.bounceAmplitude,
    );
  });
});

describe('facing', () => {
  it('points along the direction of travel', () => {
    expect(desiredFacing(5, 0, 99)).toBeCloseTo(0, 10);
    expect(desiredFacing(0, 5, 99)).toBeCloseTo(Math.PI / 2, 10);
    expect(desiredFacing(-5, 0, 99)).toBeCloseTo(Math.PI, 10);
  });

  it('holds its heading when the enemy has not moved', () => {
    // Otherwise everything on the board would snap to face right the moment
    // the run is paused.
    const held = 1.23;
    expect(desiredFacing(0, 0, held)).toBe(held);
  });
});

describe('hit flash', () => {
  it('lights on a hit and fades out over HIT_FLASH_DURATION', () => {
    const state = restingEnemyMotion(0);
    igniteHitFlash(state);
    expect(flashStrength(state.flashLife)).toBe(1);

    advanceEnemyMotion(state, 0, HIT_FLASH_DURATION / 2, WALK.basic);
    expect(flashStrength(state.flashLife)).toBeCloseTo(0.5, 5);

    advanceEnemyMotion(state, 0, HIT_FLASH_DURATION, WALK.basic);
    expect(flashStrength(state.flashLife)).toBe(0);
  });

  it('outlives a frame at 60fps even at the fastest fire rate', () => {
    const state = restingEnemyMotion(0);
    igniteHitFlash(state);
    advanceEnemyMotion(state, 0, STEP, WALK.fast);
    expect(state.flashLife).toBeGreaterThan(0);
  });

  it('is brief enough to re-trigger between a Gunner’s shots', () => {
    // The Gunner fires 4x a second at level 1. A flash that outlasted the gap
    // would leave its target permanently white instead of visibly flinching.
    expect(HIT_FLASH_DURATION).toBeLessThan(1 / 4);
  });
});

describe('health bar colour', () => {
  it('runs green, amber, red as the bar empties', () => {
    expect(hpBarColor(1)).toBe(0x22c55e);
    expect(hpBarColor(0.51)).toBe(0x22c55e);
    expect(hpBarColor(0.5)).toBe(0xeab308);
    expect(hpBarColor(0.26)).toBe(0xeab308);
    expect(hpBarColor(0.25)).toBe(0xef4444);
    expect(hpBarColor(0)).toBe(0xef4444);
  });
});

describe('armour is visible where it exists', () => {
  it('marks exactly the enemies that actually blunt damage', () => {
    // EnemyView draws plating from `armor > 0` rather than from the archetype,
    // so this is the assertion that the plating appears on the right enemy.
    const armoured = ARCHETYPES.filter((a) => ENEMY_DEFINITIONS[a].armor > 0);
    expect(armoured).toEqual(['tank']);
  });
});

describe('walk profiles', () => {
  it('covers every archetype', () => {
    for (const archetype of ARCHETYPES) {
      expect(WALK[archetype], archetype).toBeDefined();
      expect(WALK[archetype].strideLength, archetype).toBeGreaterThan(0);
    }
  });
});
