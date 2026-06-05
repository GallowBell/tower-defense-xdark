import type { Vec2, TileType } from '../types/game';
import { BALANCE } from '../data/balance';
import type { MapDefinition } from '../data/mapDefinitions';

/** World px coords of CENTER of tile (gridX, gridY) */
export function gridToWorld(gridX: number, gridY: number): Vec2 {
  return {
    x: BALANCE.playfieldOffsetX + gridX * BALANCE.tileSize + BALANCE.tileSize / 2,
    y: BALANCE.playfieldOffsetY + gridY * BALANCE.tileSize + BALANCE.tileSize / 2,
  };
}

/** World px → grid (col, row). Returns null if outside grid. */
export function worldToGrid(worldX: number, worldY: number): Vec2 | null {
  const col = Math.floor((worldX - BALANCE.playfieldOffsetX) / BALANCE.tileSize);
  const row = Math.floor((worldY - BALANCE.playfieldOffsetY) / BALANCE.tileSize);
  if (!isInBounds(col, row)) return null;
  return { x: col, y: row };
}

/** True if (gridX, gridY) is within 0..gridCols-1 and 0..gridRows-1 */
export function isInBounds(gridX: number, gridY: number): boolean {
  return gridX >= 0 && gridX < BALANCE.gridCols && gridY >= 0 && gridY < BALANCE.gridRows;
}

/** TileType at grid position, or null if OOB. tiles indexed as tiles[row][col]. */
export function getTileType(map: MapDefinition, gridX: number, gridY: number): TileType | null {
  if (!isInBounds(gridX, gridY)) return null;
  return map.tiles[gridY]?.[gridX] ?? null;
}

/** True iff tile is 'buildable' */
export function isBuildable(map: MapDefinition, gridX: number, gridY: number): boolean {
  return getTileType(map, gridX, gridY) === 'buildable';
}

/** Map's grid-space waypoints → world-px centers */
export function waypointsToWorld(map: MapDefinition): Vec2[] {
  return map.waypoints.map(({ x, y }) => gridToWorld(x, y));
}

/** Top-left + dimensions of a tile in world px */
export function tileRect(gridX: number, gridY: number): { x: number; y: number; w: number; h: number } {
  return {
    x: BALANCE.playfieldOffsetX + gridX * BALANCE.tileSize,
    y: BALANCE.playfieldOffsetY + gridY * BALANCE.tileSize,
    w: BALANCE.tileSize,
    h: BALANCE.tileSize,
  };
}
