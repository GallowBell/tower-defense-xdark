import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { TowerDefinition, TowerState } from '../../src/types/tower';
import type { EnemyState, EnemyId } from '../../src/types/enemy';
import { TargetingSystem } from '../../src/systems/combat/TargetingSystem';
import { DamageSystem } from '../../src/systems/combat/DamageSystem';
import { CombatSystem } from '../../src/systems/combat/CombatSystem';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_TOWER_DEF: TowerDefinition = {
  id: 'basic',
  displayName: 'Archer',
  cost: 100,
  damage: 20,
  range: 200,
  fireRate: 1.5,
  critRate: 0.1,
  critDamage: 1.5,
  splashRadius: 0,
  color: 0x3b82f6,
  radius: 14,
};

function makeTower(overrides?: Partial<TowerState>): TowerState {
  // baseDefinition follows a `definition` override so the two never disagree.
  const definition = overrides?.definition ?? DEFAULT_TOWER_DEF;
  return {
    uid: 'tower_0',
    archetype: 'basic',
    gridX: 5,
    gridY: 5,
    worldX: 100,
    worldY: 100,
    cooldown: 0,
    targetUid: null,
    level: 1,
    investedGold: 100,
    baseDefinition: definition,
    definition,
    ...overrides,
  };
}

function makeEnemy(overrides?: Partial<EnemyState>): EnemyState {
  return {
    uid: 'enemy_0' as EnemyId,
    archetype: 'basic',
    hp: 80,
    maxHp: 80,
    speed: 80,
    reward: 10,
    armor: 0,
    waypointIndex: 0,
    x: 100,
    y: 200,
    radius: 12,
    color: 0xef4444,
    dead: false,
    leaked: false,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// TargetingSystem
// ═════════════════════════════════════════════════════════════════════════════
describe('TargetingSystem', () => {
  let ts: TargetingSystem;

  beforeEach(() => {
    ts = new TargetingSystem();
  });

  // ── 1. Empty enemies list ─────────────────────────────────────────────────
  it('returns null when there are no enemies', () => {
    const tower = makeTower();
    expect(ts.findTarget(tower, [])).toBeNull();
  });

  // ── 2. All enemies dead ───────────────────────────────────────────────────
  it('returns null when all enemies are dead', () => {
    const tower = makeTower();
    const enemies = [
      makeEnemy({ uid: 'enemy_0' as EnemyId, dead: true }),
      makeEnemy({ uid: 'enemy_1' as EnemyId, dead: true }),
    ];
    expect(ts.findTarget(tower, enemies)).toBeNull();
  });

  // ── 3. All enemies out of range ───────────────────────────────────────────
  it('returns null when all enemies are out of range', () => {
    // Tower at (100,100), range=200; enemy at (1000, 1000) — far away
    const tower = makeTower({ worldX: 100, worldY: 100 });
    const enemy = makeEnemy({ x: 1000, y: 1000 });
    expect(ts.findTarget(tower, [enemy])).toBeNull();
  });

  // ── 4. All enemies have leaked ────────────────────────────────────────────
  it('returns null when all enemies have leaked', () => {
    const tower = makeTower();
    const enemies = [
      makeEnemy({ uid: 'enemy_0' as EnemyId, leaked: true }),
      makeEnemy({ uid: 'enemy_1' as EnemyId, leaked: true }),
    ];
    expect(ts.findTarget(tower, enemies)).toBeNull();
  });

  // ── 5. Single in-range enemy ──────────────────────────────────────────────
  it('returns an in-range enemy when one is present', () => {
    const tower = makeTower({ worldX: 0, worldY: 0 });
    // distance = sqrt(60^2 + 80^2) = 100, range = 200 → within range
    const enemy = makeEnemy({ x: 60, y: 80 });
    expect(ts.findTarget(tower, [enemy])).toBe(enemy);
  });

  // ── 6. Returns enemy with highest waypointIndex (not closest) ────────────
  it('returns enemy with highest waypointIndex, not the closest one', () => {
    const tower = makeTower({ worldX: 0, worldY: 0 });
    // enemyA is closer but further back on path
    const enemyA = makeEnemy({
      uid: 'enemy_a' as EnemyId,
      x: 10,
      y: 0,
      waypointIndex: 1,
    });
    // enemyB is farther but ahead on path
    const enemyB = makeEnemy({
      uid: 'enemy_b' as EnemyId,
      x: 150,
      y: 0,
      waypointIndex: 5,
    });
    // both within range=200
    const result = ts.findTarget(tower, [enemyA, enemyB]);
    expect(result).toBe(enemyB);
  });

  // ── 7. Tie-break: same waypointIndex → pick closer to tower ──────────────
  it('tie-breaks on waypointIndex by picking the enemy closer to the tower', () => {
    const tower = makeTower({ worldX: 0, worldY: 0 });
    // Both at same waypointIndex, different distances
    const enemyClose = makeEnemy({
      uid: 'enemy_close' as EnemyId,
      x: 50,
      y: 0,
      waypointIndex: 3,
    });
    const enemyFar = makeEnemy({
      uid: 'enemy_far' as EnemyId,
      x: 120,
      y: 0,
      waypointIndex: 3,
    });
    const result = ts.findTarget(tower, [enemyFar, enemyClose]);
    expect(result).toBe(enemyClose);
  });

  // ── 8. Dead enemies ignored even with high waypointIndex ─────────────────
  it('ignores dead enemies even if in range with high waypointIndex', () => {
    const tower = makeTower({ worldX: 0, worldY: 0 });
    const deadEnemy = makeEnemy({
      uid: 'enemy_dead' as EnemyId,
      x: 10,
      y: 0,
      waypointIndex: 99,
      dead: true,
    });
    const liveEnemy = makeEnemy({
      uid: 'enemy_live' as EnemyId,
      x: 50,
      y: 0,
      waypointIndex: 1,
    });
    const result = ts.findTarget(tower, [deadEnemy, liveEnemy]);
    expect(result).toBe(liveEnemy);
  });

  // ── 9. Boundary: enemy exactly at range distance ──────────────────────────
  it('includes enemy at exactly the tower range boundary', () => {
    // range = 200, place enemy exactly 200px away
    const tower = makeTower({
      worldX: 0,
      worldY: 0,
      definition: makeTower().definition,
    });
    const enemy = makeEnemy({ x: 200, y: 0 }); // dist = 200 exactly
    // dist (200) is NOT > range (200), so it should be in range
    expect(ts.findTarget(tower, [enemy])).toBe(enemy);
  });

  // ── 10. Enemy just outside range is excluded ─────────────────────────────
  it('excludes enemy just beyond the range', () => {
    const tower = makeTower({ worldX: 0, worldY: 0 });
    const enemy = makeEnemy({ x: 201, y: 0 }); // 201 > 200
    expect(ts.findTarget(tower, [enemy])).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DamageSystem
// ═════════════════════════════════════════════════════════════════════════════
describe('DamageSystem', () => {
  let ds: DamageSystem;

  beforeEach(() => {
    ds = new DamageSystem();
    // Never crit by default. Without this the exact-damage assertions below
    // roll a live 10% crit chance and the file fails ~2 runs in 5.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Reduces enemy HP by tower damage ──────────────────────────────────
  it('reduces enemy HP by the tower damage amount', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 80 });
    ds.applyHit(tower, enemy);
    expect(enemy.hp).toBe(60);
  });

  // ── 2. Clamps HP to 0 (not negative) ─────────────────────────────────────
  it('clamps enemy HP to 0 when damage exceeds current HP', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 5 });
    ds.applyHit(tower, enemy);
    expect(enemy.hp).toBe(0);
  });

  // ── 3. Returns killed=false when HP > 0 after hit ────────────────────────
  it('returns killed=false and goldEarned=0 when HP is still above 0', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 80 });
    const result = ds.applyHit(tower, enemy);
    expect(result.killed).toBe(false);
    expect(result.goldEarned).toBe(0);
  });

  // ── 4. Returns killed=true when HP reaches exactly 0 ─────────────────────
  it('returns killed=true and goldEarned=enemy.reward when HP hits exactly 0', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 20, reward: 15 });
    const result = ds.applyHit(tower, enemy);
    expect(result.killed).toBe(true);
    expect(result.goldEarned).toBe(15);
  });

  // ── 5. Returns killed=true when damage exceeds remaining HP ──────────────
  it('returns killed=true when damage exceeds remaining HP', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 10, reward: 25 });
    const result = ds.applyHit(tower, enemy);
    expect(result.killed).toBe(true);
    expect(result.goldEarned).toBe(25);
  });

  // ── 6. Sets enemy.dead=true when killed ──────────────────────────────────
  it('sets enemy.dead = true when the enemy is killed', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 20 });
    ds.applyHit(tower, enemy);
    expect(enemy.dead).toBe(true);
  });

  // ── 7. Does NOT set enemy.dead when not killed ───────────────────────────
  it('does not set enemy.dead when enemy survives the hit', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 80 });
    ds.applyHit(tower, enemy);
    expect(enemy.dead).toBe(false);
  });

  // ── 8. Multiple hits accumulate correctly ─────────────────────────────────
  it('multiple hits accumulate damage correctly', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 80 });
    ds.applyHit(tower, enemy); // hp = 60
    ds.applyHit(tower, enemy); // hp = 40
    ds.applyHit(tower, enemy); // hp = 20
    expect(enemy.hp).toBe(20);
    expect(enemy.dead).toBe(false);
    const result = ds.applyHit(tower, enemy); // hp = 0
    expect(result.killed).toBe(true);
    expect(enemy.dead).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CombatSystem
// ═════════════════════════════════════════════════════════════════════════════
describe('CombatSystem', () => {
  let cs: CombatSystem;

  beforeEach(() => {
    cs = new CombatSystem();
  });

  // ── 1. Returns empty array when no enemies ────────────────────────────────
  it('returns empty array when there are no enemies', () => {
    const tower = makeTower();
    const events = cs.tick([tower], [], 0.1);
    expect(events).toHaveLength(0);
  });

  // ── 2. Returns empty array when all enemies are out of range ──────────────
  it('returns empty array when all enemies are out of range', () => {
    const tower = makeTower({ worldX: 0, worldY: 0 });
    const enemy = makeEnemy({ x: 5000, y: 5000 });
    const events = cs.tick([tower], [enemy], 0.1);
    expect(events).toHaveLength(0);
  });

  // ── 3. Tower with cooldown > 0 does not fire ─────────────────────────────
  it('tower with cooldown > 0 does not fire', () => {
    const tower = makeTower({ cooldown: 0.5 });
    const enemy = makeEnemy({ x: 100, y: 100 }); // same pos as tower — within range
    const events = cs.tick([tower], [enemy], 0.1); // dt=0.1 < cooldown=0.5
    expect(events).toHaveLength(0);
  });

  // ── 4. Tower with cooldown=0 fires when target is available ──────────────
  it('tower with cooldown=0 fires when a target is in range', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 });
    const enemy = makeEnemy({ x: 50, y: 0 });
    const events = cs.tick([tower], [enemy], 0.016);
    expect(events).toHaveLength(1);
  });

  // ── 5. Tower cooldown resets to 1/fireRate after firing ──────────────────
  it('tower cooldown is reset to 1/fireRate after firing', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 });
    // fireRate = 1.5 → cooldown = 1/1.5 ≈ 0.6667
    const enemy = makeEnemy({ x: 50, y: 0 });
    cs.tick([tower], [enemy], 0.016);
    expect(tower.cooldown).toBeCloseTo(1 / 1.5);
  });

  // ── 6. Multiple towers fire independently in same tick ───────────────────
  it('multiple towers fire independently in the same tick', () => {
    const tower1 = makeTower({
      uid: 'tower_1',
      worldX: 0,
      worldY: 0,
      cooldown: 0,
    });
    const tower2 = makeTower({
      uid: 'tower_2',
      worldX: 200,
      worldY: 0,
      cooldown: 0,
    });
    // One enemy in range of tower1 only (at x=50, tower2 is at x=200, range=200 → dist=150, in range!)
    // Put enemy far from tower2: x=50, tower2 at x=200 → dist=150 < 200 — both can hit
    // Let's put a second enemy only near tower2
    const enemy1 = makeEnemy({ uid: 'enemy_1' as EnemyId, x: 50, y: 0 });
    const enemy2 = makeEnemy({ uid: 'enemy_2' as EnemyId, x: 200, y: 0 });
    const events = cs.tick([tower1, tower2], [enemy1, enemy2], 0.016);
    // Both towers fired at least once
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  // ── 7. ShotEvent has correct tower, target, killed, goldEarned ───────────
  it('ShotEvent contains correct tower, target, killed, and goldEarned fields', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 });
    // damage=20, enemy hp=20 → exact kill
    const enemy = makeEnemy({ x: 50, y: 0, hp: 20, maxHp: 20, reward: 10 });
    const events = cs.tick([tower], [enemy], 0.016);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.tower).toBe(tower);
    expect(e.target).toBe(enemy);
    expect(e.killed).toBe(true);
    expect(e.goldEarned).toBe(10);
  });

  // ── 8. Tower does NOT fire when cooldown > 0 even if target available ─────
  it('tower does NOT fire when cooldown > dt even though target is available', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 1.0 });
    const enemy = makeEnemy({ x: 50, y: 0 });
    const events = cs.tick([tower], [enemy], 0.016);
    expect(events).toHaveLength(0);
    // hp should be unchanged
    expect(enemy.hp).toBe(80);
  });

  // ── 9. Dead enemy is not targeted again in same tick ─────────────────────
  it('dead enemy is not targeted after being killed by another tower in same tick', () => {
    // Two towers, same target, enemy has 20 hp (one-shot kill with damage=20)
    const tower1 = makeTower({
      uid: 'tower_1',
      worldX: 0,
      worldY: 0,
      cooldown: 0,
    });
    const tower2 = makeTower({
      uid: 'tower_2',
      worldX: 10,
      worldY: 0,
      cooldown: 0,
    });
    const enemy = makeEnemy({ x: 50, y: 0, hp: 20, maxHp: 20 });
    const events = cs.tick([tower1, tower2], [enemy], 0.016);
    // tower1 kills the enemy; tower2 should not fire at a dead enemy
    const killEvents = events.filter((ev) => ev.killed);
    expect(killEvents).toHaveLength(1);
    // tower2 should produce 0 events because its target was dead
    expect(events).toHaveLength(1);
  });

  // ── 10. Tick decrements cooldown correctly by dt ─────────────────────────
  it('tick decrements tower cooldown by dt', () => {
    const tower = makeTower({ cooldown: 0.5 });
    const events = cs.tick([tower], [], 0.2); // no enemies, just decrement
    expect(tower.cooldown).toBeCloseTo(0.3);
    expect(events).toHaveLength(0);
  });

  // ── 11. Cooldown decremented to 0, not negative ───────────────────────────
  it('cooldown is clamped to 0 when dt > remaining cooldown', () => {
    const tower = makeTower({ cooldown: 0.1 });
    cs.tick([tower], [], 0.5); // no enemies
    expect(tower.cooldown).toBe(0);
  });

  // ── 12. Tower fires exactly once per tick ─────────────────────────────────
  it('tower fires at most once per tick regardless of dt', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 });
    const enemy1 = makeEnemy({
      uid: 'enemy_1' as EnemyId,
      x: 50,
      y: 0,
      waypointIndex: 5,
    });
    const enemy2 = makeEnemy({
      uid: 'enemy_2' as EnemyId,
      x: 80,
      y: 0,
      waypointIndex: 4,
    });
    const events = cs.tick([tower], [enemy1, enemy2], 1.0); // large dt
    // Tower fires once (not twice even though dt=1.0 >> cooldown period)
    expect(events).toHaveLength(1);
  });

  // ── 13. ShotEvent killed=false and goldEarned=0 when enemy survives ───────
  it('ShotEvent has killed=false and goldEarned=0 when enemy survives the hit', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 }); // damage = 20
    const enemy = makeEnemy({ x: 50, y: 0, hp: 80, reward: 10 }); // survives
    const events = cs.tick([tower], [enemy], 0.016);
    expect(events).toHaveLength(1);
    expect(events[0].killed).toBe(false);
    expect(events[0].goldEarned).toBe(0);
  });

  // ── 14. Tower does not fire if no target, stays at cooldown=0 ─────────────
  it('tower stays at cooldown=0 when no target is found (ready to fire next tick)', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 });
    cs.tick([tower], [], 0.016);
    expect(tower.cooldown).toBe(0);
  });

  // ── 15. Returns empty events when towers list is empty ────────────────────
  it('returns empty array when there are no towers', () => {
    const enemy = makeEnemy({ x: 50, y: 0 });
    const events = cs.tick([], [enemy], 0.016);
    expect(events).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DamageSystem — armor
// ═════════════════════════════════════════════════════════════════════════════
describe('DamageSystem armor', () => {
  let ds: DamageSystem;

  beforeEach(() => {
    ds = new DamageSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never crit
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subtracts armor from every hit', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 80, armor: 6 });

    const result = ds.applyHit(tower, enemy);

    expect(result.damageDealt).toBe(14);
    expect(enemy.hp).toBe(66);
  });

  it('always lands at least 1 damage, however heavy the armor', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 80, armor: 500 });

    const result = ds.applyHit(tower, enemy);

    expect(result.damageDealt).toBe(1);
    expect(enemy.hp).toBe(79);
  });

  it('applies armor after the crit multiplier, so crits still punch through', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // force a crit
    const tower = makeTower(); // damage 20, critDamage 1.5 → 30 raw
    const enemy = makeEnemy({ hp: 80, armor: 6 });

    const result = ds.applyHit(tower, enemy);

    expect(result.wasCrit).toBe(true);
    expect(result.damageDealt).toBe(24); // 30 - 6, not floor((20 - 6) * 1.5)
  });

  it('blunts a Gunner against armor far more than a Cannon', () => {
    // The whole point of armor: it gives each tower an enemy.
    const gunner = makeTower({
      definition: { ...DEFAULT_TOWER_DEF, damage: 8 },
    });
    const cannon = makeTower({
      definition: { ...DEFAULT_TOWER_DEF, damage: 80 },
    });
    const brute = () => makeEnemy({ hp: 300, armor: 6 });

    const gunnerHit = ds.applyHit(gunner, brute());
    const cannonHit = ds.applyHit(cannon, brute());

    expect(gunnerHit.damageDealt).toBe(2); // 75% of the pellet absorbed
    expect(cannonHit.damageDealt).toBe(74); // barely noticed
  });

  it('leaves unarmored enemies taking full damage', () => {
    const tower = makeTower(); // damage = 20
    const enemy = makeEnemy({ hp: 80, armor: 0 });

    expect(ds.applyHit(tower, enemy).damageDealt).toBe(20);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DamageSystem — splash
// ═════════════════════════════════════════════════════════════════════════════
describe('DamageSystem splash', () => {
  let ds: DamageSystem;

  /** A tower with a 60px blast radius, like the Cannon. */
  function splashTower(damage = 20): TowerState {
    return makeTower({
      definition: { ...DEFAULT_TOWER_DEF, damage, splashRadius: 60 },
    });
  }

  beforeEach(() => {
    ds = new DamageSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never crit
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not splash when splashRadius is 0', () => {
    const tower = makeTower(); // splashRadius 0
    const primary = makeEnemy({ uid: 'enemy_0' as EnemyId, x: 0, y: 0 });
    const neighbour = makeEnemy({
      uid: 'enemy_1' as EnemyId,
      x: 10,
      y: 0,
      hp: 80,
    });

    const result = ds.applyHit(tower, primary, [primary, neighbour]);

    expect(result.splashHits).toHaveLength(0);
    expect(neighbour.hp).toBe(80);
  });

  it('damages every live enemy inside the blast radius', () => {
    const primary = makeEnemy({ uid: 'enemy_0' as EnemyId, x: 0, y: 0 });
    const near = makeEnemy({ uid: 'enemy_1' as EnemyId, x: 50, y: 0, hp: 80 });
    const alsoNear = makeEnemy({
      uid: 'enemy_2' as EnemyId,
      x: 0,
      y: 30,
      hp: 80,
    });

    const result = ds.applyHit(splashTower(), primary, [
      primary,
      near,
      alsoNear,
    ]);

    expect(result.splashHits).toHaveLength(2);
    expect(near.hp).toBe(60);
    expect(alsoNear.hp).toBe(60);
  });

  it('spares enemies beyond the blast radius', () => {
    const primary = makeEnemy({ uid: 'enemy_0' as EnemyId, x: 0, y: 0 });
    const far = makeEnemy({ uid: 'enemy_1' as EnemyId, x: 61, y: 0, hp: 80 });

    const result = ds.applyHit(splashTower(), primary, [primary, far]);

    expect(result.splashHits).toHaveLength(0);
    expect(far.hp).toBe(80);
  });

  it('never counts the primary target as its own splash victim', () => {
    const primary = makeEnemy({
      uid: 'enemy_0' as EnemyId,
      x: 0,
      y: 0,
      hp: 80,
    });

    const result = ds.applyHit(splashTower(), primary, [primary]);

    expect(result.splashHits).toHaveLength(0);
    expect(primary.hp).toBe(60); // hit exactly once
  });

  it('skips enemies that are already dead or leaked', () => {
    const primary = makeEnemy({ uid: 'enemy_0' as EnemyId, x: 0, y: 0 });
    const corpse = makeEnemy({
      uid: 'enemy_1' as EnemyId,
      x: 10,
      y: 0,
      hp: 0,
      dead: true,
    });
    const escaped = makeEnemy({
      uid: 'enemy_2' as EnemyId,
      x: 10,
      y: 0,
      hp: 80,
      leaked: true,
    });

    const result = ds.applyHit(splashTower(), primary, [
      primary,
      corpse,
      escaped,
    ]);

    expect(result.splashHits).toHaveLength(0);
    expect(escaped.hp).toBe(80);
  });

  it('pays out the reward for every enemy the blast kills', () => {
    const primary = makeEnemy({
      uid: 'enemy_0' as EnemyId,
      x: 0,
      y: 0,
      hp: 10,
      reward: 10,
    });
    const near = makeEnemy({
      uid: 'enemy_1' as EnemyId,
      x: 20,
      y: 0,
      hp: 10,
      reward: 8,
    });
    const alsoNear = makeEnemy({
      uid: 'enemy_2' as EnemyId,
      x: 40,
      y: 0,
      hp: 10,
      reward: 25,
    });

    const result = ds.applyHit(splashTower(), primary, [
      primary,
      near,
      alsoNear,
    ]);

    expect(result.killed).toBe(true);
    expect(result.splashKills).toHaveLength(2);
    expect(result.goldEarned).toBe(43); // 10 + 8 + 25
  });

  it('pays out splash kills even when the primary target survives', () => {
    const primary = makeEnemy({
      uid: 'enemy_0' as EnemyId,
      x: 0,
      y: 0,
      hp: 500,
      reward: 10,
    });
    const near = makeEnemy({
      uid: 'enemy_1' as EnemyId,
      x: 20,
      y: 0,
      hp: 10,
      reward: 8,
    });

    const result = ds.applyHit(splashTower(), primary, [primary, near]);

    expect(result.killed).toBe(false);
    expect(result.splashKills).toEqual([near]);
    expect(result.goldEarned).toBe(8);
  });

  it('applies each victim armor separately inside the blast', () => {
    const primary = makeEnemy({
      uid: 'enemy_0' as EnemyId,
      x: 0,
      y: 0,
      hp: 80,
      armor: 0,
    });
    const armoured = makeEnemy({
      uid: 'enemy_1' as EnemyId,
      x: 20,
      y: 0,
      hp: 80,
      armor: 6,
    });

    const result = ds.applyHit(splashTower(), primary, [primary, armoured]);

    expect(result.damageDealt).toBe(20);
    expect(armoured.hp).toBe(66); // 20 - 6
  });

  it('marks blast victims dead so targeting drops them', () => {
    const primary = makeEnemy({
      uid: 'enemy_0' as EnemyId,
      x: 0,
      y: 0,
      hp: 10,
    });
    const near = makeEnemy({ uid: 'enemy_1' as EnemyId, x: 20, y: 0, hp: 10 });

    ds.applyHit(splashTower(), primary, [primary, near]);

    expect(near.dead).toBe(true);
  });

  it('defaults to no splash when no enemy list is passed', () => {
    const primary = makeEnemy({ uid: 'enemy_0' as EnemyId, x: 0, y: 0 });

    expect(ds.applyHit(splashTower(), primary).splashHits).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CombatSystem — target tracking (what renderers aim at)
// ═════════════════════════════════════════════════════════════════════════════
describe('CombatSystem target tracking', () => {
  let cs: CombatSystem;

  beforeEach(() => {
    cs = new CombatSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never crit
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records the enemy a tower is tracking', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 });
    const enemy = makeEnemy({ uid: 'enemy_7' as EnemyId, x: 50, y: 0 });

    cs.tick([tower], [enemy], 0.016);

    expect(tower.targetUid).toBe('enemy_7');
  });

  it('keeps tracking while reloading, so a barrel does not aim at a corpse', () => {
    // The reason this is updated before the cooldown check: a reloading tower
    // still has to point somewhere sensible.
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 5 });
    const enemy = makeEnemy({ uid: 'enemy_3' as EnemyId, x: 50, y: 0 });

    const events = cs.tick([tower], [enemy], 0.016);

    expect(events).toHaveLength(0); // still reloading
    expect(tower.targetUid).toBe('enemy_3');
  });

  it('clears the target when nothing is in range', () => {
    const tower = makeTower({
      worldX: 0,
      worldY: 0,
      cooldown: 0,
      targetUid: 'enemy_1',
    });

    cs.tick([tower], [makeEnemy({ x: 5000, y: 5000 })], 0.016);

    expect(tower.targetUid).toBeNull();
  });

  it('clears the target once that enemy dies', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 });
    const enemy = makeEnemy({ uid: 'enemy_2' as EnemyId, x: 50, y: 0, hp: 20 });

    cs.tick([tower], [enemy], 0.016); // kills it
    expect(enemy.dead).toBe(true);

    tower.cooldown = 0;
    cs.tick([tower], [enemy], 0.016);

    expect(tower.targetUid).toBeNull();
  });

  it('switches to whichever enemy is furthest along the path', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 });
    const behind = makeEnemy({
      uid: 'enemy_a' as EnemyId,
      x: 40,
      y: 0,
      waypointIndex: 1,
    });
    const ahead = makeEnemy({
      uid: 'enemy_b' as EnemyId,
      x: 60,
      y: 0,
      waypointIndex: 4,
    });

    cs.tick([tower], [behind, ahead], 0.016);

    expect(tower.targetUid).toBe('enemy_b');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CombatSystem — splash propagation
// ═════════════════════════════════════════════════════════════════════════════
describe('CombatSystem splash', () => {
  let cs: CombatSystem;

  beforeEach(() => {
    cs = new CombatSystem();
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never crit
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports blast victims on the ShotEvent', () => {
    const tower = makeTower({
      worldX: 0,
      worldY: 0,
      cooldown: 0,
      definition: { ...DEFAULT_TOWER_DEF, splashRadius: 60 },
    });
    const primary = makeEnemy({
      uid: 'enemy_0' as EnemyId,
      x: 50,
      y: 0,
      hp: 10,
      reward: 10,
    });
    const near = makeEnemy({
      uid: 'enemy_1' as EnemyId,
      x: 60,
      y: 0,
      hp: 10,
      reward: 8,
    });

    const events = cs.tick([tower], [primary, near], 0.016);

    expect(events).toHaveLength(1);
    expect(events[0].splashKills).toEqual([near]);
    expect(events[0].goldEarned).toBe(18);
  });

  it('reports no blast victims for a single-target tower', () => {
    const tower = makeTower({ worldX: 0, worldY: 0, cooldown: 0 }); // splashRadius 0
    const primary = makeEnemy({ uid: 'enemy_0' as EnemyId, x: 50, y: 0 });
    const near = makeEnemy({ uid: 'enemy_1' as EnemyId, x: 60, y: 0, hp: 80 });

    const events = cs.tick([tower], [primary, near], 0.016);

    expect(events[0].splashHits).toHaveLength(0);
    expect(events[0].splashKills).toHaveLength(0);
    expect(near.hp).toBe(80);
  });
});
