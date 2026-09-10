import { describe, it, expect, beforeEach } from 'vitest';

import { TowerUpgradeSystem } from '../../src/systems/upgrade/TowerUpgradeSystem';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import type { TowerArchetype, TowerState } from '../../src/types/tower';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a freshly-placed tower the way PlacementSystem does — sharing the
 * module-level definition object, so these tests also catch accidental
 * mutation of TOWER_DEFINITIONS.
 */
function makeTower(archetype: TowerArchetype = 'basic'): TowerState {
  const def = TOWER_DEFINITIONS[archetype];
  return {
    uid: 'tower_0',
    archetype,
    gridX: 5,
    gridY: 5,
    worldX: 100,
    worldY: 100,
    cooldown: 0,
    level: 1,
    investedGold: def.cost,
    definition: def,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// TowerUpgradeSystem
// ═════════════════════════════════════════════════════════════════════════════

describe('TowerUpgradeSystem', () => {
  let upgrades: TowerUpgradeSystem;

  beforeEach(() => {
    upgrades = new TowerUpgradeSystem();
  });

  // ── getUpgradeCost ──────────────────────────────────────────────────────────

  it('prices the first upgrade at 60% of base cost', () => {
    expect(upgrades.getUpgradeCost(makeTower('basic'))).toBe(60);
    expect(upgrades.getUpgradeCost(makeTower('fast'))).toBe(45);
    expect(upgrades.getUpgradeCost(makeTower('heavy'))).toBe(105);
  });

  it('scales the price linearly with the tower level', () => {
    const tower = makeTower('basic');
    tower.level = 2;
    expect(upgrades.getUpgradeCost(tower)).toBe(120);
    tower.level = 3;
    expect(upgrades.getUpgradeCost(tower)).toBe(180);
  });

  // ── getProjectedStats ───────────────────────────────────────────────────────

  it('projects the stats one upgrade ahead', () => {
    const proj = upgrades.getProjectedStats(makeTower('basic'));
    expect(proj.nextDamage).toBe(30); // 20 * 1.5
    expect(proj.nextRange).toBe(240); // 160 * 1.5
    expect(proj.nextFireRate).toBeCloseTo(2.25); // 1.5 * 1.5
    expect(proj.cost).toBe(60);
  });

  // ── canUpgrade ──────────────────────────────────────────────────────────────

  it('allows an upgrade paid for with the exact balance', () => {
    expect(upgrades.canUpgrade(makeTower('basic'), 60)).toBe(true);
  });

  it('refuses an upgrade one gold short', () => {
    expect(upgrades.canUpgrade(makeTower('basic'), 59)).toBe(false);
  });

  // ── applyUpgrade ────────────────────────────────────────────────────────────

  it('raises the level and applies the projected stats', () => {
    const tower = makeTower('basic');
    const proj = upgrades.getProjectedStats(tower);

    upgrades.applyUpgrade(tower);

    expect(tower.level).toBe(2);
    expect(tower.definition.damage).toBe(proj.nextDamage);
    expect(tower.definition.range).toBe(proj.nextRange);
    expect(tower.definition.fireRate).toBeCloseTo(proj.nextFireRate);
  });

  it('leaves the base cost alone so sell/upgrade pricing stays anchored', () => {
    const tower = makeTower('basic');
    upgrades.applyUpgrade(tower);
    expect(tower.definition.cost).toBe(100);
  });

  it('does not mutate the shared TOWER_DEFINITIONS entry', () => {
    const tower = makeTower('basic');
    upgrades.applyUpgrade(tower);

    expect(TOWER_DEFINITIONS.basic.damage).toBe(20);
    expect(TOWER_DEFINITIONS.basic.range).toBe(160);
    expect(TOWER_DEFINITIONS.basic.fireRate).toBe(1.5);
  });

  it('upgrades one tower without touching its siblings', () => {
    const a = makeTower('basic');
    const b = { ...makeTower('basic'), uid: 'tower_1' };

    upgrades.applyUpgrade(a);

    expect(b.level).toBe(1);
    expect(b.definition.damage).toBe(20);
  });

  // ── Cost/charge agreement — regression guards ───────────────────────────────

  it('banks exactly the price quoted before the upgrade', () => {
    const tower = makeTower('basic');
    const quoted = upgrades.getUpgradeCost(tower);
    const before = tower.investedGold;

    upgrades.applyUpgrade(tower);

    expect(quoted).toBe(60);
    expect(tower.investedGold - before).toBe(quoted);
  });

  it('quotes a higher price once the level has risen', () => {
    // Regression: charging getUpgradeCost() *after* applyUpgrade() billed the
    // player for the next level — double the price they were shown.
    const tower = makeTower('basic');
    const quotedBefore = upgrades.getUpgradeCost(tower);

    upgrades.applyUpgrade(tower);

    expect(upgrades.getUpgradeCost(tower)).toBe(quotedBefore * 2);
  });

  it('tracks total investment across repeated upgrades', () => {
    const tower = makeTower('basic');

    upgrades.applyUpgrade(tower); // +60
    upgrades.applyUpgrade(tower); // +120
    upgrades.applyUpgrade(tower); // +180

    expect(tower.level).toBe(4);
    expect(tower.investedGold).toBe(100 + 60 + 120 + 180);
  });

  it('compounds stat growth across repeated upgrades', () => {
    const tower = makeTower('basic');
    const startDamage = tower.definition.damage;

    upgrades.applyUpgrade(tower);
    const afterFirst = tower.definition.damage;
    upgrades.applyUpgrade(tower);

    expect(afterFirst).toBeGreaterThan(startDamage);
    expect(tower.definition.damage).toBeGreaterThan(afterFirst);
  });
});
