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
import { TowerUpgradeSystem } from '../systems/upgrade/TowerUpgradeSystem';
import { SkinManager } from '../systems/skins/SkinManager';
import { SoundManager } from '../systems/audio/SoundManager';
import { ParticleManager } from '../systems/effects/ParticleManager';

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
  private shotGraphics!: Phaser.GameObjects.Graphics;
  private hpGraphics!: Phaser.GameObjects.Graphics;
  private rangeIndicator!: Phaser.GameObjects.Graphics;

  // ── Upgrade fields ────────────────────────────────────────────────────────
  private upgradeSystem!: TowerUpgradeSystem;
  private selectedTowerUid: string | null = null;

  // ── Overlay guard ─────────────────────────────────────────────────────────
  private overlayShown = false;

  // ── Skin manager ──────────────────────────────────────────────────────────
  private skinManager!: SkinManager;

  // ── Audio / effects ────────────────────────────────────────────────────────
  private soundManager!: SoundManager;
  private particleManager!: ParticleManager;

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
    const selectedMapId = this.registry.get('selectedMapId') as string | null;
    this.map = MAP_DEFINITIONS[selectedMapId ?? DEFAULT_MAP_ID];

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
    this.rangeIndicator = this.add.graphics();

    // ── 4c. Visual systems ───────────────────────────────────────────────────
    this.towerRenderer = new TowerRenderer();
    this.projectileSystem = new ProjectileSystem();
    this.towerGraphics = this.add.graphics();
    this.projectileGraphics = this.add.graphics();

    // ── 4d. Upgrade system ────────────────────────────────────────────────────
    this.upgradeSystem = new TowerUpgradeSystem();
    this.selectedTowerUid = null;
    this.registry.set('selectedTowerUid', null);

    // ── 4e. Skin system ───────────────────────────────────────────────────────
    const selectedTheme = this.registry.get('selectedTheme') as string | null;
    this.skinManager = new SkinManager(selectedTheme ?? undefined);

    // ── 4f. Audio / effects ────────────────────────────────────────────────────
    this.soundManager = new SoundManager();
    this.particleManager = new ParticleManager(this);

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

    // ── 6. Pointer interactions ───────────────────────────────────────────────
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        // ── Left-click: check if clicking on a placed tower → select it ──
        let clickedTower: typeof this.store.towers[number] | null = null;
        for (const t of this.store.towers) {
          const dx = pointer.worldX - t.worldX;
          const dy = pointer.worldY - t.worldY;
          if (Math.sqrt(dx * dx + dy * dy) < t.definition.radius + 20) {
            clickedTower = t;
            break;
          }
        }

        if (clickedTower) {
          // Toggle selection
          this.selectedTowerUid = this.selectedTowerUid === clickedTower.uid ? null : clickedTower.uid;
          this.registry.set('selectedTowerUid', this.selectedTowerUid);
        } else {
          // ── Not clicking a tower → try placement ──────────────────────
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
            this.soundManager.playUIClick();
            this.selectedTowerUid = null;
            this.registry.set('selectedTowerUid', null);
          }
        }
      } else if (pointer.rightButtonDown()) {
        // ── Right-click: Sell tower for 50% refund ──────────────────────
        const sellRadius = 30;
        for (let i = this.store.towers.length - 1; i >= 0; i--) {
          const tower = this.store.towers[i];
          const dx = pointer.worldX - tower.worldX;
          const dy = pointer.worldY - tower.worldY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < tower.definition.radius + sellRadius) {
            const refund = Math.floor(tower.definition.cost * 0.5);
            this.store.earnGold(refund);
            this.soundManager.playSell();
            this.store.removeTower(tower.uid);
            if (this.selectedTowerUid === tower.uid) {
              this.selectedTowerUid = null;
              this.registry.set('selectedTowerUid', null);
            }
            break;
          }
        }
      }
    });

    // ── 6b. Pointer move — range indicator on hover ──────────────────────────
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.rangeIndicator.clear();

      const hoverRadius = 20;
      for (const tower of this.store.towers) {
        const dx = pointer.worldX - tower.worldX;
        const dy = pointer.worldY - tower.worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < tower.definition.radius + hoverRadius) {
          this.rangeIndicator.lineStyle(1, 0xffffff, 0.3);
          this.rangeIndicator.strokeCircle(tower.worldX, tower.worldY, tower.definition.range);
          this.rangeIndicator.fillStyle(tower.definition.color, 0.08);
          this.rangeIndicator.fillCircle(tower.worldX, tower.worldY, tower.definition.range);
          break;
        }
      }
    });

    // ── 6c. Disable browser right-click context menu ──────────────────────────
    this.input.mouse?.disableContextMenu();

    // ── 6d. Upgrade hotkey [U] ────────────────────────────────────────────────
    this.input.keyboard?.on('keydown-U', () => {
      if (!this.selectedTowerUid) return;
      const tower = this.store.towers.find(t => t.uid === this.selectedTowerUid);
      if (!tower || !this.upgradeSystem.canUpgrade(tower, this.store.gold)) return;
      this.upgradeSystem.applyUpgrade(tower);
      this.store.spendGold(this.upgradeSystem.getUpgradeCost(tower));
      this.soundManager.playUpgrade();
      this.particleManager.towerUpgrade(tower.worldX, tower.worldY);
      this.registry.set('selectedTowerUid', this.selectedTowerUid);
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

    // ── 8. First wave starts when player clicks "Start Wave" ────────────────
    // No auto-start — player places towers first, then clicks the button

    // ── 9. Launch UIScene ─────────────────────────────────────────────────────
    if (!this.scene.isActive(SCENE_KEYS.UI)) {
      this.scene.launch(SCENE_KEYS.UI);
    }
  }

  // ── Wave control ──────────────────────────────────────────────────────────

  private startNextWave(): void {
    if (this.store.gameState !== 'idle' && this.store.gameState !== 'wave_cleared') return;
    const waveIndex = this.store.wave - 1;
    const waveDef = WAVE_DEFINITIONS[waveIndex];
    if (!waveDef) return;
    this.store.nextWave();
    this.soundManager.playWaveStart();
    this.waveSpawnComplete = false;
    this.waveSystem.startWave(waveDef);
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.overlayShown) return;

    const dt = delta / 1000;

    // ── Tick wave spawner ─────────────────────────────────────────────────────
    if (this.store.gameState === 'wave_active') {
      const spawnPos = this.worldWaypoints[0];
      this.waveSystem.update(dt, spawnPos, {
        onSpawn: (enemy) => {
          this.enemies.push(enemy);
          const enemyColor = this.skinManager.getEnemyColors()[enemy.archetype as keyof ReturnType<typeof this.skinManager.getEnemyColors>] ?? enemy.color;
          const obj = this.enemyRenderer.createObject(this, enemy, enemyColor);
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
        if (enemy.leaked && !enemy.dead) {
          enemy.dead = true;
          this.store.loseLife();
          this.soundManager.playEnemyDeath();
          this.particleManager.enemyLeaked(enemy.x, enemy.y);
          const g = this.enemyObjects.get(enemy.uid);
          if (g) { g.destroy(); this.enemyObjects.delete(enemy.uid); }
        }
        continue;
      }

      this.pathSystem.advance(enemy, this.worldWaypoints, dt);

      const g = this.enemyObjects.get(enemy.uid);
      if (g && 'setPosition' in g) {
        (g as unknown as { setPosition(x: number, y: number): void }).setPosition(enemy.x, enemy.y);
      }

      if (enemy.leaked) {
        enemy.dead = true;
        this.store.loseLife();
        this.soundManager.playEnemyDeath();
        this.particleManager.enemyLeaked(enemy.x, enemy.y);
        const gr = this.enemyObjects.get(enemy.uid);
        if (gr) { gr.destroy(); this.enemyObjects.delete(enemy.uid); }
      }
    }

    // ── Combat tick ──────────────────────────────────────────────────────────
    if (this.store.gameState === 'wave_active') {
      const shots = this.combatSystem.tick(this.store.towers, this.enemies, dt);
      for (const shot of shots) {
        this.handleShot(shot);
        if (shot.target && !shot.target.dead) {
          this.projectileSystem.fire(
            shot.tower.worldX,
            shot.tower.worldY,
            { uid: shot.target.uid, x: shot.target.x,   y: shot.target.y },
            shot.tower.definition.color,
          );
        }
      }
    }

    // ── Projectile update ─────────────────────────────────────────────────────
    this.projectileSystem.update(
      dt,
      this.enemies.map((e) => ({
        uid: e.uid, x: e.x, y: e.y, dead: e.dead,
      })),
    );

    // ── Draw everything ──────────────────────────────────────────────────────
    this.drawHpBars();

    // ── Check wave cleared ────────────────────────────────────────────────────
    const allEnemiesDone = this.enemies.length > 0 && this.enemies.every(e => e.dead);
    if (this.store.gameState === 'wave_active' && this.waveSpawnComplete && allEnemiesDone) {
      this.enemies = this.enemies.filter(e => !e.dead);
      this.store.earnGold(WAVE_DEFINITIONS[this.store.wave - 1]?.goldBonus ?? 0);
      this.soundManager.playWaveCleared();
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
    if (shot.killed) {
      this.store.earnGold(shot.goldEarned);
      this.soundManager.playGoldEarned();
      this.soundManager.playEnemyDeath();
      this.particleManager.enemyDeath(shot.target);
      const g = this.enemyObjects.get(shot.target.uid);
      if (g) { g.destroy(); this.enemyObjects.delete(shot.target.uid); }
    }

    this.soundManager.playShoot();
    this.particleManager.towerFire(shot.tower.worldX, shot.tower.worldY, shot.tower.definition.color);
    this.shotGraphics.lineStyle(1, 0xffffff, 0.7);
    this.shotGraphics.lineBetween(
      shot.tower.worldX, shot.tower.worldY,
      shot.target.x, shot.target.y,
    );
  }

  private drawHpBars(): void {
    this.shotGraphics.clear();
    this.hpGraphics.clear();
    this.towerGraphics.clear();
    this.projectileGraphics.clear();
    this.rangeIndicator.clear();

    // Draw towers
    this.towerRenderer.draw(this.towerGraphics, this.store.towers, this.skinManager.getTowerColors());

    // Draw selection ring around selected tower
    if (this.selectedTowerUid) {
      const selected = this.store.towers.find(t => t.uid === this.selectedTowerUid);
      if (selected) {
        this.towerGraphics.lineStyle(2, 0xffffff, 0.6);
        this.towerGraphics.strokeCircle(selected.worldX, selected.worldY, selected.definition.radius + 4);
      }
    }

    // Draw projectiles
    for (const proj of this.projectileSystem.getAlive()) {
      const px = proj.startX + (proj.targetX - proj.startX) * proj.progress;
      const py = proj.startY + (proj.targetY - proj.startY) * proj.progress;
      this.projectileGraphics.fillStyle(proj.color, 1);
      this.projectileGraphics.fillCircle(px, py, 3);
    }

    // Draw HP bars above alive enemies
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;

      const barWidth = enemy.radius * 2;
      const barHeight = 4;
      const barX = enemy.x - enemy.radius;
      const barY = enemy.y - enemy.radius - 8;

      this.hpGraphics.fillStyle(0x7f1d1d, 1);
      this.hpGraphics.fillRect(barX, barY, barWidth, barHeight);

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
    this.selectedTowerUid = null;
    this.registry.set('selectedTowerUid', null);

    // Play end-game sound
    if (text === 'GAME OVER') {
      this.soundManager.playGameOver();
    } else {
      this.soundManager.playVictory();
    }
    const { width, height } = this.cameras.main;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    this.add.text(width / 2, height * 0.42, text, {
      color: `#${color.toString(16).padStart(6, '0')}`,
      fontFamily: 'Arial',
      fontSize: '72px',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Restart button
    const btnRestart = this.add.text(width / 2, height * 0.58, '▶ Play Again', {
      color: '#f8fafc',
      fontFamily: 'Arial',
      fontSize: '24px',
      backgroundColor: '#7c3aed',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btnRestart.on('pointerover', () => btnRestart.setStyle({ backgroundColor: '#6d28d9' }));
    btnRestart.on('pointerout', () => btnRestart.setStyle({ backgroundColor: '#7c3aed' }));
    btnRestart.on('pointerdown', () => {
      this.registry.set('store', null);
      this.scene.stop(SCENE_KEYS.UI);
      this.scene.restart();
    });

    // Main Menu button
    const btnMenu = this.add.text(width / 2, height * 0.7, '← Main Menu', {
      color: '#cbd5e1',
      fontFamily: 'Arial',
      fontSize: '20px',
      backgroundColor: '#334155',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btnMenu.on('pointerover', () => btnMenu.setStyle({ backgroundColor: '#475569' }));
    btnMenu.on('pointerout', () => btnMenu.setStyle({ backgroundColor: '#334155' }));
    btnMenu.on('pointerdown', () => {
      this.registry.set('store', null);
      this.scene.stop(SCENE_KEYS.UI);
      this.scene.start(SCENE_KEYS.MENU);
    });
  }
}