/**
 * Difficulty scaling multipliers per wave.
 * Makes the game progressively harder and rewards scale accordingly.
 */

export const DIFFICULTY = {
  /** Starting gold for a new game */
  startingGold: 200,

  /** Starting lives */
  startingLives: 20,

  /** Total waves */
  totalWaves: 8,

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
    return 1 + (wave - 1) * 0.10;
  },

  /**
   * Sell refund ratio (fraction of base cost).
   */
  sellRefundRatio: 0.5,

  /**
   * Upgrade cost multiplier (fraction of base cost per level).
   */
  upgradeCostRatio: 0.6,

  /**
   * Tower kill reward: percentage of tower cost as bonus per kill.
   * Actually this is per-enemy reward + wave bonus, so no change needed.
   */
} as const;