import type { TowerDefinition, TowerState } from '../../types/tower';
import { DIFFICULTY } from '../../data/difficultyScaling';

export interface UpgradeProjection {
  nextDamage: number;
  nextRange: number;
  nextFireRate: number;
  cost: number;
}

/** The three stats an upgrade improves. */
export interface LeveledStats {
  damage: number;
  range: number;
  fireRate: number;
}

/**
 * Tower upgrades.
 *
 * Every level's stats are derived from the tower's immutable baseDefinition,
 * never from its current one. The previous version read the already-upgraded
 * stats and multiplied damage and fire rate by the same growing factor, so DPS
 * compounded quadratically (a level-4 Gunner out-damaged everything else on the
 * board combined) and range grew to cover the whole map.
 */
export class TowerUpgradeSystem {
  /** Highest level a tower can reach. */
  readonly maxLevel: number = DIFFICULTY.maxTowerLevel;

  isMaxLevel(tower: TowerState): boolean {
    return tower.level >= this.maxLevel;
  }

  /**
   * Cost of the tower's next level. Anchored to the base purchase price, so it
   * cannot drift as the tower's current stats change.
   */
  getUpgradeCost(tower: TowerState): number {
    return Math.floor(
      tower.baseDefinition.cost * DIFFICULTY.upgradeCostRatio * tower.level,
    );
  }

  /** Stats an archetype has at `level`. Level 1 returns the base stats. */
  statsAtLevel(base: TowerDefinition, level: number): LeveledStats {
    const steps = Math.max(0, level - 1);
    return {
      damage: Math.floor(
        base.damage * (1 + DIFFICULTY.upgradeDamagePerLevel * steps),
      ),
      range: Math.floor(
        base.range * (1 + DIFFICULTY.upgradeRangePerLevel * steps),
      ),
      fireRate:
        base.fireRate * (1 + DIFFICULTY.upgradeFireRatePerLevel * steps),
    };
  }

  /** Stats the tower would have one level up, with the price to get there. */
  getProjectedStats(tower: TowerState): UpgradeProjection {
    const next = this.statsAtLevel(tower.baseDefinition, tower.level + 1);
    return {
      nextDamage: next.damage,
      nextRange: next.range,
      nextFireRate: next.fireRate,
      cost: this.getUpgradeCost(tower),
    };
  }

  canUpgrade(tower: TowerState, gold: number): boolean {
    if (this.isMaxLevel(tower)) return false;
    return gold >= this.getUpgradeCost(tower);
  }

  /**
   * Raise a tower one level and bank what that level cost.
   *
   * The cost is read BEFORE the level changes, so it matches the price quoted
   * by getUpgradeCost()/getProjectedStats() at the moment the player agreed to
   * it. Callers must charge that same pre-upgrade price.
   *
   * @returns false when the tower is already at max level and nothing changed.
   */
  applyUpgrade(tower: TowerState): boolean {
    if (this.isMaxLevel(tower)) return false;

    const cost = this.getUpgradeCost(tower);
    const level = tower.level + 1;

    // Rebuilt from the base every time: cost, colour, crit and splash carry
    // over untouched, and the level is the only thing the stats depend on.
    tower.definition = {
      ...tower.baseDefinition,
      ...this.statsAtLevel(tower.baseDefinition, level),
    };
    tower.level = level;
    tower.investedGold += cost;
    return true;
  }
}
