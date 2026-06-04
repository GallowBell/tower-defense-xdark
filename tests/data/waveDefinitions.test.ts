import { describe, expect, it } from 'vitest';

import { BALANCE } from '../../src/data/balance';
import { ENEMY_DEFINITIONS } from '../../src/data/enemyDefinitions';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import { WAVE_DEFINITIONS } from '../../src/systems/waves/waveDefinitions';

const VALID_ENEMY_ARCHETYPES = ['basic', 'fast', 'tank'] as const;

describe('WAVE_DEFINITIONS', () => {
  it('length matches BALANCE.totalWaves', () => {
    expect(WAVE_DEFINITIONS.length).toBe(BALANCE.totalWaves);
  });

  it('every wave has at least one SpawnEntry', () => {
    for (const wave of WAVE_DEFINITIONS) {
      expect(wave.entries.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every SpawnEntry has count >= 1', () => {
    for (const wave of WAVE_DEFINITIONS) {
      for (const entry of wave.entries) {
        expect(entry.count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every SpawnEntry has interval > 0', () => {
    for (const wave of WAVE_DEFINITIONS) {
      for (const entry of wave.entries) {
        expect(entry.interval).toBeGreaterThan(0);
      }
    }
  });

  it("every SpawnEntry archetype is 'basic', 'fast', or 'tank'", () => {
    for (const wave of WAVE_DEFINITIONS) {
      for (const entry of wave.entries) {
        expect(VALID_ENEMY_ARCHETYPES).toContain(entry.archetype);
      }
    }
  });

  it('wave indices are 0-based and sequential', () => {
    WAVE_DEFINITIONS.forEach((wave, i) => {
      expect(wave.index).toBe(i);
    });
  });

  it('goldBonus >= 0 for all waves', () => {
    for (const wave of WAVE_DEFINITIONS) {
      expect(wave.goldBonus).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('ENEMY_DEFINITIONS', () => {
  it("includes 'basic', 'fast', and 'tank' keys", () => {
    expect(Object.keys(ENEMY_DEFINITIONS)).toContain('basic');
    expect(Object.keys(ENEMY_DEFINITIONS)).toContain('fast');
    expect(Object.keys(ENEMY_DEFINITIONS)).toContain('tank');
  });
});

describe('TOWER_DEFINITIONS', () => {
  it("includes 'basic', 'fast', and 'heavy' keys", () => {
    expect(Object.keys(TOWER_DEFINITIONS)).toContain('basic');
    expect(Object.keys(TOWER_DEFINITIONS)).toContain('fast');
    expect(Object.keys(TOWER_DEFINITIONS)).toContain('heavy');
  });

  it('all tower costs, damage, range, and fireRate are positive', () => {
    for (const tower of Object.values(TOWER_DEFINITIONS)) {
      expect(tower.cost).toBeGreaterThan(0);
      expect(tower.damage).toBeGreaterThan(0);
      expect(tower.range).toBeGreaterThan(0);
      expect(tower.fireRate).toBeGreaterThan(0);
    }
  });
});
