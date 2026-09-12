import type { TowerArchetype } from '../../types/tower';

/**
 * How each tower's shot looks and how fast it flies.
 *
 * Every projectile used to be the same 3px dot at the same 500px/s, so the
 * only thing distinguishing a Cannon shell from a Gunner pellet in flight was
 * its colour. Shots are pure decoration — the simulation applies damage the
 * instant a tower fires — so these are free to differ, and the spread is kept
 * modest so a slow shell never visibly lands long after the damage number it
 * caused.
 */
export interface ProjectileStyle {
  /** Radius of the projectile head in pixels. */
  headRadius: number;
  /** How far the trail reaches behind the head, in pixels. */
  trailLength: number;
  /** Puffs drawn along the trail. More reads as smokier, fewer as cleaner. */
  trailSegments: number;
  /** Flight speed in pixels per second. */
  speed: number;
}

export const PROJECTILE_STYLES: Record<TowerArchetype, ProjectileStyle> = {
  // Archer: a clean bolt. Quick, thin, barely any smoke.
  basic: { headRadius: 3, trailLength: 14, trailSegments: 3, speed: 560 },
  // Gunner: a tracer — small head, long thin streak, fastest of the three.
  fast: { headRadius: 2, trailLength: 22, trailSegments: 4, speed: 760 },
  // Cannon: a heavy shell that lobs across with a fat smoky tail.
  heavy: { headRadius: 5, trailLength: 26, trailSegments: 5, speed: 420 },
};

/** Style for a tower archetype's shots. */
export function projectileStyleFor(archetype: TowerArchetype): ProjectileStyle {
  return PROJECTILE_STYLES[archetype];
}

/**
 * Where one trail puff sits and how it looks.
 *
 * @param index 0 is the puff nearest the head.
 * @returns distance behind the head in pixels, plus the puff's radius and
 *   alpha, both tapering to nothing at the tail.
 */
export function trailPuff(
  index: number,
  style: ProjectileStyle,
): { distance: number; radius: number; alpha: number } {
  // 1-based over the segment count, so no puff sits exactly on the head and
  // the last one lands at the full trail length.
  const t = (index + 1) / style.trailSegments;
  return {
    distance: style.trailLength * t,
    radius: style.headRadius * (1 - t * 0.75),
    alpha: 0.55 * (1 - t),
  };
}
