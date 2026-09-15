import { WAVE_DEFINITIONS } from './waveDefinitions';
import type { WaveDefinition } from './waveDefinitions';
import { CAMPAIGN_LENGTH, generateWave } from './waveGenerator';

/**
 * Where a run's waves come from.
 *
 * The simulator used to hold a plain array, which made the run's length the
 * array's length. Endless mode has no length, so the run asks for wave N
 * instead of indexing into a list that has to exist up front.
 */
export interface WaveSource {
  /**
   * How many waves the run is, or `Infinity` when it never ends.
   *
   * Infinity rather than a null or a flag because it is the honest answer and
   * it needs no special case anywhere: `GameStateStore.onWaveCleared` already
   * reads `wave < totalWaves`, and nothing is ever less than Infinity, so an
   * endless run simply never reaches victory.
   */
  readonly totalWaves: number;

  /** The wave at a 0-based index, or null when the run has no such wave. */
  waveAt(index: number): WaveDefinition | null;
}

/** A fixed list of waves, won by clearing the last one. */
export function campaignSource(
  waves: readonly WaveDefinition[] = WAVE_DEFINITIONS,
): WaveSource {
  return {
    totalWaves: waves.length,
    waveAt: (index) => waves[index] ?? null,
  };
}

/**
 * The authored campaign, then generated waves forever.
 *
 * The first eight are the same waves the campaign uses — they are what teaches
 * the game, and skipping them would drop a new endless player straight into
 * wave-9 pressure.
 */
export function endlessSource(): WaveSource {
  return {
    totalWaves: Infinity,
    waveAt: (index) => {
      if (index < 0) return null;
      if (index < CAMPAIGN_LENGTH) return WAVE_DEFINITIONS[index];
      return generateWave(index);
    },
  };
}

/** True when a run has no final wave. */
export function isEndless(source: WaveSource): boolean {
  return !Number.isFinite(source.totalWaves);
}
