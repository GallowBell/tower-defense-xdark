import type { GameMode } from '../../types/game';

/**
 * The player's furthest run, kept between visits.
 *
 * Endless mode needs a reason to play it twice, and a run that leaves no trace
 * is a run nobody repeats. This is the whole of the persistence layer: one
 * number per mode per map.
 *
 * localStorage is the only store available to a game with no backend, and it
 * is allowed to fail — a private window, cleared site data, storage disabled
 * outright. Every access is guarded, and a failure costs the player a score
 * they never see rather than a crash mid-run.
 */

/**
 * Bumping this abandons old records rather than misreading them.
 *
 * A stored number means "waves survived under the curve of the day". If the
 * generator's difficulty ever changes, old bests stop being comparable, and
 * quietly showing one beside a new run would be a lie.
 */
const STORAGE_VERSION = 1;

const PREFIX = `td-best-v${STORAGE_VERSION}`;

/** Storage key for one mode on one map. */
export function bestScoreKey(mode: GameMode, mapId: string): string {
  return `${PREFIX}:${mode}:${mapId}`;
}

/** Furthest wave recorded for this mode and map, or 0 if there is none. */
export function readBestScore(mode: GameMode, mapId: string): number {
  const raw = safeRead(bestScoreKey(mode, mapId));
  if (raw === null) return 0;

  const value = Number.parseInt(raw, 10);
  // Anything unparseable is treated as no record: storage is shared with the
  // rest of the origin and is not ours to trust.
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Record a finished run if it beat the stored one.
 *
 * @returns true when this run set a new best, so the caller can say so.
 */
export function recordScore(
  mode: GameMode,
  mapId: string,
  wavesSurvived: number,
): boolean {
  if (!(wavesSurvived > 0)) return false;
  if (wavesSurvived <= readBestScore(mode, mapId)) return false;

  safeWrite(bestScoreKey(mode, mapId), String(wavesSurvived));
  return true;
}

function safeRead(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Storage full, disabled, or blocked. A lost high score is not worth
    // interrupting a run over.
  }
}
