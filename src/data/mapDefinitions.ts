import type { TileType, Vec2 } from '../types/game';

export interface MapDefinition {
  id: string;
  displayName: string;
  cols: number;
  rows: number;
  /** Indexed as tiles[row][col] */
  tiles: TileType[][];
  /** Entry-to-exit waypoints in grid coords */
  waypoints: Vec2[];
}

function buildTiles(cols: number, rows: number, waypoints: Vec2[]): TileType[][] {
  const tiles: TileType[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): TileType => 'buildable'),
  );
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (a.x === b.x) {
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      for (let row = minY; row <= maxY; row++) {
        tiles[row][a.x] = 'path';
      }
    } else {
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      for (let col = minX; col <= maxX; col++) {
        tiles[a.y][col] = 'path';
      }
    }
  }
  return tiles;
}

const WAYPOINTS_MAP01: Vec2[] = [
  { x: 0,  y: 2  },   // entry — left edge, row 2
  { x: 10, y: 2  },   // corner — end of top horizontal
  { x: 10, y: 11 },   // corner — end of vertical drop
  { x: 23, y: 11 },   // exit  — right edge, row 11
];

const WAYPOINTS_MAP02: Vec2[] = [
  { x: 0,  y: 7  },   // entry — left edge, row 7
  { x: 10, y: 7  },   // corner
  { x: 10, y: 2  },   // corner — go up
  { x: 20, y: 2  },   // corner — go right
  { x: 20, y: 11 },   // corner — go down
  { x: 23, y: 11 },   // exit  — right edge
];

const WAYPOINTS_MAP03: Vec2[] = [
  { x: 0,  y: 2  },   // entry — left edge, row 2
  { x: 7,  y: 2  },   // corner
  { x: 7,  y: 11 },   // corner — go down
  { x: 16, y: 11 },   // corner — go right
  { x: 16, y: 2  },   // corner — go up
  { x: 23, y: 2  },   // exit  — right edge, row 2
];

export const MAP_DEFINITIONS: Record<string, MapDefinition> = {
  map01: {
    id: 'map01',
    displayName: 'Greenfield',
    cols: 24,
    rows: 14,
    tiles: buildTiles(24, 14, WAYPOINTS_MAP01),
    waypoints: WAYPOINTS_MAP01,
  },
  map02: {
    id: 'map02',
    displayName: 'Zigzag',
    cols: 24,
    rows: 14,
    tiles: buildTiles(24, 14, WAYPOINTS_MAP02),
    waypoints: WAYPOINTS_MAP02,
  },
  map03: {
    id: 'map03',
    displayName: 'Serpent',
    cols: 24,
    rows: 14,
    tiles: buildTiles(24, 14, WAYPOINTS_MAP03),
    waypoints: WAYPOINTS_MAP03,
  },
};

export const DEFAULT_MAP_ID = 'map01';
