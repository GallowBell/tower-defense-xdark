import type { TargetingMode, TowerState } from '../../types/tower';
import type { EnemyState } from '../../types/enemy';

/**
 * The order the [T] key cycles through, and the order shown in the UI.
 *
 * `first` leads because it is the default and the right answer most of the
 * time; the rest are the interesting exceptions.
 */
export const TARGETING_MODES: readonly TargetingMode[] = [
  'first',
  'last',
  'closest',
  'strongest',
] as const;

/** Short labels for the tower panel. */
export const TARGETING_LABELS: Record<TargetingMode, string> = {
  first: 'First',
  last: 'Last',
  closest: 'Closest',
  strongest: 'Strongest',
};

/** The next mode in the cycle, wrapping at the end. */
export function nextTargetingMode(mode: TargetingMode): TargetingMode {
  const index = TARGETING_MODES.indexOf(mode);
  // An unrecognised mode restarts the cycle rather than getting stuck.
  if (index === -1) return TARGETING_MODES[0];
  return TARGETING_MODES[(index + 1) % TARGETING_MODES.length];
}

/**
 * Ranking keys for one candidate under one mode. Higher wins, compared left to
 * right, so the second entry is the tie-break.
 *
 * Expressing every mode as a key tuple keeps them honestly comparable — each
 * is a choice of what to sort by, not four separate search routines that might
 * disagree about range or about which enemies count.
 */
function rankKeys(
  enemy: EnemyState,
  distance: number,
  mode: TargetingMode,
): [number, number] {
  switch (mode) {
    case 'last':
      return [-enemy.waypointIndex, distance];
    case 'closest':
      return [-distance, enemy.waypointIndex];
    case 'strongest':
      // Max HP, not current. Ranking by current HP looks right and behaves
      // terribly: the tower switches to whichever enemy is healthiest, so
      // against a uniform pack it round-robins and spreads damage perfectly
      // evenly — measured at five Grunts left on exactly 40 HP each, no kills,
      // strictly worse than `first`. Max HP names the toughest *type*, so a
      // Brute stays the target until it dies, and a pack of identical enemies
      // ties here and falls through to the same tie-break `first` uses.
      return [enemy.maxHp, enemy.waypointIndex];
    case 'first':
    default:
      return [enemy.waypointIndex, -distance];
  }
}

export class TargetingSystem {
  /**
   * For a single tower, find the best target from a list of active enemies.
   *
   * Dead, leaked and out-of-range enemies are never candidates, whatever the
   * mode. Among the rest, `tower.targetingMode` decides which one wins; ties
   * keep the earlier enemy in the list, so the choice is deterministic and a
   * headless run reproduces exactly.
   */
  findTarget(tower: TowerState, enemies: EnemyState[]): EnemyState | null {
    const mode = tower.targetingMode;
    let best: EnemyState | null = null;
    let bestKeys: [number, number] = [-Infinity, -Infinity];

    for (const enemy of enemies) {
      if (enemy.dead || enemy.leaked) continue;

      const dx = enemy.x - tower.worldX;
      const dy = enemy.y - tower.worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > tower.definition.range) continue;

      const keys = rankKeys(enemy, distance, mode);
      if (
        best === null ||
        keys[0] > bestKeys[0] ||
        (keys[0] === bestKeys[0] && keys[1] > bestKeys[1])
      ) {
        best = enemy;
        bestKeys = keys;
      }
    }

    return best;
  }
}
