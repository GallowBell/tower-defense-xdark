import { describe, it, expect, beforeEach } from 'vitest';

import type { MapDefinition } from '../../src/data/mapDefinitions';
import type { TowerState } from '../../src/types/tower';
import { PlacementSystem } from '../../src/systems/placement/PlacementSystem';
import { GameStateStore } from '../../src/systems/game-state/GameStateStore';
import { BALANCE } from '../../src/data/balance';

// ── Minimal mock map — no real data imports ──────────────────────────────────
// Row 0 = all 'path'; Row 1, Col 0 = 'blocked'; everything else = 'buildable'
const MOCK_MAP: MapDefinition = {
  id: 'test',
  displayName: 'Test Map',
  cols: 24,
  rows: 14,
  tiles: Array.from({ length: 14 }, (_, row) =>
    Array.from({ length: 24 }, (_, col): 'path' | 'buildable' | 'blocked' => {
      if (row === 0) return 'path';
      if (row === 1 && col === 0) return 'blocked';
      return 'buildable';
    }),
  ),
  waypoints: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
  ],
};

const NO_TOWERS: TowerState[] = [];

// ── PlacementSystem tests ─────────────────────────────────────────────────────

describe('PlacementSystem', () => {
  let ps: PlacementSystem;

  beforeEach(() => {
    ps = new PlacementSystem();
  });

  // ── Success case ────────────────────────────────────────────────────────────

  it('returns success=true for a valid placement on a buildable tile', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 200, 'idle', 2, 2, 'basic');
    expect(result.success).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.tower).toBeDefined();
    expect(result.goldSpent).toBe(100); // basic tower costs 100
  });

  it('success result contains correct tower fields', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 200, 'idle', 3, 3, 'basic');
    expect(result.success).toBe(true);
    const t = result.tower!;
    expect(t.gridX).toBe(3);
    expect(t.gridY).toBe(3);
    expect(t.archetype).toBe('basic');
    expect(t.uid).toMatch(/^tower_\d+$/);
    expect(t.cooldown).toBe(0);
    expect(t.worldX).toBeGreaterThan(0);
    expect(t.worldY).toBeGreaterThan(0);
  });

  it('uids are unique across successive placements', () => {
    const r1 = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'idle', 2, 2, 'basic');
    const r2 = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'idle', 3, 3, 'basic');
    expect(r1.tower!.uid).not.toBe(r2.tower!.uid);
  });

  it('allows placement when gameState is wave_cleared', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 200, 'wave_cleared', 2, 2, 'basic');
    expect(result.success).toBe(true);
  });

  // ── Failure: invalid_state ──────────────────────────────────────────────────

  it('returns invalid_state when gameState is wave_active', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'wave_active', 2, 2, 'basic');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_state');
  });

  it('returns invalid_state when gameState is placing', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'placing', 2, 2, 'basic');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_state');
  });

  it('returns invalid_state when gameState is game_over', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'game_over', 2, 2, 'basic');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_state');
  });

  it('returns invalid_state when gameState is victory', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'victory', 2, 2, 'basic');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('invalid_state');
  });

  // ── Failure: not_buildable ──────────────────────────────────────────────────

  it('returns not_buildable for a path tile (row 0)', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'idle', 3, 0, 'basic');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_buildable');
  });

  it('returns not_buildable for a blocked tile (row 1, col 0)', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'idle', 0, 1, 'basic');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_buildable');
  });

  it('returns not_buildable for out-of-bounds coords', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'idle', 99, 99, 'basic');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_buildable');
  });

  // ── Failure: occupied ──────────────────────────────────────────────────────

  it('returns occupied when a tower already exists at the tile', () => {
    const first = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'idle', 2, 2, 'basic');
    expect(first.success).toBe(true);
    // Place second tower at same tile using the first result in existingTowers
    const second = ps.attempt(MOCK_MAP, [first.tower!], 500, 'idle', 2, 2, 'basic');
    expect(second.success).toBe(false);
    expect(second.reason).toBe('occupied');
  });

  // ── Failure: insufficient_gold ──────────────────────────────────────────────

  it('returns insufficient_gold when player cannot afford the tower', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 50, 'idle', 2, 2, 'basic'); // basic costs 100
    expect(result.success).toBe(false);
    expect(result.reason).toBe('insufficient_gold');
  });

  it('allows placement when gold exactly equals cost', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 100, 'idle', 2, 2, 'basic'); // basic costs 100
    expect(result.success).toBe(true);
    expect(result.goldSpent).toBe(100);
  });

  it('reports correct goldSpent for fast archetype', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'idle', 2, 2, 'fast');
    expect(result.success).toBe(true);
    expect(result.goldSpent).toBe(75);
  });

  it('reports correct goldSpent for heavy archetype', () => {
    const result = ps.attempt(MOCK_MAP, NO_TOWERS, 500, 'idle', 2, 2, 'heavy');
    expect(result.success).toBe(true);
    expect(result.goldSpent).toBe(175);
  });
});

// ── GameStateStore tests ──────────────────────────────────────────────────────

describe('GameStateStore', () => {
  let store: GameStateStore;

  beforeEach(() => {
    store = new GameStateStore();
  });

  // ── Initial state ───────────────────────────────────────────────────────────

  it('initialises with correct values from BALANCE', () => {
    expect(store.gold).toBe(BALANCE.startingGold);
    expect(store.lives).toBe(BALANCE.startingLives);
    expect(store.wave).toBe(1);
    expect(store.totalWaves).toBe(BALANCE.totalWaves);
    expect(store.gameState).toBe('idle');
    expect(store.towers).toHaveLength(0);
  });

  // ── spendGold ──────────────────────────────────────────────────────────────

  it('spendGold reduces gold by the given amount', () => {
    store.spendGold(50);
    expect(store.gold).toBe(BALANCE.startingGold - 50);
  });

  it('spendGold does not go below 0', () => {
    store.spendGold(9999);
    expect(store.gold).toBe(0);
  });

  // ── earnGold ───────────────────────────────────────────────────────────────

  it('earnGold increases gold', () => {
    store.earnGold(100);
    expect(store.gold).toBe(BALANCE.startingGold + 100);
  });

  // ── loseLife ───────────────────────────────────────────────────────────────

  it('loseLife decrements lives', () => {
    store.loseLife();
    expect(store.lives).toBe(BALANCE.startingLives - 1);
  });

  it('loseLife does not go below 0', () => {
    for (let i = 0; i < BALANCE.startingLives + 5; i++) store.loseLife();
    expect(store.lives).toBe(0);
  });

  it('loseLife sets gameState to game_over when lives reach 0', () => {
    for (let i = 0; i < BALANCE.startingLives; i++) store.loseLife();
    expect(store.lives).toBe(0);
    expect(store.gameState).toBe('game_over');
  });

  // ── addTower / removeTower ─────────────────────────────────────────────────

  it('addTower appends a tower to the array', () => {
    const tower = makeTower('t1', 2, 2);
    store.addTower(tower);
    expect(store.towers).toHaveLength(1);
    expect(store.towers[0].uid).toBe('t1');
  });

  it('removeTower removes a tower by uid', () => {
    store.addTower(makeTower('t1', 2, 2));
    store.addTower(makeTower('t2', 3, 3));
    store.removeTower('t1');
    expect(store.towers).toHaveLength(1);
    expect(store.towers[0].uid).toBe('t2');
  });

  it('removeTower is a no-op for unknown uid', () => {
    store.addTower(makeTower('t1', 2, 2));
    store.removeTower('nonexistent');
    expect(store.towers).toHaveLength(1);
  });

  // ── nextWave ───────────────────────────────────────────────────────────────

  it('nextWave transitions idle → wave_active', () => {
    store.nextWave();
    expect(store.gameState).toBe('wave_active');
  });

  it('nextWave transitions wave_cleared → wave_active', () => {
    store.gameState = 'wave_cleared';
    store.nextWave();
    expect(store.gameState).toBe('wave_active');
  });

  it('nextWave is a no-op when gameState is wave_active', () => {
    store.gameState = 'wave_active';
    store.nextWave();
    expect(store.gameState).toBe('wave_active'); // unchanged
  });

  // ── onWaveCleared ──────────────────────────────────────────────────────────

  it('onWaveCleared increments wave and sets state to wave_cleared', () => {
    store.onWaveCleared();
    expect(store.wave).toBe(2);
    expect(store.gameState).toBe('wave_cleared');
  });

  it('onWaveCleared sets victory when last wave is cleared', () => {
    store.wave = BALANCE.totalWaves;
    store.onWaveCleared();
    expect(store.gameState).toBe('victory');
    // wave counter should NOT increment beyond totalWaves
    expect(store.wave).toBe(BALANCE.totalWaves);
  });

  it('full wave run: idle → wave_active × totalWaves → victory', () => {
    for (let w = 1; w <= BALANCE.totalWaves; w++) {
      store.nextWave();
      expect(store.gameState).toBe('wave_active');
      store.onWaveCleared();
      if (w < BALANCE.totalWaves) {
        expect(store.gameState).toBe('wave_cleared');
        expect(store.wave).toBe(w + 1);
      } else {
        expect(store.gameState).toBe('victory');
      }
    }
  });

  // ── snapshot ───────────────────────────────────────────────────────────────

  it('snapshot returns an object with the correct shape', () => {
    const snap = store.snapshot();
    expect(snap).toHaveProperty('gold', BALANCE.startingGold);
    expect(snap).toHaveProperty('lives', BALANCE.startingLives);
    expect(snap).toHaveProperty('wave', 1);
    expect(snap).toHaveProperty('totalWaves', BALANCE.totalWaves);
    expect(snap).toHaveProperty('gameState', 'idle');
    expect(snap).toHaveProperty('towers');
    expect(Array.isArray(snap.towers)).toBe(true);
  });

  it('snapshot towers array is a copy — mutating store does not affect the snapshot', () => {
    const snap = store.snapshot();
    store.addTower(makeTower('t1', 2, 2));
    expect(snap.towers).toHaveLength(0); // snapshot is frozen
    expect(store.towers).toHaveLength(1);
  });
});

// ── Helper ────────────────────────────────────────────────────────────────────

function makeTower(uid: string, gridX: number, gridY: number): TowerState {
  return {
    uid,
    archetype: 'basic',
    gridX,
    gridY,
    worldX: 0,
    worldY: 0,
    cooldown: 0,
    level: 1,
    definition: {
      id: 'basic',
      displayName: 'Archer',
      cost: 100,
      damage: 20,
      range: 160,
      fireRate: 1.5,
      critRate: 0.1,
      critDamage: 1.5,
      color: 0x3b82f6,
      radius: 14,
    },
  };
}
