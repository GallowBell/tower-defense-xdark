import type { EnemyArchetype } from '../../data/enemyDefinitions';
import { WAVE_DEFINITIONS } from './waveDefinitions';
import type { SpawnEntry, WaveDefinition } from './waveDefinitions';

/**
 * Waves past the authored campaign.
 *
 * The eight hand-written waves teach the game: Grunts, then Runners, then the
 * first Brute, then combinations. Endless mode has to keep going after that
 * without anybody authoring wave 47, so it generates them.
 *
 * Every wave is a pure function of its index. Wave 12 is the same wave in every
 * run, on every machine — which makes the curve testable, lets a player learn
 * it, and means two people comparing how far they got are comparing the same
 * thing. (A per-run seed would give more novelty; it would also make a best
 * score mean less and the balance untestable.)
 */

/** Waves 1..CAMPAIGN_LENGTH are authored; past that they are generated. */
export const CAMPAIGN_LENGTH = WAVE_DEFINITIONS.length;

/** Enemies in the first generated wave, continuing on from the authored eight. */
const BASE_SPAWN_COUNT = 24;

/** Extra enemies per wave, until the cap. */
const SPAWN_GROWTH_PER_WAVE = 1.5;

/**
 * Most enemies a single wave may contain.
 *
 * Difficulty past this point comes from `hpMultiplier`, not from more bodies.
 * An earlier version grew the count without limit and reached ninety-seven
 * Grunts by wave 40 — a wave that takes half a minute to walk on stage, and
 * pays out so much gold on the way that the player out-earns it. Tougher
 * enemies scale the threat without scaling the payout or the entity count.
 */
const MAX_SPAWN_COUNT = 44;

/**
 * Compounding health multiplier per wave past the campaign.
 *
 * This is what actually ends an endless run. Enemy count plateaus and gold
 * income roughly tracks it, so a linear threat never outpaces a player who
 * keeps reinvesting — measured at wave 60 with 13 of 20 lives still in hand.
 * A geometric term eventually beats any board. Tuned in
 * tests/balance/endless.test.ts.
 */
const HP_GROWTH_PER_WAVE = 1.08;

/** How a wave is shaped. Waves differ in kind, not just in size. */
export type WaveFlavour = 'swarm' | 'rush' | 'heavy' | 'mixed';

export const WAVE_FLAVOURS: readonly WaveFlavour[] = [
  'swarm',
  'rush',
  'heavy',
  'mixed',
] as const;

/** What fraction of a wave's enemies each archetype makes up, per flavour. */
const FLAVOUR_MIX: Record<WaveFlavour, Record<EnemyArchetype, number>> = {
  // A wall of Grunts: cheap individually, dangerous in bulk.
  swarm: { basic: 0.8, fast: 0.2, tank: 0 },
  // Runners, and enough of them to outrun a slow tower's reload.
  rush: { basic: 0.15, fast: 0.85, tank: 0 },
  // Brutes, where armour decides the wave.
  heavy: { basic: 0.25, fast: 0.1, tank: 0.65 },
  // Everything at once.
  mixed: { basic: 0.45, fast: 0.35, tank: 0.2 },
};

/** Seconds between spawns, per flavour, before the per-wave tightening. */
const FLAVOUR_INTERVAL: Record<WaveFlavour, number> = {
  swarm: 0.7,
  rush: 0.5,
  heavy: 1.4,
  mixed: 0.7,
};

/** Spacing never drops below this, or a wave arrives as one indivisible lump. */
const MIN_INTERVAL = 0.3;

/** How many enemies a given 1-based wave sends. */
export function waveSpawnCount(wave: number): number {
  const past = Math.max(0, wave - CAMPAIGN_LENGTH);
  return Math.min(
    MAX_SPAWN_COUNT,
    Math.round(BASE_SPAWN_COUNT + SPAWN_GROWTH_PER_WAVE * past),
  );
}

/**
 * Extra health every enemy in this wave carries, on top of the campaign curve.
 *
 * 1 for anything inside the campaign: those waves are authored and their
 * balance is already asserted.
 */
export function waveHpMultiplier(wave: number): number {
  const past = Math.max(0, wave - CAMPAIGN_LENGTH);
  return HP_GROWTH_PER_WAVE ** past;
}

/**
 * Which shape a wave takes.
 *
 * A cheap integer hash rather than a PRNG: it only has to look unplanned and
 * be the same every time. The guard stops the same flavour landing twice in a
 * row, which otherwise happens often enough to read as a bug.
 */
export function waveFlavour(wave: number): WaveFlavour {
  const pick = (n: number): WaveFlavour =>
    WAVE_FLAVOURS[(n * 2654435761) % WAVE_FLAVOURS.length];

  const flavour = pick(wave);
  if (wave > CAMPAIGN_LENGTH + 1 && flavour === pick(wave - 1)) {
    return WAVE_FLAVOURS[
      (WAVE_FLAVOURS.indexOf(flavour) + 1) % WAVE_FLAVOURS.length
    ];
  }
  return flavour;
}

/**
 * Build the wave at a 0-based index past the campaign.
 *
 * @param index 0-based, matching WaveDefinition.index.
 */
export function generateWave(index: number): WaveDefinition {
  const wave = index + 1;
  const total = waveSpawnCount(wave);
  const flavour = waveFlavour(wave);
  const mix = FLAVOUR_MIX[flavour];

  // Tighten spacing as waves go on, so a later wave of the same shape presses
  // harder rather than simply lasting longer.
  const interval = Math.max(
    MIN_INTERVAL,
    FLAVOUR_INTERVAL[flavour] - 0.015 * (wave - CAMPAIGN_LENGTH),
  );

  const entries: SpawnEntry[] = [];
  for (const archetype of ['basic', 'fast', 'tank'] as const) {
    const count = Math.floor(total * mix[archetype]);
    if (count > 0) entries.push({ archetype, count, interval });
  }

  // A share that rounded away entirely would spawn nothing and clear
  // instantly; a wave is always at least one enemy.
  if (entries.length === 0) {
    entries.push({ archetype: 'basic', count: 1, interval });
  }

  return {
    index,
    entries,
    // Gold keeps pace with wave length so a longer run stays affordable;
    // DIFFICULTY.rewardScale multiplies this again at clear time.
    goldBonus: Math.round(50 + total),
    hpMultiplier: waveHpMultiplier(wave),
  };
}

/** Total enemies in a wave, whatever its shape. */
export function waveEnemyCount(wave: WaveDefinition): number {
  return wave.entries.reduce((sum, entry) => sum + entry.count, 0);
}
