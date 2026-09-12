import { describe, it, expect } from 'vitest';

import {
  TargetingSystem,
  TARGETING_MODES,
  TARGETING_LABELS,
  nextTargetingMode,
} from '../../src/systems/combat/TargetingSystem';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import type { TargetingMode, TowerState } from '../../src/types/tower';
import type { EnemyId, EnemyState } from '../../src/types/enemy';

const TOWER_X = 100;
const TOWER_Y = 100;

function makeTower(mode: TargetingMode, range = 200): TowerState {
  const definition = { ...TOWER_DEFINITIONS.basic, range };
  return {
    uid: 'tower_0',
    archetype: 'basic',
    gridX: 2,
    gridY: 2,
    worldX: TOWER_X,
    worldY: TOWER_Y,
    cooldown: 0,
    targetUid: null,
    targetingMode: mode,
    level: 1,
    investedGold: 100,
    baseDefinition: definition,
    definition,
  };
}

/** An enemy placed at an exact distance due east of the tower. */
function makeEnemy(
  uid: string,
  distance: number,
  overrides: Partial<EnemyState> = {},
): EnemyState {
  return {
    uid: uid as EnemyId,
    archetype: 'basic',
    hp: 80,
    maxHp: 80,
    speed: 80,
    reward: 10,
    armor: 0,
    waypointIndex: 0,
    x: TOWER_X + distance,
    y: TOWER_Y,
    radius: 12,
    color: 0xef4444,
    dead: false,
    leaked: false,
    ...overrides,
  };
}

const targeting = new TargetingSystem();

describe('the four modes are genuinely different', () => {
  /**
   * One board, engineered so every mode has its own right answer. If two modes
   * ever collapse into the same search this fails, which is the whole point —
   * a targeting mode that agrees with `first` everywhere is not a feature.
   */
  const leader = makeEnemy('leader', 150, { waypointIndex: 5, hp: 50 });
  const straggler = makeEnemy('straggler', 180, { waypointIndex: 1, hp: 60 });
  const nearby = makeEnemy('nearby', 20, { waypointIndex: 3, hp: 40 });
  const brute = makeEnemy('brute', 100, {
    waypointIndex: 2,
    hp: 300,
    maxHp: 300,
  });
  const board = [leader, straggler, nearby, brute];

  const expected: Record<TargetingMode, string> = {
    first: 'leader',
    last: 'straggler',
    closest: 'nearby',
    strongest: 'brute',
  };

  for (const mode of TARGETING_MODES) {
    it(`${mode} picks ${expected[mode]}`, () => {
      const target = targeting.findTarget(makeTower(mode), board);
      expect(target?.uid).toBe(expected[mode]);
    });
  }

  it('gives four distinct answers on the same board', () => {
    const picked = TARGETING_MODES.map(
      (mode) => targeting.findTarget(makeTower(mode), board)?.uid,
    );
    expect(new Set(picked).size).toBe(TARGETING_MODES.length);
  });
});

describe('rules every mode obeys', () => {
  it('never targets a dead or leaked enemy', () => {
    const corpses = [
      makeEnemy('dead', 30, { dead: true, hp: 500, waypointIndex: 9 }),
      makeEnemy('leaked', 40, { leaked: true, hp: 500, waypointIndex: 9 }),
    ];

    for (const mode of TARGETING_MODES) {
      expect(targeting.findTarget(makeTower(mode), corpses), mode).toBeNull();
    }
  });

  it('never reaches past the tower’s range', () => {
    // 201px out on a 200px tower — attractive under every mode, and still
    // unreachable.
    const tempting = [makeEnemy('far', 201, { hp: 999, waypointIndex: 99 })];

    for (const mode of TARGETING_MODES) {
      expect(targeting.findTarget(makeTower(mode), tempting), mode).toBeNull();
    }
  });

  it('targets an enemy exactly on the range boundary', () => {
    const onEdge = [makeEnemy('edge', 200)];

    for (const mode of TARGETING_MODES) {
      expect(targeting.findTarget(makeTower(mode), onEdge)?.uid, mode).toBe(
        'edge',
      );
    }
  });

  it('returns null when nothing is in range at all', () => {
    for (const mode of TARGETING_MODES) {
      expect(targeting.findTarget(makeTower(mode), []), mode).toBeNull();
    }
  });

  it('breaks exact ties toward the earlier enemy, in every mode', () => {
    // Determinism matters: a headless balance run has to reproduce exactly.
    const twins = [makeEnemy('first_seen', 50), makeEnemy('second_seen', 50)];

    for (const mode of TARGETING_MODES) {
      expect(targeting.findTarget(makeTower(mode), twins)?.uid, mode).toBe(
        'first_seen',
      );
    }
  });

  it('ignores corpses that would otherwise win outright', () => {
    const board = [
      makeEnemy('corpse', 10, { dead: true, hp: 999, waypointIndex: 99 }),
      makeEnemy('alive', 60, { hp: 20, waypointIndex: 1 }),
    ];

    for (const mode of TARGETING_MODES) {
      expect(targeting.findTarget(makeTower(mode), board)?.uid, mode).toBe(
        'alive',
      );
    }
  });
});

describe('first, unchanged', () => {
  /**
   * `first` is the default and what every balance test was tuned against, so
   * its behaviour is pinned separately from the refactor that introduced the
   * other three.
   */
  it('prefers the enemy furthest along the path', () => {
    const board = [
      makeEnemy('behind', 30, { waypointIndex: 2 }),
      makeEnemy('ahead', 190, { waypointIndex: 7 }),
    ];

    expect(targeting.findTarget(makeTower('first'), board)?.uid).toBe('ahead');
  });

  it('breaks a same-waypoint tie toward the closer enemy', () => {
    const board = [
      makeEnemy('further', 150, { waypointIndex: 4 }),
      makeEnemy('closer', 40, { waypointIndex: 4 }),
    ];

    expect(targeting.findTarget(makeTower('first'), board)?.uid).toBe('closer');
  });
});

describe('strongest ranks by max HP, not current', () => {
  it('prefers the Brute over a Grunt', () => {
    const board = [
      makeEnemy('grunt', 50, { hp: 80, maxHp: 80 }),
      makeEnemy('brute', 60, { hp: 300, maxHp: 300 }),
    ];

    expect(targeting.findTarget(makeTower('strongest'), board)?.uid).toBe(
      'brute',
    );
  });

  it('stays on a Brute already worn below a full-health Grunt', () => {
    // The reason the rank is max HP. On current HP the tower would switch to
    // the healthier Grunt here, abandoning a nearly-dead Brute — and against a
    // pack of identical enemies that rule degenerates into perfect
    // round-robin: measured at five Grunts on exactly 40 HP each and no kills.
    const board = [
      makeEnemy('grunt', 50, { hp: 80, maxHp: 80 }),
      makeEnemy('brute', 60, { hp: 30, maxHp: 300 }),
    ];

    expect(targeting.findTarget(makeTower('strongest'), board)?.uid).toBe(
      'brute',
    );
  });

  it('falls back to first’s ordering among identical enemies', () => {
    // Every Grunt ties on max HP, so the waypoint tie-break decides and the
    // tower focus-fires the leader instead of spreading damage.
    const board = [
      makeEnemy('behind', 40, { waypointIndex: 1 }),
      makeEnemy('ahead', 90, { waypointIndex: 6 }),
    ];

    expect(targeting.findTarget(makeTower('strongest'), board)?.uid).toBe(
      targeting.findTarget(makeTower('first'), board)?.uid,
    );
  });
});

describe('mode cycling', () => {
  it('visits every mode and returns to the start', () => {
    let mode = TARGETING_MODES[0];
    const seen = [mode];

    for (let i = 0; i < TARGETING_MODES.length - 1; i++) {
      mode = nextTargetingMode(mode);
      seen.push(mode);
    }

    expect(seen).toEqual([...TARGETING_MODES]);
    expect(nextTargetingMode(mode)).toBe(TARGETING_MODES[0]);
  });

  it('starts from first, the pre-existing behaviour', () => {
    expect(TARGETING_MODES[0]).toBe('first');
  });

  it('recovers from an unrecognised mode instead of getting stuck', () => {
    expect(nextTargetingMode('nonsense' as TargetingMode)).toBe(
      TARGETING_MODES[0],
    );
  });

  it('labels every mode for the tower panel', () => {
    for (const mode of TARGETING_MODES) {
      expect(TARGETING_LABELS[mode], mode).toBeTruthy();
    }
    expect(new Set(Object.values(TARGETING_LABELS)).size).toBe(
      TARGETING_MODES.length,
    );
  });
});
