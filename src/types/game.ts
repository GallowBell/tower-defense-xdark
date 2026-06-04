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
