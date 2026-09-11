import type { WaveDefinition } from './waveDefinitions';
import { ENEMY_DEFINITIONS } from '../../data/enemyDefinitions';
import type { EnemyArchetype } from '../../data/enemyDefinitions';

export interface WaveSummaryEntry {
  archetype: EnemyArchetype;
  displayName: string;
  count: number;
}

/**
 * Total up a wave's enemies by archetype, in the order they first appear.
 *
 * A wave can list the same archetype more than once (a trickle, then a rush),
 * which is a spawning detail the player does not need to read as two rows.
 */
export function summarizeWave(wave: WaveDefinition): WaveSummaryEntry[] {
  const totals = new Map<EnemyArchetype, WaveSummaryEntry>();

  for (const entry of wave.entries) {
    const existing = totals.get(entry.archetype);
    if (existing) {
      existing.count += entry.count;
      continue;
    }
    totals.set(entry.archetype, {
      archetype: entry.archetype,
      displayName: ENEMY_DEFINITIONS[entry.archetype].displayName,
      count: entry.count,
    });
  }

  return [...totals.values()];
}

/**
 * One line describing what a wave sends, e.g. "10x Grunt, 8x Runner, 4x Brute".
 * Returns an empty string when there is no wave left to describe.
 */
export function describeWave(wave: WaveDefinition | undefined): string {
  if (!wave) return '';
  return summarizeWave(wave)
    .map(e => `${e.count}x ${e.displayName}`)
    .join(', ');
}
