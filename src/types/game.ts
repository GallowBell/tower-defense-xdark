// Shared game-level types

export type TileType = 'path' | 'buildable' | 'blocked';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type GameState =
  | 'idle'
  | 'placing'
  | 'wave_active'
  | 'wave_cleared'
  | 'game_over'
  | 'victory';

export interface HUDState {
  gold: number;
  lives: number;
  wave: number;
  totalWaves: number;
  selectedTowerId: string | null;
}

/**
 * How long a run lasts.
 *
 * `campaign` is the eight authored waves, won by clearing the last. `endless`
 * plays those same eight and then keeps generating, and is only ever lost.
 */
export type GameMode = 'campaign' | 'endless';
