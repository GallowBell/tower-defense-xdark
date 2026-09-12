/**
 * Difficulty scaling multipliers per wave.
 * Makes the game progressively harder and rewards scale accordingly.
 */

/**
 * Run-shape constants — starting gold, starting lives, total waves — live in
 * BALANCE, not here. They were declared in both, with the same values and no
 * reader for this copy, so editing them here changed nothing while looking
 * like it should.
 */
export const DIFFICULTY = {
  /**
   * Enemy HP multiplier by wave (1-based).
   * +15% per wave: wave 1 = 1.00x, wave 4 = 1.45x, wave 8 = 2.05x
   */
  enemyHpScale(wave: number): number {
    return 1 + (wave - 1) * 0.15;
  },

  /**
   * Gold reward multiplier by wave (1-based).
   * +10% per wave: wave 1 = 1.00x, wave 4 = 1.30x, wave 8 = 1.70x
   */
  rewardScale(wave: number): number {
    return 1 + (wave - 1) * 0.1;
  },

  /**
   * Sell refund ratio (fraction of base cost).
   */
  sellRefundRatio: 0.5,

  /**
   * Upgrade cost multiplier: an upgrade costs baseCost * ratio * currentLevel.
   */
  upgradeCostRatio: 0.4,

  /** Highest level a tower can reach. */
  maxTowerLevel: 4,

  /**
   * Per-level stat growth, applied to a tower's BASE stats:
   *   stat = base * (1 + rate * (level - 1))
   *
   * Damage grows fastest and range slowest, so upgrading concentrates power
   * without erasing the value of covering more of the map with more towers.
   * At level 4 that is 2.05x damage, 1.6x fire rate and 1.24x range for a
   * total outlay of 3.4x the purchase price — roughly the gold efficiency of
   * simply building more towers, which is the point: upgrading should be a
   * real choice, not the only move.
   */
  upgradeDamagePerLevel: 0.35,
  upgradeFireRatePerLevel: 0.2,
  upgradeRangePerLevel: 0.08,
} as const;
