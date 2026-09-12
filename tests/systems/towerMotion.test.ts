import { describe, it, expect } from 'vitest';

import {
  MOTION,
  FLASH_DURATION,
  advanceMotion,
  bobOffset,
  igniteMotion,
  recoilOffset,
  restingMotion,
} from '../../src/systems/render/towerMotion';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import { DIFFICULTY } from '../../src/data/difficultyScaling';
import type { TowerArchetype } from '../../src/types/tower';

const ARCHETYPES: TowerArchetype[] = ['basic', 'fast', 'heavy'];
const STEP = 1 / 60;

describe('recoil', () => {
  it('is at rest until the tower fires', () => {
    const state = restingMotion(0);
    expect(state.recoil).toBe(0);
    expect(recoilOffset(state.recoil, MOTION.basic)).toBe(0);
  });

  it('kicks the barrel its full distance on the frame it fires', () => {
    const state = restingMotion(0);
    igniteMotion(state);
    expect(recoilOffset(state.recoil, MOTION.basic)).toBeCloseTo(MOTION.basic.recoilDistance, 5);
  });

  it('returns exactly to rest after recoilRecovery seconds', () => {
    for (const archetype of ARCHETYPES) {
      const profile = MOTION[archetype];
      const state = restingMotion(0);
      igniteMotion(state);

      let elapsed = 0;
      while (elapsed < profile.recoilRecovery) {
        advanceMotion(state, STEP, profile);
        elapsed += STEP;
      }

      expect(state.recoil, archetype).toBe(0);
      expect(recoilOffset(state.recoil, profile), archetype).toBe(0);
    }
  });

  it('decelerates into rest rather than sliding home at a constant speed', () => {
    const profile = MOTION.heavy;
    const state = restingMotion(0);
    igniteMotion(state);

    // Halfway through the recovery the barrel should already be most of the
    // way back — that squared decay is what makes the kick read as a snap.
    advanceMotion(state, profile.recoilRecovery / 2, profile);
    const halfway = recoilOffset(state.recoil, profile);

    expect(halfway).toBeLessThan(profile.recoilDistance * 0.5);
    expect(halfway).toBeGreaterThan(0);
  });

  it('never overshoots past rest, however large the frame', () => {
    const state = restingMotion(0);
    igniteMotion(state);
    advanceMotion(state, 10, MOTION.fast);
    expect(state.recoil).toBe(0);
  });
});

describe('recoil recovery against real reload times', () => {
  /**
   * The constraint that is easy to break from a distance: upgrades raise fire
   * rate, so a tower's reload shrinks as it levels. If recovery ever exceeds
   * the reload at max level, the barrel is still travelling home when the next
   * shot kicks it out and it never looks seated.
   */
  it('leaves every archetype time to seat its barrel at max level', () => {
    const maxSteps = DIFFICULTY.maxTowerLevel - 1;
    const fireRateMultiplier = 1 + DIFFICULTY.upgradeFireRatePerLevel * maxSteps;

    for (const archetype of ARCHETYPES) {
      const reloadAtMaxLevel = 1 / (TOWER_DEFINITIONS[archetype].fireRate * fireRateMultiplier);
      expect(MOTION[archetype].recoilRecovery, archetype).toBeLessThan(reloadAtMaxLevel);
    }
  });
});

describe('muzzle flash', () => {
  it('lights on fire and expires after FLASH_DURATION', () => {
    const state = restingMotion(0);
    igniteMotion(state);
    expect(state.flashLife).toBe(FLASH_DURATION);

    advanceMotion(state, FLASH_DURATION, MOTION.basic);
    expect(state.flashLife).toBe(0);
  });

  it('outlives at least one frame at 60fps, so it is never invisible', () => {
    const state = restingMotion(0);
    igniteMotion(state);
    advanceMotion(state, STEP, MOTION.fast);
    expect(state.flashLife).toBeGreaterThan(0);
  });
});

describe('idle bob', () => {
  it('stays within its amplitude', () => {
    const profile = MOTION.heavy;
    const state = restingMotion(0);

    for (let i = 0; i < 400; i++) {
      advanceMotion(state, STEP, profile);
      expect(Math.abs(bobOffset(state.bobPhase, profile))).toBeLessThanOrEqual(profile.bobAmplitude);
    }
  });

  it('keeps its phase inside one cycle', () => {
    const state = restingMotion(0.5);
    for (let i = 0; i < 500; i++) {
      advanceMotion(state, STEP, MOTION.fast);
      expect(state.bobPhase).toBeGreaterThanOrEqual(0);
      expect(state.bobPhase).toBeLessThan(1);
    }
  });

  it('returns to where it started after a full period', () => {
    const profile = MOTION.basic;
    const state = restingMotion(0.25);
    const before = bobOffset(state.bobPhase, profile);

    advanceMotion(state, profile.bobPeriod, profile);

    expect(bobOffset(state.bobPhase, profile)).toBeCloseTo(before, 5);
  });

  it('does not advance while the run is paused', () => {
    // A paused frame reports zero simulated seconds, which is what keeps the
    // board pixel-static: the bob must not run on wall-clock time.
    const state = restingMotion(0.3);
    igniteMotion(state);
    const snapshot = { ...state };

    advanceMotion(state, 0, MOTION.heavy);

    expect(state).toEqual(snapshot);
  });

  it('staggers towers so a row of them does not pulse as one block', () => {
    const phases = new Set(Array.from({ length: 20 }, () => restingMotion().bobPhase));
    expect(phases.size).toBeGreaterThan(1);
  });
});

describe('motion profiles', () => {
  it('covers every archetype', () => {
    for (const archetype of ARCHETYPES) {
      expect(MOTION[archetype], archetype).toBeDefined();
    }
  });

  it('gives the heaviest tower the heaviest kick and the slowest idle', () => {
    expect(MOTION.heavy.recoilDistance).toBeGreaterThan(MOTION.basic.recoilDistance);
    expect(MOTION.basic.recoilDistance).toBeGreaterThan(MOTION.fast.recoilDistance);
    expect(MOTION.heavy.bobPeriod).toBeGreaterThan(MOTION.basic.bobPeriod);
    expect(MOTION.basic.bobPeriod).toBeGreaterThan(MOTION.fast.bobPeriod);
  });
});
