import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RunSimulator } from '../../src/systems/sim/RunSimulator';
import {
  endlessSource,
  campaignSource,
} from '../../src/systems/waves/waveSource';
import { MAP_DEFINITIONS } from '../../src/data/mapDefinitions';
import { TOWER_DEFINITIONS } from '../../src/entities/towers/towerDefinitions';
import { CAMPAIGN_LENGTH } from '../../src/systems/waves/waveGenerator';

const MAP = MAP_DEFINITIONS.map01;

/** Buildable tiles hugging the path on map01, best-first. */
const SPOTS: [number, number][] = [
  [9, 3],
  [11, 3],
  [7, 3],
  [5, 3],
  [3, 3],
  [13, 3],
  [11, 5],
  [11, 7],
  [11, 9],
  [9, 11],
  [13, 11],
  [7, 11],
  [11, 4],
  [11, 6],
  [11, 8],
  [15, 11],
  [5, 11],
  [17, 11],
];

/** Spend everything sensible between waves: build out, then upgrade. */
function reinvest(
  sim: RunSimulator,
  spots: [number, number][],
  upgrade: boolean,
): void {
  for (const [x, y] of spots) {
    if (sim.store.gold < TOWER_DEFINITIONS.heavy.cost) break;
    sim.placeTower(x, y, 'heavy');
  }
  for (const [x, y] of spots) {
    if (sim.store.gold < TOWER_DEFINITIONS.basic.cost) break;
    sim.placeTower(x, y, 'basic');
  }
  if (!upgrade) return;
  for (let pass = 0; pass < 6; pass++) {
    let spent = 0;
    for (const tower of sim.store.towers) spent += sim.upgradeTower(tower.uid);
    if (spent === 0) break;
  }
}

/** Play an endless run to its end. @returns the wave the run died on. */
function playEndless(spots: [number, number][], upgrade: boolean): number {
  const sim = new RunSimulator(MAP, {}, endlessSource());
  let wave = 0;

  // The cap is a test guard, not a game rule: a run that reached it would mean
  // the curve never outpaces a player, which is the thing being asserted.
  while (!sim.isOver && wave < 80) {
    reinvest(sim, spots, upgrade);
    if (!sim.startNextWave()) break;
    wave = sim.store.wave;
    if (!sim.runActiveWave(400)) throw new Error(`wave ${wave} never resolved`);
  }
  return wave;
}

describe('endless mode ends', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it('eventually beats even a fully built and upgraded board', () => {
    // The whole point of the compounding health multiplier. Without it the
    // same board reached wave 60 with 13 of 20 lives still in hand, because
    // more enemies also means more gold: a linear threat never outpaces a
    // player who keeps reinvesting.
    const reached = playEndless(SPOTS, true);

    expect(reached).toBeLessThan(80);
    expect(reached).toBeGreaterThan(CAMPAIGN_LENGTH);
  });

  it('rewards every dimension of play', () => {
    // A curve that ends regardless of what the player does is not a
    // difficulty curve, it is a timer.
    const strong = playEndless(SPOTS, true);
    const noUpgrades = playEndless(SPOTS, false);
    const fewTowers = playEndless(SPOTS.slice(0, 4), true);
    const minimal = playEndless(SPOTS.slice(0, 2), true);

    expect(strong).toBeGreaterThan(noUpgrades);
    expect(noUpgrades).toBeGreaterThan(fewTowers);
    expect(fewTowers).toBeGreaterThan(minimal);
  });

  it('gives a competent player a run several times the campaign', () => {
    // Endless should feel like a reason to come back, not like eight waves
    // with a different label.
    expect(playEndless(SPOTS, true)).toBeGreaterThan(CAMPAIGN_LENGTH * 2);
  });

  it('never reaches victory, however long it is played', () => {
    const sim = new RunSimulator(MAP, {}, endlessSource());
    expect(sim.store.totalWaves).toBe(Infinity);

    for (let i = 0; i < 12; i++) {
      reinvest(sim, SPOTS, true);
      if (!sim.startNextWave()) break;
      sim.runActiveWave(400);
      expect(sim.store.gameState).not.toBe('victory');
    }
  });
});

describe('endless and campaign share their opening', () => {
  it('plays the authored waves first, so endless is not a different game', () => {
    const campaign = campaignSource();
    const endless = endlessSource();

    for (let i = 0; i < CAMPAIGN_LENGTH; i++) {
      expect(endless.waveAt(i), `wave ${i + 1}`).toBe(campaign.waveAt(i));
    }
  });

  it('parts ways exactly where the authored waves run out', () => {
    expect(campaignSource().waveAt(CAMPAIGN_LENGTH)).toBeNull();
    expect(endlessSource().waveAt(CAMPAIGN_LENGTH)).not.toBeNull();
  });

  it('leaves the campaign a finite, winnable run', () => {
    expect(campaignSource().totalWaves).toBe(CAMPAIGN_LENGTH);
  });
});
