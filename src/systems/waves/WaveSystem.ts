import type { WaveDefinition } from './waveDefinitions';
import type { EnemyState } from '../../types/enemy';
import { EnemyFactory } from '../enemies/EnemyFactory';
import type { Vec2 } from '../../types/game';

/**
 * Callbacks consumed by WaveSystem.update().
 */
export interface WaveSystemCallbacks {
  /** Called when a new enemy is spawned — caller adds it to the active list. */
  onSpawn: (enemy: EnemyState) => void;
  /** Called when the wave has fully spawned all enemies. Does NOT mean all enemies are dead. */
  onWaveSpawnComplete: () => void;
}

/**
 * Pure-TS WaveSystem — no Phaser dependency.
 * Orchestrates timed enemy spawning from a WaveDefinition.
 */
export class WaveSystem {
  private factory: EnemyFactory;
  private currentWave: WaveDefinition | null = null;
  private entryIndex: number = 0;   // which SpawnEntry we're processing
  private spawnCount: number = 0;   // how many spawned in current entry
  private timer: number = 0;        // seconds until next spawn
  private spawnComplete: boolean = false;

  constructor(factory: EnemyFactory) {
    this.factory = factory;
  }

  /** Start a new wave. Resets all internal state. */
  startWave(wave: WaveDefinition): void {
    this.currentWave = wave;
    this.entryIndex = 0;
    this.spawnCount = 0;
    this.timer = 0;
    this.spawnComplete = false;
  }

  /**
   * Tick the wave system by `dt` seconds.
   * - Decrements timer by dt
   * - When timer <= 0: spawn next enemy, reset timer to entry.interval, advance counters
   * - When all entries exhausted: call callbacks.onWaveSpawnComplete() once
   */
  update(dt: number, spawnPos: Vec2, callbacks: WaveSystemCallbacks): void {
    if (this.spawnComplete || this.currentWave === null) return;

    const wave = this.currentWave;

    this.timer -= dt;

    while (this.timer <= 0) {
      // Check if all entries are exhausted
      if (this.entryIndex >= wave.entries.length) {
        this.spawnComplete = true;
        callbacks.onWaveSpawnComplete();
        return;
      }

      const entry = wave.entries[this.entryIndex];

      // Spawn the next enemy in the current entry
      const enemy = this.factory.create(entry.archetype, spawnPos);
      callbacks.onSpawn(enemy);
      this.spawnCount += 1;

      if (this.spawnCount >= entry.count) {
        // Move to next entry
        this.entryIndex += 1;
        this.spawnCount = 0;

        // Check immediately if we just finished the last entry
        if (this.entryIndex >= wave.entries.length) {
          this.timer = 0;
          this.spawnComplete = true;
          callbacks.onWaveSpawnComplete();
          return;
        }
      }

      // Reset timer for next spawn (use the current entry's interval)
      // If we just moved to a new entry, the next spawn uses the new entry's interval
      const nextEntry = wave.entries[this.entryIndex];
      this.timer += nextEntry !== undefined ? nextEntry.interval : 0;
    }
  }

  get isSpawnComplete(): boolean {
    return this.spawnComplete;
  }
}
