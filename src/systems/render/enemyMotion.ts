import type { EnemyArchetype } from '../../types/enemy';

/**
 * The arithmetic behind an enemy's gait, hit flash and health bar.
 *
 * Split out from EnemyView for the same reason towerMotion is split out from
 * TowerView: none of it needs a Phaser scene, so all of it can be asserted in
 * vitest rather than only in a browser.
 */

/** How long an enemy stays lit white after being hit, in simulated seconds. */
export const HIT_FLASH_DURATION = 0.12;

export interface WalkProfile {
  /**
   * Pixels of travel per full gait cycle.
   *
   * The cadence is driven by distance rather than by a clock, which is what
   * makes a Runner's legs turn over faster than a Brute's without any extra
   * tuning: they cover the same ground at different speeds, so they take
   * different numbers of strides doing it. It also means the gait speeds up at
   * 2x and stops dead when the run is paused, because a paused enemy travels
   * no distance.
   */
  strideLength: number;
  /**
   * Peak body swell at each footfall, as a fraction of the enemy's size.
   *
   * Seen from above there is no "up" to bob into, so a footfall reads as the
   * body rising toward the camera — a scale pulse — rather than as a vertical
   * offset, which from this angle would be indistinguishable from sway.
   */
  bounceAmplitude: number;
  /** Side-to-side sway in pixels, across the direction of travel. */
  swayAmplitude: number;
}

/** Per-archetype gait: the Runner skitters, the Brute lumbers. */
export const WALK: Record<EnemyArchetype, WalkProfile> = {
  basic: { strideLength: 26, bounceAmplitude: 0.07, swayAmplitude: 0.8 },
  fast: { strideLength: 18, bounceAmplitude: 0.05, swayAmplitude: 1.4 },
  tank: { strideLength: 44, bounceAmplitude: 0.1, swayAmplitude: 1.2 },
};

export interface EnemyMotionState {
  /** Gait position as a 0..1 fraction of one cycle. */
  walkPhase: number;
  /** Simulated seconds of hit flash left. */
  flashLife: number;
}

/** A newly spawned enemy, with its gait staggered so a pack doesn't march in lockstep. */
export function restingEnemyMotion(phase = Math.random()): EnemyMotionState {
  return { walkPhase: phase, flashLife: 0 };
}

/** Light an enemy up white. Called once per hit landed on it. */
export function igniteHitFlash(state: EnemyMotionState): void {
  state.flashLife = HIT_FLASH_DURATION;
}

/**
 * Advance the gait by the distance travelled this frame, and the flash by time.
 *
 * @param distance pixels moved since the last frame.
 * @param dtSeconds simulated seconds elapsed, for the flash only.
 */
export function advanceEnemyMotion(
  state: EnemyMotionState,
  distance: number,
  dtSeconds: number,
  profile: WalkProfile,
): void {
  if (state.flashLife > 0) {
    state.flashLife = Math.max(0, state.flashLife - dtSeconds);
  }

  // Wrap only when the phase actually leaves 0..1, so a frame in which nothing
  // moved leaves the state genuinely untouched.
  const phase = state.walkPhase + distance / profile.strideLength;
  state.walkPhase = phase >= 0 && phase < 1 ? phase : (((phase % 1) + 1) % 1);
}

/**
 * Body-scale multiplier for the current footfall: 1 at the start of a stride,
 * swelling twice per cycle — once per foot.
 *
 * It peaks together with the sway, which is where a walking body is actually
 * highest: weight fully committed to one foot.
 */
export function walkBounce(walkPhase: number, profile: WalkProfile): number {
  return 1 + Math.abs(Math.sin(walkPhase * Math.PI * 2)) * profile.bounceAmplitude;
}

/** Side-to-side sway, in pixels, once per cycle — weight shifting foot to foot. */
export function walkSway(walkPhase: number, profile: WalkProfile): number {
  return Math.sin(walkPhase * Math.PI * 2) * profile.swayAmplitude;
}

/** Flash brightness as a 0..1 fraction, fading to 0. */
export function flashStrength(flashLife: number): number {
  return flashLife / HIT_FLASH_DURATION;
}

/**
 * Direction of travel in radians, or `fallback` when the enemy has not moved.
 *
 * A stationary enemy has no direction to infer, and snapping to 0 would spin
 * everything to face right the moment the game pauses.
 */
export function desiredFacing(dx: number, dy: number, fallback: number): number {
  // Well under a pixel, but above the float noise of a position that only
  // looks unchanged.
  if (dx * dx + dy * dy < 1e-6) return fallback;
  return Math.atan2(dy, dx);
}

/** Health bar colour: green, then amber, then red as the bar empties. */
export function hpBarColor(ratio: number): number {
  if (ratio > 0.5) return 0x22c55e;
  if (ratio > 0.25) return 0xeab308;
  return 0xef4444;
}
