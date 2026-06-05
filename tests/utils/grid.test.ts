import { describe, expect, it } from 'vitest';

import type { MapDefinition } from '../../src/data/mapDefinitions';
import {
  gridToWorld,
  worldToGrid,
  isInBounds,
  getTileType,
  isBuildable,
  waypointsToWorld,
  tileRect,
} from '../../src/utils/grid';

// Minimal mock map — isolated from real map data
const MOCK_MAP: MapDefinition = {
  id: 'mock',
  displayName: 'Mock',
  cols: 24,
  rows: 14,
  tiles: Array.from({ length: 14 }, (_, row) =>
    Array.from({ length: 24 }, (_, col): 'path' | 'buildable' | 'blocked' => {
      // Row 0 is all 'path', col 0 of row 1 is 'blocked', rest 'buildable'
      if (row === 0) return 'path';
      if (row === 1 && col === 0) return 'blocked';
      return 'buildable';
    }),
  ),
  waypoints: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 5 },
  ],
};

// ── gridToWorld ─────────────────────────────────────────────────────────────
describe('gridToWorld', () => {
  it('(0,0) → center of first tile {x:56, y:72}', () => {
    expect(gridToWorld(0, 0)).toEqual({ x: 56, y: 72 });
  });

  it('(1,0) → {x:104, y:72}', () => {
    expect(gridToWorld(1, 0)).toEqual({ x: 104, y: 72 });
  });

  it('(0,1) → {x:56, y:120}', () => {
    expect(gridToWorld(0, 1)).toEqual({ x: 56, y: 120 });
  });

  it('(23,13) → {x:1160, y:696} (far corner)', () => {
    expect(gridToWorld(23, 13)).toEqual({ x: 1160, y: 696 });
  });
});

// ── worldToGrid ─────────────────────────────────────────────────────────────
describe('worldToGrid', () => {
  it('(56,72) → {x:0, y:0}', () => {
    expect(worldToGrid(56, 72)).toEqual({ x: 0, y: 0 });
  });

  it('(104,72) → {x:1, y:0}', () => {
    expect(worldToGrid(104, 72)).toEqual({ x: 1, y: 0 });
  });

  it('out-of-bounds negative coords → null', () => {
    expect(worldToGrid(-1, -1)).toBeNull();
  });

  it('far out-of-bounds (9999,9999) → null', () => {
    expect(worldToGrid(9999, 9999)).toBeNull();
  });

  it('worldToGrid is inverse of gridToWorld for a mid-grid tile', () => {
    const world = gridToWorld(7, 5);
    expect(worldToGrid(world.x, world.y)).toEqual({ x: 7, y: 5 });
  });
});

// ── isInBounds ───────────────────────────────────────────────────────────────
describe('isInBounds', () => {
  it('(0,0) → true', () => {
    expect(isInBounds(0, 0)).toBe(true);
  });

  it('(23,13) → true (max valid indices)', () => {
    expect(isInBounds(23, 13)).toBe(true);
  });

  it('(24,0) → false (one past max col)', () => {
    expect(isInBounds(24, 0)).toBe(false);
  });

  it('(0,14) → false (one past max row)', () => {
    expect(isInBounds(0, 14)).toBe(false);
  });

  it('(-1,0) → false', () => {
    expect(isInBounds(-1, 0)).toBe(false);
  });

  it('(0,-1) → false', () => {
    expect(isInBounds(0, -1)).toBe(false);
  });
});

// ── tileRect ─────────────────────────────────────────────────────────────────
describe('tileRect', () => {
  it('(0,0) → {x:32, y:48, w:48, h:48}', () => {
    expect(tileRect(0, 0)).toEqual({ x: 32, y: 48, w: 48, h: 48 });
  });

  it('(1,2) → {x:80, y:144, w:48, h:48}', () => {
    expect(tileRect(1, 2)).toEqual({ x: 80, y: 144, w: 48, h: 48 });
  });
});

// ── getTileType ──────────────────────────────────────────────────────────────
describe('getTileType', () => {
  it('returns "path" for a path tile (row 0, col 3)', () => {
    expect(getTileType(MOCK_MAP, 3, 0)).toBe('path');
  });

  it('returns "buildable" for a buildable tile (row 2, col 2)', () => {
    expect(getTileType(MOCK_MAP, 2, 2)).toBe('buildable');
  });

  it('returns "blocked" for the blocked tile (row 1, col 0)', () => {
    expect(getTileType(MOCK_MAP, 0, 1)).toBe('blocked');
  });

  it('returns null for OOB coordinates', () => {
    expect(getTileType(MOCK_MAP, 24, 0)).toBeNull();
    expect(getTileType(MOCK_MAP, 0, 14)).toBeNull();
  });
});

// ── isBuildable ──────────────────────────────────────────────────────────────
describe('isBuildable', () => {
  it('returns true for buildable tile', () => {
    expect(isBuildable(MOCK_MAP, 2, 2)).toBe(true);
  });

  it('returns false for path tile', () => {
    expect(isBuildable(MOCK_MAP, 3, 0)).toBe(false);
  });

  it('returns false for blocked tile', () => {
    expect(isBuildable(MOCK_MAP, 0, 1)).toBe(false);
  });

  it('returns false for OOB coordinates', () => {
    expect(isBuildable(MOCK_MAP, 99, 99)).toBe(false);
  });
});

// ── waypointsToWorld ─────────────────────────────────────────────────────────
describe('waypointsToWorld', () => {
  it('converts all waypoints to world-px centers', () => {
    const result = waypointsToWorld(MOCK_MAP);
    expect(result).toHaveLength(MOCK_MAP.waypoints.length);
  });

  it('first waypoint (0,0) → {x:56, y:72}', () => {
    const result = waypointsToWorld(MOCK_MAP);
    expect(result[0]).toEqual({ x: 56, y: 72 });
  });

  it('second waypoint (5,0) → {x:296, y:72}', () => {
    // 32 + 5*48 + 24 = 32 + 240 + 24 = 296
    const result = waypointsToWorld(MOCK_MAP);
    expect(result[1]).toEqual({ x: 296, y: 72 });
  });

  it('third waypoint (5,5) → {x:296, y:312}', () => {
    // x: 32 + 5*48 + 24 = 296,  y: 48 + 5*48 + 24 = 312
    const result = waypointsToWorld(MOCK_MAP);
    expect(result[2]).toEqual({ x: 296, y: 312 });
  });
});
