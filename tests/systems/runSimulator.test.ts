import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RunSimulator, SIM_STEP } from '../../src/systems/sim/RunSimulator';
import { MAP_DEFINITIONS } from '../../src/data/mapDefinitions';
import { BALANCE } from '../../src/data/balance';
import { DIFFICULTY } from '../../src/data/difficultyScaling';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import { ENEMY_DEFINITIONS } from '../../src/data/enemyDefinitions';
import type { WaveDefinition } from '../../src/systems/waves/waveDefinitions';
import type { EnemyState } from '../../src/types/enemy';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAP = MAP_DEFINITIONS.map01;

/** One Grunt, then one more — short enough to run a whole wave in a test. */
const TWO_WAVES: WaveDefinition[] = [
  {
    index: 0,
    entries: [{ archetype: 'basic', count: 1, interval: 0.5 }],
    goldBonus: 20,
  },
  {
    index: 1,
    entries: [{ archetype: 'basic', count: 1, interval: 0.5 }],
    goldBonus: 30,
  },
];

/** Advance the sim by `seconds` of simulated time. */
function run(sim: RunSimulator, seconds: number): void {
  for (let t = 0; t < seconds; t += SIM_STEP) sim.step(SIM_STEP);
}

describe('RunSimulator', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never crit
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Starting state ──────────────────────────────────────────────────────────

  it('starts idle with the balance sheet from BALANCE', () => {
    const sim = new RunSimulator(MAP);

    expect(sim.store.gameState).toBe('idle');
    expect(sim.store.gold).toBe(BALANCE.startingGold);
    expect(sim.store.lives).toBe(BALANCE.startingLives);
    expect(sim.isOver).toBe(false);
  });

  it('takes its run length from the wave list it was given', () => {
    expect(new RunSimulator(MAP, {}, TWO_WAVES).store.totalWaves).toBe(2);
  });

  // ── Placement ───────────────────────────────────────────────────────────────

  it('charges for a tower it places', () => {
    const sim = new RunSimulator(MAP);

    const result = sim.placeTower(9, 3, 'fast');

    expect(result.success).toBe(true);
    expect(sim.store.towers).toHaveLength(1);
    expect(sim.store.gold).toBe(
      BALANCE.startingGold - TOWER_DEFINITIONS.fast.cost,
    );
  });

  it('refuses to build on the path and charges nothing', () => {
    const sim = new RunSimulator(MAP);

    const result = sim.placeTower(5, 2, 'fast'); // row 2 is path

    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_buildable');
    expect(sim.store.towers).toHaveLength(0);
    expect(sim.store.gold).toBe(BALANCE.startingGold);
  });

  it('refuses a tower it cannot afford and charges nothing', () => {
    const sim = new RunSimulator(MAP);
    sim.store.gold = 10;

    const result = sim.placeTower(9, 3, 'heavy');

    expect(result.success).toBe(false);
    expect(result.reason).toBe('insufficient_gold');
    expect(sim.store.gold).toBe(10);
  });

  it('refuses to stack two towers on one tile', () => {
    const sim = new RunSimulator(MAP);
    sim.placeTower(9, 3, 'fast');

    expect(sim.placeTower(9, 3, 'fast').reason).toBe('occupied');
    expect(sim.store.towers).toHaveLength(1);
  });

  it('lets the player build while a wave is running', () => {
    const sim = new RunSimulator(MAP, {}, TWO_WAVES);
    sim.startNextWave();
    run(sim, 1);
    const goldBefore = sim.store.gold;

    const result = sim.placeTower(9, 3, 'fast');

    expect(sim.store.gameState).toBe('wave_active');
    expect(result.success).toBe(true);
    expect(sim.store.towers).toHaveLength(1);
    expect(sim.store.gold).toBe(goldBefore - TOWER_DEFINITIONS.fast.cost);
  });

  it('refuses to build once the run is over', () => {
    const sim = new RunSimulator(MAP, {}, TWO_WAVES);
    sim.store.lives = 1;
    sim.startNextWave();
    sim.runActiveWave(120);
    expect(sim.store.gameState).toBe('game_over');

    expect(sim.placeTower(9, 3, 'fast').reason).toBe('invalid_state');
  });

  // ── Selling and upgrading ───────────────────────────────────────────────────

  it('refunds a share of everything sunk into a sold tower', () => {
    const sim = new RunSimulator(MAP);
    sim.placeTower(9, 3, 'fast');
    const uid = sim.store.towers[0].uid;
    sim.upgradeTower(uid);
    const invested = sim.store.towers[0].investedGold;
    const goldBefore = sim.store.gold;

    const refund = sim.sellTower(uid);

    expect(refund).toBe(Math.floor(invested * DIFFICULTY.sellRefundRatio));
    expect(sim.store.gold).toBe(goldBefore + refund);
    expect(sim.store.towers).toHaveLength(0);
  });

  it('charges the quoted price for an upgrade', () => {
    const sim = new RunSimulator(MAP);
    sim.placeTower(9, 3, 'fast'); // 75g, so the first upgrade costs 30
    const goldBefore = sim.store.gold;

    const charged = sim.upgradeTower(sim.store.towers[0].uid);

    expect(charged).toBe(30);
    expect(sim.store.gold).toBe(goldBefore - 30);
    expect(sim.store.towers[0].level).toBe(2);
  });

  it('declines an upgrade it cannot afford without charging', () => {
    const sim = new RunSimulator(MAP);
    sim.placeTower(9, 3, 'fast');
    sim.store.gold = 5;

    expect(sim.upgradeTower(sim.store.towers[0].uid)).toBe(0);
    expect(sim.store.gold).toBe(5);
    expect(sim.store.towers[0].level).toBe(1);
  });

  // ── Wave control ────────────────────────────────────────────────────────────

  it('starts a wave from idle', () => {
    const sim = new RunSimulator(MAP);

    expect(sim.startNextWave()).toBe(true);
    expect(sim.store.gameState).toBe('wave_active');
  });

  it('will not start a second wave while one is running', () => {
    const sim = new RunSimulator(MAP);
    sim.startNextWave();

    expect(sim.startNextWave()).toBe(false);
  });

  it('spawns the wave composition it was given', () => {
    const spawned: EnemyState[] = [];
    const sim = new RunSimulator(
      MAP,
      { onSpawn: (e) => spawned.push(e) },
      TWO_WAVES,
    );

    sim.startNextWave();
    run(sim, 2);

    expect(spawned).toHaveLength(1);
    expect(spawned[0].archetype).toBe('basic');
  });

  it('scales enemy HP with the wave number', () => {
    const spawned: EnemyState[] = [];
    const sim = new RunSimulator(
      MAP,
      { onSpawn: (e) => spawned.push(e) },
      TWO_WAVES,
    );

    sim.startNextWave();
    sim.runActiveWave(120); // wave 1 leaks, no towers
    sim.startNextWave();
    run(sim, 2);

    expect(spawned).toHaveLength(2);
    expect(spawned[0].maxHp).toBe(ENEMY_DEFINITIONS.basic.hp); // wave 1 = 1.00x
    expect(spawned[1].maxHp).toBe(
      Math.round(ENEMY_DEFINITIONS.basic.hp * DIFFICULTY.enemyHpScale(2)),
    );
  });

  it('pays the wave bonus, scaled, when a wave is cleared', () => {
    const cleared: number[] = [];
    const sim = new RunSimulator(
      MAP,
      { onWaveCleared: (w) => cleared.push(w) },
      TWO_WAVES,
    );
    sim.placeTower(9, 3, 'heavy'); // enough to kill one Grunt
    const goldAfterBuying = sim.store.gold;

    sim.startNextWave();
    sim.runActiveWave(120);

    expect(cleared).toEqual([1]);
    // The kill reward plus the wave bonus, both at wave 1 scaling.
    const expected = goldAfterBuying + ENEMY_DEFINITIONS.basic.reward + 20;
    expect(sim.store.gold).toBe(expected);
    expect(sim.store.gameState).toBe('wave_cleared');
  });

  // ── Leaks, loss and victory ─────────────────────────────────────────────────

  it('charges exactly one life per leaked enemy', () => {
    const leaked: EnemyState[] = [];
    const sim = new RunSimulator(
      MAP,
      { onLeak: (e) => leaked.push(e) },
      TWO_WAVES,
    );

    sim.startNextWave();
    sim.runActiveWave(120); // no towers — the Grunt walks the whole path

    expect(leaked).toHaveLength(1);
    expect(sim.store.lives).toBe(BALANCE.startingLives - 1);
  });

  it('ends the run when the last life is spent', () => {
    const sim = new RunSimulator(MAP, {}, TWO_WAVES);
    sim.store.lives = 1;

    sim.startNextWave();
    sim.runActiveWave(120);

    expect(sim.store.gameState).toBe('game_over');
    expect(sim.isOver).toBe(true);
    expect(sim.won).toBe(false);
  });

  it('declares victory once the final wave is cleared', () => {
    const sim = new RunSimulator(MAP, {}, TWO_WAVES);
    sim.placeTower(9, 3, 'heavy');
    sim.placeTower(11, 3, 'heavy');

    sim.runToEnd();

    expect(sim.won).toBe(true);
    expect(sim.store.gameState).toBe('victory');
  });

  it('reports a shot through the hook, and banks its reward once', () => {
    const shots: number[] = [];
    const sim = new RunSimulator(
      MAP,
      { onShot: (s) => shots.push(s.goldEarned) },
      TWO_WAVES,
    );
    sim.placeTower(9, 3, 'heavy');
    const goldAfterBuying = sim.store.gold;

    sim.startNextWave();
    sim.runActiveWave(120);

    expect(shots.filter((g) => g > 0)).toEqual([
      ENEMY_DEFINITIONS.basic.reward,
    ]);
    expect(sim.store.gold - goldAfterBuying).toBe(
      ENEMY_DEFINITIONS.basic.reward + 20,
    );
  });

  // ── Determinism ─────────────────────────────────────────────────────────────

  it('plays out identically from identical inputs', () => {
    const play = () => {
      const sim = new RunSimulator(MAP, {}, TWO_WAVES);
      sim.placeTower(9, 3, 'fast');
      sim.runToEnd();
      return { won: sim.won, lives: sim.store.lives, gold: sim.store.gold };
    };

    expect(play()).toEqual(play());
  });
});

// ── Targeting modes ──────────────────────────────────────────────────────────

describe('targeting modes, through a real run', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never crit
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A wave of Grunts spaced out enough that several are in range at once. */
  const PACK: WaveDefinition[] = [
    {
      index: 0,
      entries: [{ archetype: 'basic', count: 5, interval: 0.4 }],
      goldBonus: 20,
    },
  ];

  it('defaults a new tower to first', () => {
    const sim = new RunSimulator(MAP, {}, PACK);
    const placed = sim.placeTower(9, 3, 'basic');

    expect(placed.tower!.targetingMode).toBe('first');
  });

  it('cycles a tower through every mode and back', () => {
    const sim = new RunSimulator(MAP, {}, PACK);
    const uid = sim.placeTower(9, 3, 'basic').tower!.uid;

    expect(sim.cycleTargetingMode(uid)).toBe('last');
    expect(sim.cycleTargetingMode(uid)).toBe('closest');
    expect(sim.cycleTargetingMode(uid)).toBe('strongest');
    expect(sim.cycleTargetingMode(uid)).toBe('first');
  });

  it('reports nothing for a tower that does not exist', () => {
    const sim = new RunSimulator(MAP, {}, PACK);

    expect(sim.cycleTargetingMode('tower_nope')).toBeNull();
    expect(sim.setTargetingMode('tower_nope', 'last')).toBe(false);
  });

  it('costs nothing and works mid-wave', () => {
    // Retargeting is a standing order, not a purchase — a player answering a
    // wave they did not expect should not have to pay for it.
    const sim = new RunSimulator(MAP, {}, PACK);
    const uid = sim.placeTower(9, 3, 'basic').tower!.uid;
    sim.startNextWave();
    run(sim, 2);

    const goldBefore = sim.store.gold;
    expect(sim.cycleTargetingMode(uid)).toBe('last');
    expect(sim.store.gold).toBe(goldBefore);
    expect(sim.store.gameState).toBe('wave_active');
  });

  it('changes which enemy of a pack gets shot', () => {
    // The decisive one: the mode has to reach all the way through combat, not
    // just sit on the tower. `first` leads the pack, `last` trails it, so the
    // two hit different enemies out of the same spawn order.
    const firstShots: string[] = [];
    const lastShots: string[] = [];

    for (const [mode, log] of [
      ['first', firstShots],
      ['last', lastShots],
    ] as const) {
      const sim = new RunSimulator(
        MAP,
        { onShot: (shot) => log.push(shot.target.uid) },
        PACK,
      );
      const uid = sim.placeTower(9, 3, 'basic').tower!.uid;
      sim.setTargetingMode(uid, mode);
      sim.startNextWave();
      run(sim, 6);
    }

    expect(firstShots.length).toBeGreaterThan(0);
    expect(lastShots.length).toBeGreaterThan(0);
    expect(firstShots).not.toEqual(lastShots);
  });

  it('keeps a mode across an upgrade', () => {
    const sim = new RunSimulator(MAP, {}, PACK);
    const uid = sim.placeTower(9, 3, 'basic').tower!.uid;
    sim.setTargetingMode(uid, 'strongest');

    expect(sim.upgradeTower(uid)).toBeGreaterThan(0);
    expect(sim.store.towers.find((t) => t.uid === uid)!.targetingMode).toBe(
      'strongest',
    );
  });

  it('keeps the tower firing in every mode', () => {
    // A mode that quietly stopped a tower shooting would be a regression no
    // targeting unit test would catch. Note this asserts shots, not kills:
    // see the spread-versus-focus test below for why those differ.
    for (const mode of ['first', 'last', 'closest', 'strongest'] as const) {
      let shots = 0;
      const sim = new RunSimulator(MAP, { onShot: () => shots++ }, PACK);
      const uid = sim.placeTower(9, 3, 'basic').tower!.uid;
      sim.setTargetingMode(uid, mode);
      sim.startNextWave();
      run(sim, 8);

      expect(sim.store.towers[0].targetingMode, mode).toBe(mode);
      expect(shots, mode).toBeGreaterThan(0);
    }
  });

  it('spreads damage on last and concentrates it on first', () => {
    // The real trade-off, and the reason to ever pick one over the other.
    // `last` re-aims at each new arrival, so the same number of shots lands
    // across more enemies and finishes fewer of them. This is a property of
    // the mode, not a bug: the whole point of `last` is softening a wave.
    function survey(mode: 'first' | 'last') {
      let shots = 0;
      const sim = new RunSimulator(MAP, { onShot: () => shots++ }, PACK);
      const uid = sim.placeTower(9, 3, 'basic').tower!.uid;
      sim.setTargetingMode(uid, mode);
      sim.startNextWave();
      run(sim, 12);

      return {
        shots,
        kills: sim.enemies.filter((e) => e.dead).length,
        // Damaged but still walking — the signature of spread damage.
        wounded: sim.enemies.filter((e) => !e.dead && e.hp < e.maxHp).length,
      };
    }

    const first = survey('first');
    const last = survey('last');

    // Same tower, same wave, same ammunition — only the aim differs.
    expect(last.shots).toBe(first.shots);
    // The same shots, thinner: more enemies hurt, fewer actually finished.
    expect(last.wounded).toBeGreaterThan(first.wounded);
    expect(first.kills).toBeGreaterThan(last.kills);
  });
});
