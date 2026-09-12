import { GameStateStore } from '../game-state/GameStateStore';
import { PlacementSystem } from '../placement/PlacementSystem';
import type { PlacementResult } from '../placement/PlacementSystem';
import { PathSystem } from '../path/PathSystem';
import { EnemyFactory } from '../enemies/EnemyFactory';
import { WaveSystem } from '../waves/WaveSystem';
import { WAVE_DEFINITIONS } from '../waves/waveDefinitions';
import type { WaveDefinition } from '../waves/waveDefinitions';
import { CombatSystem } from '../combat/CombatSystem';
import type { ShotEvent } from '../combat/CombatSystem';
import { TowerUpgradeSystem } from '../upgrade/TowerUpgradeSystem';
import { DIFFICULTY } from '../../data/difficultyScaling';
import { waypointsToWorld } from '../../utils/grid';
import type { MapDefinition } from '../../data/mapDefinitions';
import type { EnemyState } from '../../types/enemy';
import type { TowerArchetype } from '../../types/tower';
import type { Vec2 } from '../../types/game';

/** Seconds of simulated time per step. The run only ever advances by this. */
export const SIM_STEP = 1 / 60;

/**
 * Presentation hooks. The simulation never needs them — they exist so a scene
 * can hang sound, sprites and particles off events it would otherwise have to
 * poll for. Every one is optional.
 */
export interface RunSimulatorHooks {
  onSpawn?(enemy: EnemyState): void;
  onShot?(shot: ShotEvent): void;
  onLeak?(enemy: EnemyState): void;
  onWaveCleared?(wave: number): void;
}

/**
 * The whole tower-defense run, with no Phaser in sight.
 *
 * This owns the authoritative game state and the order systems tick in, so the
 * scene renders a simulation rather than being one. That also makes a run
 * reproducible in a test: fixed steps in, win or loss out, which is the only
 * way to check that the balance is actually beatable.
 */
export class RunSimulator {
  readonly store = new GameStateStore();
  readonly map: MapDefinition;
  readonly waves: WaveDefinition[];

  /** Enemies in the current wave, including this wave's dead until it clears. */
  enemies: EnemyState[] = [];

  private readonly worldWaypoints: Vec2[];
  private readonly placement = new PlacementSystem();
  private readonly path = new PathSystem();
  private readonly combat = new CombatSystem();
  private readonly upgrades = new TowerUpgradeSystem();
  private readonly waveSystem: WaveSystem;
  private readonly hooks: RunSimulatorHooks;
  private waveSpawnComplete = false;

  constructor(
    map: MapDefinition,
    hooks: RunSimulatorHooks = {},
    waves: WaveDefinition[] = WAVE_DEFINITIONS,
  ) {
    this.map = map;
    this.waves = waves;
    this.hooks = hooks;
    this.worldWaypoints = waypointsToWorld(map);
    this.waveSystem = new WaveSystem(new EnemyFactory());
    // The wave list is the run's length — otherwise a caller could pass waves
    // the store would never count as a victory.
    this.store.totalWaves = waves.length;
  }

  /** True once the run has been decided either way. */
  get isOver(): boolean {
    return (
      this.store.gameState === 'game_over' || this.store.gameState === 'victory'
    );
  }

  get won(): boolean {
    return this.store.gameState === 'victory';
  }

  // ── Player actions ─────────────────────────────────────────────────────────

  /**
   * Try to buy and place a tower. Gold only leaves the purse on success, and
   * the tower is only added once it has been paid for.
   */
  placeTower(
    gridX: number,
    gridY: number,
    archetype: TowerArchetype,
  ): PlacementResult {
    const result = this.placement.attempt(
      this.map,
      this.store.towers,
      this.store.gold,
      this.store.gameState,
      gridX,
      gridY,
      archetype,
    );
    if (!result.success) return result;
    if (!this.store.spendGold(result.goldSpent!)) {
      return { success: false, reason: 'insufficient_gold' };
    }
    this.store.addTower(result.tower!);
    return result;
  }

  /** Sell a tower back for a share of everything sunk into it. */
  sellTower(uid: string): number {
    const tower = this.store.towers.find((t) => t.uid === uid);
    if (!tower) return 0;

    const refund = Math.floor(tower.investedGold * DIFFICULTY.sellRefundRatio);
    this.store.earnGold(refund);
    this.store.removeTower(uid);
    return refund;
  }

  /**
   * Upgrade a tower one level.
   * @returns the gold charged, or 0 when the tower is maxed or unaffordable.
   */
  upgradeTower(uid: string): number {
    const tower = this.store.towers.find((t) => t.uid === uid);
    if (!tower || !this.upgrades.canUpgrade(tower, this.store.gold)) return 0;

    // Price must be read before the upgrade: afterwards it quotes the next level.
    const cost = this.upgrades.getUpgradeCost(tower);
    if (!this.store.spendGold(cost)) return 0;
    this.upgrades.applyUpgrade(tower);
    return cost;
  }

  /** Send the next wave. @returns false when no wave can start right now. */
  startNextWave(): boolean {
    const { store } = this;
    if (store.gameState !== 'idle' && store.gameState !== 'wave_cleared')
      return false;

    const waveDef = this.waves[store.wave - 1];
    if (!waveDef) return false;

    store.nextWave();
    this.waveSpawnComplete = false;
    this.waveSystem.startWave(waveDef);
    return true;
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  /** Advance the run by exactly `dt` seconds. */
  step(dt: number = SIM_STEP): void {
    const { store } = this;

    // ── Spawn ────────────────────────────────────────────────────────────────
    if (store.gameState === 'wave_active') {
      this.waveSystem.update(dt, this.worldWaypoints[0], {
        onSpawn: (enemy) => {
          const hpMult = DIFFICULTY.enemyHpScale(store.wave);
          enemy.hp = Math.round(enemy.hp * hpMult);
          enemy.maxHp = enemy.hp;

          this.enemies.push(enemy);
          this.hooks.onSpawn?.(enemy);
        },
        onWaveSpawnComplete: () => {
          this.waveSpawnComplete = true;
        },
      });
    }

    // ── Move ─────────────────────────────────────────────────────────────────
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.leaked) {
        if (enemy.leaked && !enemy.dead) this.retireLeaked(enemy);
        continue;
      }

      this.path.advance(enemy, this.worldWaypoints, dt);
      if (enemy.leaked) this.retireLeaked(enemy);
    }

    // ── Fight ────────────────────────────────────────────────────────────────
    if (store.gameState === 'wave_active') {
      for (const shot of this.combat.tick(store.towers, this.enemies, dt)) {
        // Splash means a shot can pay out even when the primary target lives.
        if (shot.goldEarned > 0) store.earnGold(shot.goldEarned);
        this.hooks.onShot?.(shot);
      }
    }

    // ── Wave cleared ─────────────────────────────────────────────────────────
    const allEnemiesDone =
      this.enemies.length > 0 && this.enemies.every((e) => e.dead);
    if (
      store.gameState === 'wave_active' &&
      this.waveSpawnComplete &&
      allEnemiesDone
    ) {
      this.enemies = this.enemies.filter((e) => !e.dead);

      const cleared = store.wave;
      const bonus = Math.round(
        (this.waves[cleared - 1]?.goldBonus ?? 0) *
          DIFFICULTY.rewardScale(cleared),
      );
      store.earnGold(bonus);
      store.onWaveCleared();
      this.hooks.onWaveCleared?.(cleared);
    }
  }

  /**
   * Run the wave in progress to its end.
   * @param maxSeconds give up after this much simulated time, so a stalemate
   *   (an enemy nothing can reach) fails the caller instead of hanging it.
   * @returns false if it hit the time limit.
   */
  runActiveWave(maxSeconds = 300): boolean {
    let elapsed = 0;
    while (this.store.gameState === 'wave_active' && elapsed < maxSeconds) {
      this.step(SIM_STEP);
      elapsed += SIM_STEP;
    }
    return this.store.gameState !== 'wave_active';
  }

  /**
   * Play the run out to a win or a loss, starting each wave as the last clears.
   * @param betweenWaves called while idle, to spend gold before the next wave.
   */
  runToEnd(
    betweenWaves?: (sim: RunSimulator) => void,
    maxSeconds = 2000,
  ): boolean {
    let elapsed = 0;
    while (!this.isOver && elapsed < maxSeconds) {
      betweenWaves?.(this);
      if (!this.startNextWave()) break;

      const startedAt = elapsed;
      while (this.store.gameState === 'wave_active' && elapsed < maxSeconds) {
        this.step(SIM_STEP);
        elapsed += SIM_STEP;
      }
      // No progress at all means the wave can never end — bail out rather than spin.
      if (elapsed === startedAt) break;
    }
    return this.isOver;
  }

  /** Retire a leaked enemy exactly once and charge the player a life. */
  private retireLeaked(enemy: EnemyState): void {
    enemy.dead = true;
    this.store.loseLife();
    this.hooks.onLeak?.(enemy);
  }
}
