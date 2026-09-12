import type { TowerArchetype } from '../../types/tower';

/**
 * The arithmetic behind a tower's idle and firing motion.
 *
 * Split out from TowerView because TowerView cannot exist without a Phaser
 * scene, and none of this needs one: it is a handful of numbers advancing over
 * time. Kept here they can be asserted in vitest, including the one constraint
 * that is easy to break from a long way away — see `recoilRecovery`.
 */

/** How long the muzzle flash stays lit, in simulated seconds. */
export const FLASH_DURATION = 0.07;

export interface MotionProfile {
  /** Peak barrel kick-back in pixels. */
  recoilDistance: number;
  /**
   * Seconds for the barrel to return to rest.
   *
   * Must stay below the archetype's reload at max level, or the barrel is
   * still travelling home when the next shot kicks it out again and it never
   * looks seated. `tests/systems/towerMotion.test.ts` asserts that against the
   * real tower and upgrade data, so raising the upgrade fire-rate curve fails
   * loudly here rather than quietly looking wrong.
   */
  recoilRecovery: number;
  /** Seconds for one full idle bob cycle. */
  bobPeriod: number;
  /** Idle bob travel in pixels, centre to peak. */
  bobAmplitude: number;
}

/**
 * Per-archetype motion, so the three towers don't animate identically: the
 * Gunner twitches, the Cannon heaves.
 */
export const MOTION: Record<TowerArchetype, MotionProfile> = {
  basic: {
    recoilDistance: 4,
    recoilRecovery: 0.22,
    bobPeriod: 1.7,
    bobAmplitude: 0.9,
  },
  fast: {
    recoilDistance: 2.5,
    recoilRecovery: 0.1,
    bobPeriod: 1.0,
    bobAmplitude: 0.6,
  },
  heavy: {
    recoilDistance: 7,
    recoilRecovery: 0.34,
    bobPeriod: 2.5,
    bobAmplitude: 1.2,
  },
};

/** Everything about a tower's motion that changes over time. */
export interface MotionState {
  /** Recoil as a 0..1 fraction of `recoilDistance`, decaying toward 0. */
  recoil: number;
  /** Simulated seconds of muzzle flash left. */
  flashLife: number;
  /** Idle bob position as a 0..1 fraction of a cycle. */
  bobPhase: number;
}

/** A tower at rest, with its bob staggered so a row of them breathes out of step. */
export function restingMotion(phase = Math.random()): MotionState {
  return { recoil: 0, flashLife: 0, bobPhase: phase };
}

/** Mark a shot: full recoil, muzzle lit. */
export function igniteMotion(state: MotionState): void {
  state.recoil = 1;
  state.flashLife = FLASH_DURATION;
}

/**
 * Advance motion by a slice of *simulated* time.
 *
 * dtSeconds is the frame's simulated seconds rather than wall-clock, so all of
 * this keeps pace at 2x and stops dead when the run is paused — the same clock
 * as the combat it depicts.
 */
export function advanceMotion(
  state: MotionState,
  dtSeconds: number,
  profile: MotionProfile,
): void {
  if (state.recoil > 0) {
    state.recoil = Math.max(
      0,
      state.recoil - dtSeconds / profile.recoilRecovery,
    );
  }
  if (state.flashLife > 0) {
    state.flashLife = Math.max(0, state.flashLife - dtSeconds);
  }
  // Wrap only when the phase actually leaves 0..1. Doing the positive-modulo
  // dance unconditionally perturbs the value by a float ulp even for dt = 0,
  // which would make a paused frame subtly not a no-op.
  const phase = state.bobPhase + dtSeconds / profile.bobPeriod;
  state.bobPhase = phase >= 0 && phase < 1 ? phase : ((phase % 1) + 1) % 1;
}

/**
 * How far back along the barrel the recoil currently sits, in pixels.
 *
 * Squaring the decay makes the barrel leap back and then settle, rather than
 * sliding home at a constant speed.
 */
export function recoilOffset(recoil: number, profile: MotionProfile): number {
  return recoil * recoil * profile.recoilDistance;
}

/** Vertical idle bob in pixels, centre-relative. */
export function bobOffset(bobPhase: number, profile: MotionProfile): number {
  return Math.sin(bobPhase * Math.PI * 2) * profile.bobAmplitude;
}
