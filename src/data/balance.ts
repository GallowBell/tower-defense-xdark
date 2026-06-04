/**
 * BALANCE — global numeric constants that govern the game's feel and difficulty.
 * All other systems should read these values rather than hard-coding their own.
 */

interface BalanceConstants {
  /** Gold the player starts with each run. */
  startingGold: number;
  /** Lives the player starts with; reaching 0 ends the game. */
  startingLives: number;
  /** Total number of waves in a complete run. */
  totalWaves: number;
  /** Number of tile columns in the playfield grid. */
  gridCols: number;
  /** Number of tile rows in the playfield grid. */
  gridRows: number;
  /** Width/height of each square tile in pixels. */
  tileSize: number;
  /** Horizontal pixel offset from the canvas left edge to the grid origin. */
  playfieldOffsetX: number;
  /** Vertical pixel offset from the canvas top edge to the grid origin. */
  playfieldOffsetY: number;
}

export const BALANCE: BalanceConstants = {
  startingGold: 200,
  startingLives: 20,
  totalWaves: 8,
  gridCols: 24,
  gridRows: 14,
  tileSize: 48,
  playfieldOffsetX: 32,
  playfieldOffsetY: 48,
} as const;
