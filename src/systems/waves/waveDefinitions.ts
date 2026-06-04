/**
 * Wave definitions — describes every wave's composition and bonus rewards.
 * The WaveSystem iterates this array in order, spawning enemies per each SpawnEntry.
 */

import type { EnemyArchetype } from '../../data/enemyDefinitions';

/** A single group of enemies to spawn within a wave. */
export interface SpawnEntry {
  /** Which enemy archetype to spawn. */
  archetype: EnemyArchetype;
  /** How many enemies in this group. */
  count: number;
  /** Seconds between consecutive spawns within this group. */
  interval: number;
}

/** Complete description of one wave. */
export interface WaveDefinition {
  /** 0-based wave index. */
  index: number;
  /** Ordered list of spawn groups for this wave. */
  entries: SpawnEntry[];
  /** Bonus gold awarded to the player when the wave is cleared. */
  goldBonus: number;
}

export const WAVE_DEFINITIONS: WaveDefinition[] = [
  // Wave 0 — introductory, only Grunts
  {
    index: 0,
    entries: [{ archetype: 'basic', count: 8, interval: 1.2 }],
    goldBonus: 20,
  },
  // Wave 1 — more Grunts, tighter spacing
  {
    index: 1,
    entries: [{ archetype: 'basic', count: 12, interval: 1.0 }],
    goldBonus: 25,
  },
  // Wave 2 — introduce Runners alongside Grunts
  {
    index: 2,
    entries: [
      { archetype: 'basic', count: 6, interval: 0.8 },
      { archetype: 'fast', count: 4, interval: 0.8 },
    ],
    goldBonus: 30,
  },
  // Wave 3 — pure Runner rush
  {
    index: 3,
    entries: [{ archetype: 'fast', count: 10, interval: 0.7 }],
    goldBonus: 30,
  },
  // Wave 4 — first Brutes, slow but tanky
  {
    index: 4,
    entries: [{ archetype: 'tank', count: 4, interval: 2.5 }],
    goldBonus: 40,
  },
  // Wave 5 — mixed Grunts and Runners, faster cadence
  {
    index: 5,
    entries: [
      { archetype: 'basic', count: 8, interval: 0.6 },
      { archetype: 'fast', count: 6, interval: 0.6 },
    ],
    goldBonus: 45,
  },
  // Wave 6 — Runners with a few Brutes
  {
    index: 6,
    entries: [
      { archetype: 'fast', count: 6, interval: 0.8 },
      { archetype: 'tank', count: 3, interval: 0.8 },
    ],
    goldBonus: 50,
  },
  // Wave 7 — full onslaught: all three archetypes
  {
    index: 7,
    entries: [
      { archetype: 'basic', count: 10, interval: 0.5 },
      { archetype: 'fast', count: 8, interval: 0.5 },
      { archetype: 'tank', count: 4, interval: 0.5 },
    ],
    goldBonus: 75,
  },
];
