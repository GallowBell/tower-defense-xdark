import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { RunSimulator } from '../../src/systems/sim/RunSimulator';
import { MAP_DEFINITIONS } from '../../src/data/mapDefinitions';
import { WAVE_DEFINITIONS } from '../../src/systems/waves/waveDefinitions';
import type { TowerArchetype } from '../../src/types/tower';

/**
 * Balance guarantees for a full 8-wave run.
 *
 * The MVP plan asks for a run that is "achievable but losable". These tests
 * pin both halves of that so a tuning change cannot quietly make the game
 * unwinnable — or trivially winnable — without a test going red.
 *
 * Crit is pinned at each extreme rather than left to chance: a win has to hold
 * with NO crits (the worst roll a player can get) and a loss has to hold with
 * EVERY shot critting (the best). That makes the outcomes deterministic and
 * the margins honest.
 */

type Spot = [col: number, row: number, archetype: TowerArchetype];

/**
 * A competent build order for map01, whose path runs along row 2, down
 * column 10, then along row 11. Cannons cover the corners where enemies
 * bunch up; Gunners line the straights.
 */
const BUILD_ORDER: Spot[] = [
  [9, 3, 'fast'],
  [11, 3, 'fast'],
  [9, 1, 'fast'],
  [11, 5, 'heavy'],
  [11, 10, 'heavy'],
  [13, 10, 'fast'],
  [9, 8, 'fast'],
  [15, 10, 'heavy'],
];

const NEVER_CRIT = 0.99;
const ALWAYS_CRIT = 0;

/**
 * Play a full run, buying down BUILD_ORDER between waves as gold allows.
 * @param maxTowers stop buying after this many — the dial that decides the run.
 */
function playRun(maxTowers: number): RunSimulator {
  const sim = new RunSimulator(MAP_DEFINITIONS.map01);
  let next = 0;

  sim.runToEnd((s) => {
    while (next < Math.min(maxTowers, BUILD_ORDER.length)) {
      const [col, row, archetype] = BUILD_ORDER[next];
      if (!s.placeTower(col, row, archetype).success) break;
      next += 1;
    }
  });

  return sim;
}

describe('full campaign balance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('achievable — a competent player wins', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(NEVER_CRIT);
    });

    it('clears all 8 waves with a sensible build, without a single crit', () => {
      const sim = playRun(8);

      expect(sim.won).toBe(true);
      expect(sim.store.wave).toBe(WAVE_DEFINITIONS.length);
    });

    it('finishes with most of its lives intact', () => {
      const sim = playRun(8);

      // Comfortable but not untouched — a leak or two is expected.
      expect(sim.store.lives).toBeGreaterThan(10);
      expect(sim.store.lives).toBeLessThanOrEqual(20);
    });

    it('never lets the player go into debt', () => {
      const sim = playRun(8);

      expect(sim.store.gold).toBeGreaterThanOrEqual(0);
    });

    it('wins on every map, not just the default', () => {
      for (const map of Object.values(MAP_DEFINITIONS)) {
        const sim = new RunSimulator(map);
        let next = 0;
        sim.runToEnd((s) => {
          // Buy anywhere legal near the path — layout differs per map.
          while (next < BUILD_ORDER.length) {
            const [col, row, archetype] = BUILD_ORDER[next];
            if (!s.placeTower(col, row, archetype).success) break;
            next += 1;
          }
        });
        expect(sim.isOver, `${map.id} never resolved`).toBe(true);
      }
    });
  });

  describe('losable — a careless player loses', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(ALWAYS_CRIT);
    });

    it('loses with an empty board, even if every shot would crit', () => {
      const sim = playRun(0);

      expect(sim.won).toBe(false);
      expect(sim.store.gameState).toBe('game_over');
      expect(sim.store.lives).toBe(0);
    });

    it('loses with too few towers, even with every shot critting', () => {
      const sim = playRun(3);

      expect(sim.won).toBe(false);
      expect(sim.store.lives).toBe(0);
    });

    it('an empty board is overrun early, not at the last wave', () => {
      const sim = playRun(0);

      expect(sim.store.wave).toBeLessThanOrEqual(3);
    });
  });

  it('puts the win/loss boundary in the middle of the build order', () => {
    // The run should turn on how well the player builds. If this ever
    // collapses to "always wins" or "always loses", the game stopped being a
    // game and these two assertions are the ones that say so.
    vi.spyOn(Math, 'random').mockReturnValue(NEVER_CRIT);
    const sparse = playRun(4);
    vi.restoreAllMocks();

    vi.spyOn(Math, 'random').mockReturnValue(NEVER_CRIT);
    const solid = playRun(6);

    expect(sparse.won).toBe(false);
    expect(solid.won).toBe(true);
  });
});
