import { describe, it, expect } from 'vitest';

import {
  CAMPAIGN_LENGTH,
  WAVE_FLAVOURS,
  generateWave,
  waveEnemyCount,
  waveFlavour,
  waveHpMultiplier,
  waveSpawnCount,
} from '../../src/systems/waves/waveGenerator';
import { WAVE_DEFINITIONS } from '../../src/systems/waves/waveDefinitions';

/** Wave numbers well past the authored campaign. */
const LATE = [9, 10, 12, 15, 20, 25, 30, 40, 60, 100];

describe('determinism', () => {
  it('builds the same wave every time it is asked', () => {
    // A best score only means something if wave 30 is wave 30 for everyone.
    for (const wave of LATE) {
      expect(generateWave(wave - 1)).toEqual(generateWave(wave - 1));
    }
  });

  it('carries the index it was asked for', () => {
    for (const wave of LATE) {
      expect(generateWave(wave - 1).index).toBe(wave - 1);
    }
  });
});

describe('spawn counts', () => {
  it('never sends an empty wave', () => {
    for (let wave = CAMPAIGN_LENGTH + 1; wave <= 120; wave++) {
      expect(
        waveEnemyCount(generateWave(wave - 1)),
        `wave ${wave}`,
      ).toBeGreaterThan(0);
    }
  });

  it('grows, then plateaus rather than running away', () => {
    // Unbounded growth reached ninety-seven Grunts in one wave: slow to walk
    // on stage, and paying out so much gold that the player out-earns it.
    const early = waveSpawnCount(CAMPAIGN_LENGTH + 1);
    const mid = waveSpawnCount(30);
    const late = waveSpawnCount(200);

    expect(mid).toBeGreaterThan(early);
    expect(late).toBe(mid === late ? late : waveSpawnCount(100));
    expect(late).toBeLessThan(60);
  });

  it('is monotonic — a later wave is never smaller', () => {
    for (let wave = CAMPAIGN_LENGTH + 1; wave < 120; wave++) {
      expect(waveSpawnCount(wave + 1), `wave ${wave}`).toBeGreaterThanOrEqual(
        waveSpawnCount(wave),
      );
    }
  });
});

describe('health multiplier', () => {
  it('is exactly 1 inside the campaign, whose balance is already asserted', () => {
    for (let wave = 1; wave <= CAMPAIGN_LENGTH; wave++) {
      expect(waveHpMultiplier(wave), `wave ${wave}`).toBe(1);
    }
  });

  it('compounds past the campaign, which is what ends a run', () => {
    expect(waveHpMultiplier(CAMPAIGN_LENGTH + 1)).toBeGreaterThan(1);

    // Geometric, not linear: each step multiplies by the same factor.
    const step = waveHpMultiplier(20) / waveHpMultiplier(19);
    const laterStep = waveHpMultiplier(40) / waveHpMultiplier(39);
    expect(laterStep).toBeCloseTo(step, 6);
  });

  it('outgrows the spawn count, so difficulty is quality not quantity', () => {
    const countRatio = waveSpawnCount(40) / waveSpawnCount(10);
    const hpRatio = waveHpMultiplier(40) / waveHpMultiplier(10);

    expect(hpRatio).toBeGreaterThan(countRatio);
  });
});

describe('flavours', () => {
  it('only ever produces a flavour that exists', () => {
    for (let wave = CAMPAIGN_LENGTH + 1; wave <= 200; wave++) {
      expect(WAVE_FLAVOURS, `wave ${wave}`).toContain(waveFlavour(wave));
    }
  });

  it('never repeats the same flavour twice in a row', () => {
    // Two identical waves back to back reads as a bug rather than as variety.
    for (let wave = CAMPAIGN_LENGTH + 2; wave <= 200; wave++) {
      expect(waveFlavour(wave), `wave ${wave}`).not.toBe(waveFlavour(wave - 1));
    }
  });

  it('uses every flavour over a long run', () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) =>
        waveFlavour(CAMPAIGN_LENGTH + 1 + i),
      ),
    );
    expect(seen.size).toBe(WAVE_FLAVOURS.length);
  });

  it('shapes the wave — a rush is mostly Runners, a heavy mostly Brutes', () => {
    const dominant = (wave: number): string => {
      const entries = generateWave(wave - 1).entries;
      return entries.reduce((a, b) => (a.count >= b.count ? a : b)).archetype;
    };

    for (let wave = CAMPAIGN_LENGTH + 1; wave <= 120; wave++) {
      const flavour = waveFlavour(wave);
      if (flavour === 'rush')
        expect(dominant(wave), `wave ${wave}`).toBe('fast');
      if (flavour === 'heavy')
        expect(dominant(wave), `wave ${wave}`).toBe('tank');
      if (flavour === 'swarm')
        expect(dominant(wave), `wave ${wave}`).toBe('basic');
    }
  });
});

describe('spawn intervals', () => {
  it('stays above a floor, so a wave never arrives as one lump', () => {
    for (let wave = CAMPAIGN_LENGTH + 1; wave <= 300; wave++) {
      for (const entry of generateWave(wave - 1).entries) {
        expect(entry.interval, `wave ${wave}`).toBeGreaterThan(0.2);
      }
    }
  });

  it('tightens as waves go on, within a flavour', () => {
    const rushWaves = [];
    for (let wave = CAMPAIGN_LENGTH + 1; wave <= 60; wave++) {
      if (waveFlavour(wave) === 'rush') rushWaves.push(wave);
    }
    expect(rushWaves.length).toBeGreaterThan(2);

    const first = generateWave(rushWaves[0] - 1).entries[0].interval;
    const last = generateWave(rushWaves[rushWaves.length - 1] - 1).entries[0]
      .interval;
    expect(last).toBeLessThan(first);
  });
});

describe('the campaign it continues from', () => {
  it('takes its length from the authored waves, not a second constant', () => {
    expect(CAMPAIGN_LENGTH).toBe(WAVE_DEFINITIONS.length);
  });

  it('pays out more than the last authored wave', () => {
    const lastAuthored = WAVE_DEFINITIONS[CAMPAIGN_LENGTH - 1].goldBonus;
    expect(generateWave(CAMPAIGN_LENGTH).goldBonus).toBeGreaterThan(
      lastAuthored,
    );
  });
});
