import { describe, it, expect, beforeEach } from 'vitest';

import { TowerUpgradeSystem } from '../../src/systems/upgrade/TowerUpgradeSystem';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import { BALANCE } from '../../src/data/balance';
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
    targetUid: null,
    level: 1,
    investedGold: def.cost,
    baseDefinition: def,
    definition: def,
  };
}

/** Damage per second, ignoring crit (identical multiplier at every level). */
function dps(tower: TowerState): number {
  return tower.definition.damage * tower.definition.fireRate;
}

/** Upgrade a tower as far as the system allows. */
function maxOut(upgrades: TowerUpgradeSystem, tower: TowerState): void {
  while (upgrades.applyUpgrade(tower)) {
    /* keep going */
  }
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

  it('prices the first upgrade at 40% of base cost', () => {
    expect(upgrades.getUpgradeCost(makeTower('basic'))).toBe(40);
    expect(upgrades.getUpgradeCost(makeTower('fast'))).toBe(30);
    expect(upgrades.getUpgradeCost(makeTower('heavy'))).toBe(70);
  });

  it('scales the price linearly with the tower level', () => {
    const tower = makeTower('basic');
    tower.level = 2;
    expect(upgrades.getUpgradeCost(tower)).toBe(80);
    tower.level = 3;
    expect(upgrades.getUpgradeCost(tower)).toBe(120);
  });

  it('prices upgrades off the base cost, not the current definition', () => {
    const tower = makeTower('basic');
    upgrades.applyUpgrade(tower);
    // definition.cost is rebuilt from the base every time, so this holds even
    // if a future change starts scaling the displayed cost.
    expect(upgrades.getUpgradeCost(tower)).toBe(80);
  });

  // ── statsAtLevel ────────────────────────────────────────────────────────────

  it('returns the base stats at level 1', () => {
    const base = TOWER_DEFINITIONS.basic;
    expect(upgrades.statsAtLevel(base, 1)).toEqual({
      damage: base.damage,
      range: base.range,
      fireRate: base.fireRate,
    });
  });

  it('grows damage fastest and range slowest', () => {
    const base = TOWER_DEFINITIONS.basic; // 20 dmg / 160 range / 1.5 rate
    const lvl4 = upgrades.statsAtLevel(base, 4);

    expect(lvl4.damage / base.damage).toBeCloseTo(2.05);
    expect(lvl4.fireRate / base.fireRate).toBeCloseTo(1.6);
    expect(lvl4.range / base.range).toBeCloseTo(1.2375, 2);
  });

  // ── getProjectedStats ───────────────────────────────────────────────────────

  it('projects the stats one upgrade ahead', () => {
    const proj = upgrades.getProjectedStats(makeTower('basic'));
    expect(proj.nextDamage).toBe(27); // floor(20 * 1.35)
    expect(proj.nextRange).toBe(172); // floor(160 * 1.08)
    expect(proj.nextFireRate).toBeCloseTo(1.8); // 1.5 * 1.2
    expect(proj.cost).toBe(40);
  });

  // ── canUpgrade ──────────────────────────────────────────────────────────────

  it('allows an upgrade paid for with the exact balance', () => {
    expect(upgrades.canUpgrade(makeTower('basic'), 40)).toBe(true);
  });

  it('refuses an upgrade one gold short', () => {
    expect(upgrades.canUpgrade(makeTower('basic'), 39)).toBe(false);
  });

  // ── applyUpgrade ────────────────────────────────────────────────────────────

  it('raises the level and applies the projected stats', () => {
    const tower = makeTower('basic');
    const proj = upgrades.getProjectedStats(tower);

    expect(upgrades.applyUpgrade(tower)).toBe(true);

    expect(tower.level).toBe(2);
    expect(tower.definition.damage).toBe(proj.nextDamage);
    expect(tower.definition.range).toBe(proj.nextRange);
    expect(tower.definition.fireRate).toBeCloseTo(proj.nextFireRate);
  });

  it('carries the non-scaling stats across untouched', () => {
    const tower = makeTower('heavy');
    upgrades.applyUpgrade(tower);

    expect(tower.definition.cost).toBe(175);
    expect(tower.definition.critRate).toBe(TOWER_DEFINITIONS.heavy.critRate);
    expect(tower.definition.splashRadius).toBe(TOWER_DEFINITIONS.heavy.splashRadius);
    expect(tower.definition.color).toBe(TOWER_DEFINITIONS.heavy.color);
  });

  it('does not mutate the shared TOWER_DEFINITIONS entry', () => {
    const tower = makeTower('basic');
    maxOut(upgrades, tower);

    expect(TOWER_DEFINITIONS.basic.damage).toBe(20);
    expect(TOWER_DEFINITIONS.basic.range).toBe(160);
    expect(TOWER_DEFINITIONS.basic.fireRate).toBe(1.5);
  });

  it('leaves baseDefinition pointing at the untouched level-1 stats', () => {
    const tower = makeTower('basic');
    maxOut(upgrades, tower);

    expect(tower.baseDefinition.damage).toBe(20);
    expect(tower.definition.damage).toBeGreaterThan(tower.baseDefinition.damage);
  });

  it('upgrades one tower without touching its siblings', () => {
    const a = makeTower('basic');
    const b = { ...makeTower('basic'), uid: 'tower_1' };

    upgrades.applyUpgrade(a);

    expect(b.level).toBe(1);
    expect(b.definition.damage).toBe(20);
  });

  // ── The curve does not compound — regression guards ─────────────────────────

  it('derives every level from the base, never from the previous level', () => {
    const tower = makeTower('basic');
    maxOut(upgrades, tower);

    // Level 4 off the base: floor(20 * 2.05) = 41.
    // The old curve multiplied the *already upgraded* stats by a growing
    // factor and reached 150 damage with 900px of range on a 1152px map.
    expect(tower.level).toBe(4);
    expect(tower.definition.damage).toBe(41);
    expect(tower.definition.fireRate).toBeCloseTo(2.4);
    expect(tower.definition.range).toBe(198);
  });

  it('keeps a maxed tower range well inside the playfield', () => {
    const playfieldWidth = BALANCE.gridCols * BALANCE.tileSize;

    for (const archetype of ['basic', 'fast', 'heavy'] as TowerArchetype[]) {
      const tower = makeTower(archetype);
      maxOut(upgrades, tower);
      expect(tower.definition.range).toBeLessThan(playfieldWidth / 2);
    }
  });

  it('keeps upgrading roughly as gold-efficient as building more towers', () => {
    // The design intent: upgrading buys concentration and board space, not a
    // strictly dominant return. Runaway compounding is what this pins down —
    // the old curve made a maxed tower ~18x more gold-efficient than a new one.
    const fresh = makeTower('basic');
    const freshEfficiency = dps(fresh) / fresh.investedGold;

    const maxed = makeTower('basic');
    maxOut(upgrades, maxed);
    const maxedEfficiency = dps(maxed) / maxed.investedGold;

    const ratio = maxedEfficiency / freshEfficiency;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1.5);
  });

  // ── Level cap ───────────────────────────────────────────────────────────────

  it('stops at the max level', () => {
    const tower = makeTower('basic');
    maxOut(upgrades, tower);

    expect(tower.level).toBe(upgrades.maxLevel);
    expect(upgrades.isMaxLevel(tower)).toBe(true);
  });

  it('refuses to upgrade a maxed tower however much gold is offered', () => {
    const tower = makeTower('basic');
    maxOut(upgrades, tower);

    expect(upgrades.canUpgrade(tower, 999999)).toBe(false);
  });

  it('changes nothing when applyUpgrade is called on a maxed tower', () => {
    const tower = makeTower('basic');
    maxOut(upgrades, tower);
    const { level, investedGold } = tower;
    const damage = tower.definition.damage;

    expect(upgrades.applyUpgrade(tower)).toBe(false);

    expect(tower.level).toBe(level);
    expect(tower.investedGold).toBe(investedGold);
    expect(tower.definition.damage).toBe(damage);
  });

  // ── Cost/charge agreement ───────────────────────────────────────────────────

  it('banks exactly the price quoted before the upgrade', () => {
    const tower = makeTower('basic');
    const quoted = upgrades.getUpgradeCost(tower);
    const before = tower.investedGold;

    upgrades.applyUpgrade(tower);

    expect(quoted).toBe(40);
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

  it('tracks total investment across every level', () => {
    const tower = makeTower('basic');
    maxOut(upgrades, tower);

    expect(tower.investedGold).toBe(100 + 40 + 80 + 120);
  });
});
