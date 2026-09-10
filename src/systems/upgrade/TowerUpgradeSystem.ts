import type { TowerState } from '../../types/tower';

export interface UpgradeProjection {
  nextDamage: number;
  nextRange: number;
  nextFireRate: number;
  cost: number;
}

export class TowerUpgradeSystem {
  /**
   * Calculate the cost to upgrade a tower one level.
   * Formula: Math.floor(baseCost * 0.6 * currentLevel)
   */
  getUpgradeCost(tower: TowerState): number {
    return Math.floor(tower.definition.cost * 0.6 * tower.level);
  }

  /**
   * Calculate projected stats after one upgrade.
   * Additive: baseStat * (1 + currentLevel * 0.5)
   */
  getProjectedStats(tower: TowerState): UpgradeProjection {
    const base = tower.definition;
    const mult = 1 + tower.level * 0.5;
    return {
      nextDamage: Math.floor(base.damage * mult),
      nextRange: Math.floor(base.range * mult),
      nextFireRate: base.fireRate * mult,
      cost: this.getUpgradeCost(tower),
    };
  }

  canUpgrade(tower: TowerState, gold: number): boolean {
    return gold >= this.getUpgradeCost(tower);
  }

  /**
   * Raise a tower one level and bank what that level cost.
   *
   * The cost is read BEFORE the level changes, so it matches the price quoted
   * by getUpgradeCost()/getProjectedStats() at the moment the player agreed to
   * it. Callers must charge that same pre-upgrade price.
   */
  applyUpgrade(tower: TowerState): void {
    const cost = this.getUpgradeCost(tower);
    const projected = this.getProjectedStats(tower);
    tower.definition = {
      ...tower.definition,
      damage: projected.nextDamage,
      range: projected.nextRange,
      fireRate: projected.nextFireRate,
    };
    tower.level += 1;
    tower.investedGold += cost;
  }
}