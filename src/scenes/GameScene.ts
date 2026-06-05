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
import { CombatSystem } from '../systems/combat/CombatSystem';
import type { ShotEvent } from '../systems/combat/CombatSystem';
import type { EnemyState } from '../types/enemy';
import type { TowerArchetype } from '../types/tower';
import type { Vec2 } from '../types/game';
import { worldToGrid, tileRect, getTileType, waypointsToWorld } from '../utils/grid';
import { TowerRenderer } from '../systems/render/TowerRenderer';
import { EnemyRenderer } from '../systems/render/EnemyRenderer';
import { ProjectileSystem } from '../systems/render/ProjectileSystem';

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
  private enemyRenderer!: EnemyRenderer;
  private enemyObjects!: Map<string, Phaser.GameObjects.GameObject>;
  private waveSpawnComplete: boolean = false;

  // ── Tower visual fields ───────────────────────────────────────────────────
  private towerRenderer!: TowerRenderer;
  private towerGraphics!: Phaser.GameObjects.Graphics;

  // ── Projectile visual fields ──────────────────────────────────────────────
  private projectileSystem!: ProjectileSystem;
  private projectileGraphics!: Phaser.GameObjects.Graphics;

  // ── Combat fields ─────────────────────────────────────────────────────────
  private combatSystem!: CombatSystem;
  private shotGraphics!: Phaser.GameObjects.Graphics;  // reused each frame for shot lines
  private hpGraphics!: Phaser.GameObjects.Graphics;    // reused each frame for HP bars

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
    this.enemyRenderer = new EnemyRenderer();
    this.enemyObjects = new Map();

    // ── 4b. Combat system ─────────────────────────────────────────────────────
    this.combatSystem = new CombatSystem();
    this.shotGraphics = this.add.graphics();
    this.hpGraphics = this.add.graphics();

    // ── 4c. Visual systems ───────────────────────────────────────────────────
    this.towerRenderer = new TowerRenderer();
    this.projectileSystem = new ProjectileSystem();
    this.towerGraphics = this.add.graphics();
    this.projectileGraphics = this.add.graphics();

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
        // Towers are now drawn by TowerRenderer via drawHpBars()
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
          const obj = this.enemyRenderer.createObject(this, enemy);
          this.enemyObjects.set(enemy.uid, obj);
        },
        onWaveSpawnComplete: () => {
          this.waveSpawnComplete = true;
        },
      });
    }

    // ── Advance enemies along path ────────────────────────────────────────────
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.leaked) {
        // handle leaked — deduct life (leaked flag set but not yet marked dead)
        if (enemy.leaked && !enemy.dead) {
          enemy.dead = true; // mark to avoid double-counting
          this.store.loseLife();
          // Remove graphics
          const g = this.enemyObjects.get(enemy.uid);
          if (g) { g.destroy(); this.enemyObjects.delete(enemy.uid); }
        }
        continue;
      }

      this.pathSystem.advance(enemy, this.worldWaypoints, dt);

      // Update graphic position
      const g = this.enemyObjects.get(enemy.uid);
      if (g && 'setPosition' in g) {
        (g as unknown as { setPosition(x: number, y: number): void }).setPosition(enemy.x, enemy.y);
      }

      // Check if just leaked after advance
      if (enemy.leaked) {
        enemy.dead = true;
        this.store.loseLife();
        const gr = this.enemyObjects.get(enemy.uid);
        if (gr) { gr.destroy(); this.enemyObjects.delete(enemy.uid); }
      }
    }

    // ── Combat tick ──────────────────────────────────────────────────────────
    if (this.store.gameState === 'wave_active') {
      const shots = this.combatSystem.tick(this.store.towers, this.enemies, dt);
      for (const shot of shots) {
        this.handleShot(shot);
        // Fire projectile visuals
        if (shot.target && !shot.target.dead) {
          this.projectileSystem.fire(
            shot.tower.worldX,
            shot.tower.worldY,
            { uid: shot.target.uid, x: shot.target.x, y: shot.target.y },
            shot.tower.definition.color,
          );
        }
      }
    }

    // ── Projectile update ─────────────────────────────────────────────────────
    this.projectileSystem.update(
      dt,
      this.enemies.map((e) => ({
        uid: e.uid,
        x: e.x,
        y: e.y,
        dead: e.dead,
      })),
    );

    // ── Draw HP bars, towers, and projectiles ────────────────────────────────
    this.drawHpBars();

    // ── Check wave cleared: spawn done AND all enemies dead/leaked ────────────
    const allEnemiesDone = this.enemies.length > 0 && this.enemies.every(e => e.dead);
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

  // ── Combat helpers ────────────────────────────────────────────────────────

  private handleShot(shot: ShotEvent): void {
    // 1. Earn gold if killed
    if (shot.killed) {
      this.store.earnGold(shot.goldEarned);
      // Remove enemy graphics
      const g = this.enemyObjects.get(shot.target.uid);
      if (g) { g.destroy(); this.enemyObjects.delete(shot.target.uid); }
    }

    // 2. Draw a brief shot line from tower to enemy
    //    shotGraphics is cleared at the start of each frame in drawHpBars()
    //    Line: white (0xffffff), alpha 0.7, lineWidth 1
    this.shotGraphics.lineStyle(1, 0xffffff, 0.7);
    this.shotGraphics.lineBetween(
      shot.tower.worldX, shot.tower.worldY,
      shot.target.x, shot.target.y,
    );
  }

  private drawHpBars(): void {
    // Clear ALL graphics objects at start of each frame
    this.shotGraphics.clear();
    this.hpGraphics.clear();
    this.towerGraphics.clear();
    this.projectileGraphics.clear();

    // Draw towers
    this.towerRenderer.draw(this.towerGraphics, this.store.towers);

    // Draw projectiles
    for (const proj of this.projectileSystem.getAlive()) {
      // Interpolate projectile position
      const px = proj.startX + (proj.targetX - proj.startX) * proj.progress;
      const py = proj.startY + (proj.targetY - proj.startY) * proj.progress;
      this.projectileGraphics.fillStyle(proj.color, 1);
      this.projectileGraphics.fillCircle(px, py, 3);
    }

    // For each alive enemy, draw an HP bar above it
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;

      const barWidth = enemy.radius * 2;
      const barHeight = 4;
      const barX = enemy.x - enemy.radius;
      const barY = enemy.y - enemy.radius - 8;

      // Background (dark red)
      this.hpGraphics.fillStyle(0x7f1d1d, 1);
      this.hpGraphics.fillRect(barX, barY, barWidth, barHeight);

      // Health portion (bright green → yellow → red based on hp ratio)
      const ratio = enemy.hp / enemy.maxHp;
      const hpColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xeab308 : 0xef4444;
      this.hpGraphics.fillStyle(hpColor, 1);
      this.hpGraphics.fillRect(barX, barY, barWidth * ratio, barHeight);
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