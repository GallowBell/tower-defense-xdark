import Phaser from 'phaser';

import { GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { MAP_DEFINITIONS, DEFAULT_MAP_ID } from '../data/mapDefinitions';
import type { MapDefinition } from '../data/mapDefinitions';
import { GameStateStore } from '../systems/game-state/GameStateStore';
import { PlacementSystem } from '../systems/placement/PlacementSystem';
import { PathSystem } from '../systems/path/PathSystem';
import { EnemyFactory } from '../systems/enemies/EnemyFactory';
import { WaveSystem } from '../systems/waves/WaveSystem';
import { WAVE_DEFINITIONS } from '../systems/waves/waveDefinitions';
import type { EnemyState } from '../types/enemy';
import type { TowerArchetype } from '../types/tower';
import type { Vec2 } from '../types/game';
import { worldToGrid, tileRect, getTileType, waypointsToWorld } from '../utils/grid';

export class GameScene extends Phaser.Scene {
  private store!: GameStateStore;
  private map!: MapDefinition;
  private placementSystem!: PlacementSystem;

  /** The archetype the player currently has selected — updated externally. */
  selectedArchetype: TowerArchetype = 'basic';

  // ── Enemy / wave fields ───────────────────────────────────────────────────
  private pathSystem!: PathSystem;
  private waveSystem!: WaveSystem;
  private enemyFactory!: EnemyFactory;
  private worldWaypoints!: Vec2[];
  private enemies: EnemyState[] = [];
  private enemyGraphics!: Map<string, Phaser.GameObjects.Arc>;
  private waveSpawnComplete: boolean = false;

  // ── Overlay guard ─────────────────────────────────────────────────────────
  private overlayShown = false;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    // ── 1. Store ──────────────────────────────────────────────────────────────
    const existing = this.registry.get('store') as GameStateStore | null;
    this.store = existing ?? new GameStateStore();
    if (!existing) {
      this.registry.set('store', this.store);
    }

    // ── 2. Map ────────────────────────────────────────────────────────────────
    this.map = MAP_DEFINITIONS[DEFAULT_MAP_ID];

    // ── 3. Placement system ───────────────────────────────────────────────────
    this.placementSystem = new PlacementSystem();

    // ── 4. Enemy / wave systems ───────────────────────────────────────────────
    this.pathSystem = new PathSystem();
    this.enemyFactory = new EnemyFactory();
    this.waveSystem = new WaveSystem(this.enemyFactory);
    this.worldWaypoints = waypointsToWorld(this.map);
    this.enemyGraphics = new Map();

    // ── 5. Draw tile grid ─────────────────────────────────────────────────────
    for (let row = 0; row < this.map.rows; row++) {
      for (let col = 0; col < this.map.cols; col++) {
        const tileType = getTileType(this.map, col, row);
        if (tileType === null) continue;

        const rect = tileRect(col, row);
        const cx = rect.x + rect.w / 2;
        const cy = rect.y + rect.h / 2;

        if (tileType === 'path') {
          this.add.rectangle(cx, cy, rect.w, rect.h, GAME_COLORS.path, 0.85);
        } else if (tileType === 'buildable') {
          this.add.rectangle(cx, cy, rect.w, rect.h, GAME_COLORS.buildZone, 0.35);
        }
        // 'blocked' tiles get no visual overlay
      }
    }

    // ── 6. Pointer click — tower placement ────────────────────────────────────
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const grid = worldToGrid(pointer.worldX, pointer.worldY);
      if (!grid) return;

      const result = this.placementSystem.attempt(
        this.map,
        this.store.towers,
        this.store.gold,
        this.store.gameState,
        grid.x,
        grid.y,
        this.selectedArchetype,
      );

      if (result.success) {
        this.store.addTower(result.tower!);
        this.store.spendGold(result.goldSpent!);

        const tower = result.tower!;
        this.add.circle(tower.worldX, tower.worldY, tower.definition.radius, tower.definition.color);
      }
    });

    // ── 7. Start Wave button ──────────────────────────────────────────────────
    this.add
      .text(1100, 16, '▶ Start Wave', {
        color: '#f8fafc',
        fontFamily: 'Arial',
        fontSize: '18px',
      })
      .setInteractive()
      .on('pointerdown', () => this.startNextWave());

    // ── 8. Kick off first wave immediately ───────────────────────────────────
    this.startNextWave();

    // ── 9. Launch UIScene ─────────────────────────────────────────────────────
    if (!this.scene.isActive(SCENE_KEYS.UI)) {
      this.scene.launch(SCENE_KEYS.UI);
    }
  }

  // ── Wave control ──────────────────────────────────────────────────────────

  private startNextWave(): void {
    if (this.store.gameState !== 'idle' && this.store.gameState !== 'wave_cleared') return;
    const waveIndex = this.store.wave - 1; // store.wave is 1-based display, WAVE_DEFINITIONS is 0-indexed
    const waveDef = WAVE_DEFINITIONS[waveIndex];
    if (!waveDef) return;
    this.store.nextWave(); // sets gameState = 'wave_active'
    this.waveSpawnComplete = false;
    this.waveSystem.startWave(waveDef);
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    // Once overlay is shown the game has ended — stop running game logic.
    if (this.overlayShown) return;

    const dt = delta / 1000; // convert ms → seconds

    // ── Tick wave spawner ─────────────────────────────────────────────────────
    if (this.store.gameState === 'wave_active') {
      const spawnPos = this.worldWaypoints[0]; // enemies spawn at first waypoint
      this.waveSystem.update(dt, spawnPos, {
        onSpawn: (enemy) => {
          this.enemies.push(enemy);
          const circle = this.add.circle(enemy.x, enemy.y, enemy.radius, enemy.color);
          this.enemyGraphics.set(enemy.uid, circle);
        },
        onWaveSpawnComplete: () => {
          this.waveSpawnComplete = true;
        },
      });
    }

    // ── Advance enemies along path ────────────────────────────────────────────
    let allEnemiesDone = this.enemies.length > 0;
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.leaked) {
        // handle leaked — deduct life (leaked flag set but not yet marked dead)
        if (enemy.leaked && !enemy.dead) {
          enemy.dead = true; // mark to avoid double-counting
          this.store.loseLife();
          // Remove graphics
          const g = this.enemyGraphics.get(enemy.uid);
          if (g) { g.destroy(); this.enemyGraphics.delete(enemy.uid); }
        }
        continue;
      }

      this.pathSystem.advance(enemy, this.worldWaypoints, dt);

      // Update graphic position
      const g = this.enemyGraphics.get(enemy.uid);
      if (g) { g.setPosition(enemy.x, enemy.y); }

      // Check if just leaked after advance
      if (enemy.leaked) {
        enemy.dead = true;
        this.store.loseLife();
        const gr = this.enemyGraphics.get(enemy.uid);
        if (gr) { gr.destroy(); this.enemyGraphics.delete(enemy.uid); }
      }

      if (!enemy.dead) allEnemiesDone = false;
    }

    // ── Check wave cleared: spawn done AND all enemies dead/leaked ────────────
    if (this.store.gameState === 'wave_active' && this.waveSpawnComplete && allEnemiesDone) {
      this.enemies = this.enemies.filter(e => !e.dead);
      this.store.earnGold(WAVE_DEFINITIONS[this.store.wave - 1]?.goldBonus ?? 0);
      this.store.onWaveCleared();
    }

    // ── Check end states ──────────────────────────────────────────────────────
    if (this.store.gameState === 'game_over') {
      this.showOverlay('GAME OVER', 0xef4444);
    }
    if (this.store.gameState === 'victory') {
      this.showOverlay('VICTORY!', 0x22c55e);
    }
  }

  // ── Overlay ───────────────────────────────────────────────────────────────

  private showOverlay(text: string, color: number): void {
    if (this.overlayShown) return;
    this.overlayShown = true;
    const { width, height } = this.cameras.main;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    this.add.text(width / 2, height / 2, text, {
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: 'Arial',
      fontSize: '72px',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
  }
}
