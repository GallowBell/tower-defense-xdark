import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Vec2 } from '../../src/types/game';
import type { EnemyState } from '../../src/types/enemy';
import { ENEMY_DEFINITIONS } from '../../src/data/enemyDefinitions';
import { PathSystem } from '../../src/systems/path/PathSystem';
import { EnemyFactory } from '../../src/systems/enemies/EnemyFactory';
import { WaveSystem } from '../../src/systems/waves/WaveSystem';
import type { WaveDefinition } from '../../src/systems/waves/waveDefinitions';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal EnemyState for path tests. */
function makeEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    uid: 'enemy_0' as EnemyState['uid'],
    archetype: 'basic',
    hp: 80,
    maxHp: 80,
    speed: 100, // 100 px/s
    reward: 10,
    waypointIndex: 0,
    x: 0,
    y: 0,
    radius: 12,
    color: 0xef4444,
    dead: false,
    leaked: false,
    ...overrides,
  };
}

// Two-waypoint path: (0,0) → (100,0) — enemy starts at first waypoint
const WP_SIMPLE: Vec2[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

// Three-waypoint path: (0,0) → (100,0) → (100,200)
const WP_THREE: Vec2[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }];

// ═════════════════════════════════════════════════════════════════════════════
// PathSystem
// ═════════════════════════════════════════════════════════════════════════════
describe('PathSystem', () => {
  let ps: PathSystem;

  beforeEach(() => {
    ps = new PathSystem();
  });

  // ── 1. Basic movement ──────────────────────────────────────────────────────

  it('moves the enemy toward the next waypoint on advance()', () => {
    const enemy = makeEnemy({ x: 0, y: 0, speed: 100, waypointIndex: 1 });
    ps.advance(enemy, WP_SIMPLE, 0.5); // 100 px/s × 0.5 s = 50 px
    expect(enemy.x).toBeCloseTo(50);
    expect(enemy.y).toBeCloseTo(0);
    expect(enemy.leaked).toBe(false);
  });

  // ── 2. Exact arrival ──────────────────────────────────────────────────────

  it('arrives exactly at the waypoint when distance == pixels available', () => {
    // speed=100, dt=1.0 → travels 100 px, target is exactly 100 px away
    const enemy = makeEnemy({ x: 0, y: 0, speed: 100, waypointIndex: 1 });
    ps.advance(enemy, WP_SIMPLE, 1.0);
    expect(enemy.x).toBeCloseTo(100);
    expect(enemy.y).toBeCloseTo(0);
    // waypointIndex should have advanced past the final waypoint → leaked
    expect(enemy.leaked).toBe(true);
  });

  // ── 3. Advances to next waypoint index when arriving in the same tick ─────

  it('increments waypointIndex after arriving at a waypoint', () => {
    // WP_THREE: enemy starts at (0,0), target[1]=(100,0)
    // speed=100, dt=1.0 → exactly reaches (100,0), then still has 0 s remaining
    const enemy = makeEnemy({ x: 0, y: 0, speed: 100, waypointIndex: 1 });
    ps.advance(enemy, WP_THREE, 1.0);
    expect(enemy.x).toBeCloseTo(100);
    expect(enemy.y).toBeCloseTo(0);
    // Should have incremented to index 2, remaining=0 so no further movement
    expect(enemy.waypointIndex).toBe(2);
    expect(enemy.leaked).toBe(false);
  });

  // ── 4. Multi-waypoint traversal in a single advance() call ────────────────

  it('moves through multiple waypoints in one advance() when dt is large enough', () => {
    // WP_THREE: (0,0)→(100,0)→(100,200). Total path = 300 px.
    // speed=300, dt=1.0 → can travel all 300 px in one tick → leaked
    const enemy = makeEnemy({ x: 0, y: 0, speed: 300, waypointIndex: 1 });
    ps.advance(enemy, WP_THREE, 1.0);
    expect(enemy.leaked).toBe(true);
  });

  // ── 5. Sets leaked=true after passing the final waypoint ──────────────────

  it('sets leaked=true when the enemy passes the final waypoint', () => {
    const enemy = makeEnemy({ x: 0, y: 0, speed: 100, waypointIndex: 1 });
    ps.advance(enemy, WP_SIMPLE, 5.0); // way more than needed
    expect(enemy.leaked).toBe(true);
  });

  // ── 6. Does NOT move when already leaked ──────────────────────────────────

  it('does NOT move when the enemy is already leaked', () => {
    const enemy = makeEnemy({ x: 50, y: 0, speed: 100, waypointIndex: 1, leaked: true });
    ps.advance(enemy, WP_SIMPLE, 1.0);
    expect(enemy.x).toBe(50); // position unchanged
    expect(enemy.y).toBe(0);
  });

  // ── 7. Does NOT overshoot past waypoint on a big dt ───────────────────────

  it('does not overshoot the last waypoint — stops at it (leaked flag set)', () => {
    // speed=100, dt=2.0 → 200 px available; target is 100 px away
    const enemy = makeEnemy({ x: 0, y: 0, speed: 100, waypointIndex: 1 });
    ps.advance(enemy, WP_SIMPLE, 2.0);
    // Enemy should end at (100,0) — the final waypoint — and be leaked
    expect(enemy.x).toBeCloseTo(100);
    expect(enemy.y).toBeCloseTo(0);
    expect(enemy.leaked).toBe(true);
  });

  // ── 8. Zero-speed enemy never moves ──────────────────────────────────────

  it('does not move when enemy speed is 0', () => {
    const enemy = makeEnemy({ x: 0, y: 0, speed: 0, waypointIndex: 1 });
    ps.advance(enemy, WP_SIMPLE, 1.0);
    expect(enemy.x).toBe(0);
    expect(enemy.y).toBe(0);
    expect(enemy.leaked).toBe(false);
  });

  // ── 9. Partial movement — enemy doesn't reach waypoint ────────────────────

  it('partially moves toward waypoint and leaves waypointIndex unchanged', () => {
    const enemy = makeEnemy({ x: 0, y: 0, speed: 50, waypointIndex: 1 });
    ps.advance(enemy, WP_SIMPLE, 1.0); // 50 px, target is 100 px away
    expect(enemy.x).toBeCloseTo(50);
    expect(enemy.waypointIndex).toBe(1); // hasn't arrived yet
    expect(enemy.leaked).toBe(false);
  });

  // ── 10. Does NOT move when dead ───────────────────────────────────────────

  it('does not move when enemy is dead', () => {
    const enemy = makeEnemy({ x: 0, y: 0, speed: 100, waypointIndex: 1, dead: true });
    ps.advance(enemy, WP_SIMPLE, 1.0);
    expect(enemy.x).toBe(0);
    expect(enemy.y).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// EnemyFactory
// ═════════════════════════════════════════════════════════════════════════════
describe('EnemyFactory', () => {
  let factory: EnemyFactory;
  const spawnPos: Vec2 = { x: 56, y: 120 };

  beforeEach(() => {
    factory = new EnemyFactory();
  });

  // ── 1. Correct archetype stats ────────────────────────────────────────────

  it('creates a basic enemy with correct stats from ENEMY_DEFINITIONS', () => {
    const def = ENEMY_DEFINITIONS.basic;
    const enemy = factory.create('basic', spawnPos);
    expect(enemy.archetype).toBe('basic');
    expect(enemy.hp).toBe(def.hp);
    expect(enemy.maxHp).toBe(def.hp);
    expect(enemy.speed).toBe(def.speed);
    expect(enemy.reward).toBe(def.reward);
    expect(enemy.radius).toBe(def.radius);
    expect(enemy.color).toBe(def.color);
  });

  it('creates a fast enemy with correct stats', () => {
    const def = ENEMY_DEFINITIONS.fast;
    const enemy = factory.create('fast', spawnPos);
    expect(enemy.speed).toBe(def.speed);
    expect(enemy.hp).toBe(def.hp);
  });

  it('creates a tank enemy with correct stats', () => {
    const def = ENEMY_DEFINITIONS.tank;
    const enemy = factory.create('tank', spawnPos);
    expect(enemy.speed).toBe(def.speed);
    expect(enemy.hp).toBe(def.hp);
    expect(enemy.radius).toBe(def.radius);
  });

  // ── 2. uid format and incrementing ───────────────────────────────────────

  it('uid format is "enemy_0" for the first enemy', () => {
    const enemy = factory.create('basic', spawnPos);
    expect(enemy.uid).toBe('enemy_0');
  });

  it('uid increments: "enemy_0", "enemy_1", "enemy_2"', () => {
    const e0 = factory.create('basic', spawnPos);
    const e1 = factory.create('fast', spawnPos);
    const e2 = factory.create('tank', spawnPos);
    expect(e0.uid).toBe('enemy_0');
    expect(e1.uid).toBe('enemy_1');
    expect(e2.uid).toBe('enemy_2');
  });

  // ── 3. hp and maxHp both equal definition.hp ─────────────────────────────

  it('hp and maxHp are both set to definition.hp', () => {
    const enemy = factory.create('tank', spawnPos);
    expect(enemy.hp).toBe(enemy.maxHp);
    expect(enemy.hp).toBe(ENEMY_DEFINITIONS.tank.hp);
  });

  // ── 4. waypointIndex starts at 0 ─────────────────────────────────────────

  it('waypointIndex starts at 0', () => {
    const enemy = factory.create('basic', spawnPos);
    expect(enemy.waypointIndex).toBe(0);
  });

  // ── 5. dead and leaked both start false ──────────────────────────────────

  it('dead starts as false', () => {
    const enemy = factory.create('basic', spawnPos);
    expect(enemy.dead).toBe(false);
  });

  it('leaked starts as false', () => {
    const enemy = factory.create('basic', spawnPos);
    expect(enemy.leaked).toBe(false);
  });

  // ── 6. spawn position applied correctly ──────────────────────────────────

  it('places the enemy at the given spawnPos', () => {
    const pos: Vec2 = { x: 200, y: 300 };
    const enemy = factory.create('basic', pos);
    expect(enemy.x).toBe(200);
    expect(enemy.y).toBe(300);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WaveSystem
// ═════════════════════════════════════════════════════════════════════════════
describe('WaveSystem', () => {
  let factory: EnemyFactory;
  let ws: WaveSystem;
  const spawnPos: Vec2 = { x: 56, y: 120 };

  /** Simple wave: 2 basic enemies, interval 1.0 s */
  const SIMPLE_WAVE: WaveDefinition = {
    index: 0,
    entries: [{ archetype: 'basic', count: 2, interval: 1.0 }],
    goldBonus: 10,
  };

  /** Two-entry wave: 2 basics then 1 fast */
  const TWO_ENTRY_WAVE: WaveDefinition = {
    index: 1,
    entries: [
      { archetype: 'basic', count: 2, interval: 0.5 },
      { archetype: 'fast', count: 1, interval: 0.8 },
    ],
    goldBonus: 20,
  };

  beforeEach(() => {
    factory = new EnemyFactory();
    ws = new WaveSystem(factory);
  });

  // ── 1. startWave resets state ─────────────────────────────────────────────

  it('startWave resets isSpawnComplete to false', () => {
    ws.startWave(SIMPLE_WAVE);
    // Exhaust the wave fully
    const spawned: EnemyState[] = [];
    let completeCalled = 0;
    const cb = { onSpawn: (e: EnemyState) => { spawned.push(e); }, onWaveSpawnComplete: () => { completeCalled++; } };
    ws.update(0, spawnPos, cb);
    ws.update(2.0, spawnPos, cb);
    expect(ws.isSpawnComplete).toBe(true);
    // Restart
    ws.startWave(SIMPLE_WAVE);
    expect(ws.isSpawnComplete).toBe(false);
  });

  it('startWave resets internal counters so spawning begins fresh', () => {
    ws.startWave(SIMPLE_WAVE);
    ws.startWave(SIMPLE_WAVE); // reset immediately
    const spawned: EnemyState[] = [];
    ws.update(0, spawnPos, { onSpawn: (e) => spawned.push(e), onWaveSpawnComplete: () => {} });
    // After second startWave + first tick, first enemy should spawn
    expect(spawned.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. First enemy spawns on first update call (timer starts at 0) ────────

  it('spawns the first enemy on the very first update call', () => {
    ws.startWave(SIMPLE_WAVE);
    const spawned: EnemyState[] = [];
    ws.update(0, spawnPos, { onSpawn: (e) => spawned.push(e), onWaveSpawnComplete: () => {} });
    expect(spawned.length).toBe(1);
    expect(spawned[0].archetype).toBe('basic');
  });

  // ── 3. Second enemy spawns after entry.interval seconds ──────────────────

  it('does not spawn second enemy before interval has elapsed', () => {
    ws.startWave(SIMPLE_WAVE);
    const spawned: EnemyState[] = [];
    const cb = { onSpawn: (e: EnemyState) => spawned.push(e), onWaveSpawnComplete: () => {} };
    ws.update(0, spawnPos, cb);   // first enemy
    ws.update(0.4, spawnPos, cb); // interval=1.0, 0.4 < 1.0 → no new spawn
    expect(spawned.length).toBe(1);
  });

  it('spawns second enemy after interval seconds have elapsed', () => {
    ws.startWave(SIMPLE_WAVE);
    const spawned: EnemyState[] = [];
    const cb = { onSpawn: (e: EnemyState) => spawned.push(e), onWaveSpawnComplete: () => {} };
    ws.update(0, spawnPos, cb);   // first enemy
    ws.update(1.0, spawnPos, cb); // interval=1.0, exactly 1.0 s → second spawn
    expect(spawned.length).toBe(2);
  });

  // ── 4. onWaveSpawnComplete fires after all entries exhausted ─────────────

  it('calls onWaveSpawnComplete after all enemies are spawned', () => {
    ws.startWave(SIMPLE_WAVE);
    let completeCalled = 0;
    const cb = { onSpawn: () => {}, onWaveSpawnComplete: () => { completeCalled++; } };
    ws.update(0, spawnPos, cb);   // spawn 1
    ws.update(1.0, spawnPos, cb); // spawn 2 → complete
    expect(completeCalled).toBe(1);
  });

  // ── 5. Multiple entries spawn sequentially ────────────────────────────────

  it('after first entry done, second entry starts spawning', () => {
    ws.startWave(TWO_ENTRY_WAVE);
    const spawned: EnemyState[] = [];
    const cb = { onSpawn: (e: EnemyState) => spawned.push(e), onWaveSpawnComplete: () => {} };
    ws.update(0, spawnPos, cb);    // spawn basic #1
    ws.update(0.5, spawnPos, cb);  // spawn basic #2 → entry done, next entry starts
    ws.update(0.8, spawnPos, cb);  // spawn fast #1
    const archetypes = spawned.map(e => e.archetype);
    expect(archetypes).toContain('basic');
    expect(archetypes).toContain('fast');
    // Two basics, one fast
    expect(archetypes.filter(a => a === 'basic').length).toBe(2);
    expect(archetypes.filter(a => a === 'fast').length).toBe(1);
  });

  // ── 6. isSpawnComplete returns false before done, true after ─────────────

  it('isSpawnComplete is false before wave starts', () => {
    expect(ws.isSpawnComplete).toBe(false);
  });

  it('isSpawnComplete is false after partial spawn', () => {
    ws.startWave(SIMPLE_WAVE);
    ws.update(0, spawnPos, { onSpawn: () => {}, onWaveSpawnComplete: () => {} });
    expect(ws.isSpawnComplete).toBe(false); // still 1 more to spawn
  });

  it('isSpawnComplete is true after all enemies spawned', () => {
    ws.startWave(SIMPLE_WAVE);
    const cb = { onSpawn: () => {}, onWaveSpawnComplete: () => {} };
    ws.update(0, spawnPos, cb);
    ws.update(1.0, spawnPos, cb);
    expect(ws.isSpawnComplete).toBe(true);
  });

  // ── 7. onWaveSpawnComplete fires only once ────────────────────────────────

  it('onWaveSpawnComplete fires exactly once, not on subsequent updates', () => {
    ws.startWave(SIMPLE_WAVE);
    let completeCalled = 0;
    const cb = { onSpawn: () => {}, onWaveSpawnComplete: () => { completeCalled++; } };
    ws.update(0, spawnPos, cb);
    ws.update(1.0, spawnPos, cb);   // triggers complete
    ws.update(1.0, spawnPos, cb);   // no-op after complete
    ws.update(1.0, spawnPos, cb);   // no-op after complete
    expect(completeCalled).toBe(1);
  });

  // ── 8. Spawned enemies get correct factory-generated uids ─────────────────

  it('spawned enemies have incrementing uids from the factory', () => {
    ws.startWave(SIMPLE_WAVE);
    const spawned: EnemyState[] = [];
    const cb = { onSpawn: (e: EnemyState) => spawned.push(e), onWaveSpawnComplete: () => {} };
    ws.update(0, spawnPos, cb);
    ws.update(1.0, spawnPos, cb);
    expect(spawned[0].uid).toBe('enemy_0');
    expect(spawned[1].uid).toBe('enemy_1');
  });

  // ── 9. No update fires when no wave is active ─────────────────────────────

  it('update is a no-op when no wave has been started', () => {
    // Should not throw
    expect(() => {
      ws.update(1.0, spawnPos, { onSpawn: () => {}, onWaveSpawnComplete: () => {} });
    }).not.toThrow();
    expect(ws.isSpawnComplete).toBe(false);
  });

  // ── 10. Using vi.fn() for spy-based callback verification ─────────────────

  it('onSpawn is called once per enemy', () => {
    ws.startWave(SIMPLE_WAVE);
    const onSpawn = vi.fn();
    const onWaveSpawnComplete = vi.fn();
    ws.update(0, spawnPos, { onSpawn, onWaveSpawnComplete });
    ws.update(1.0, spawnPos, { onSpawn, onWaveSpawnComplete });
    expect(onSpawn).toHaveBeenCalledTimes(2);
    expect(onWaveSpawnComplete).toHaveBeenCalledTimes(1);
  });
});
