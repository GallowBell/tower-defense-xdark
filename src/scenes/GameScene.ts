import Phaser from 'phaser';

import { GAME_COLORS, RENDER_DEPTH, SCENE_KEYS } from '../app/constants';
import { MAP_DEFINITIONS, DEFAULT_MAP_ID } from '../data/mapDefinitions';
import type { MapDefinition } from '../data/mapDefinitions';
import type { GameStateStore } from '../systems/game-state/GameStateStore';
import { RunSimulator, SIM_STEP } from '../systems/sim/RunSimulator';
import type { ShotEvent } from '../systems/combat/CombatSystem';
import type { EnemyState } from '../types/enemy';
import type { TowerArchetype } from '../types/tower';
import { worldToGrid, tileRect, getTileType } from '../utils/grid';
import { TowerView } from '../systems/render/TowerView';
import {
  TEXTURE_KEYS,
  pathTileTextureKey,
  pathVariantAt,
} from '../systems/render/textures';
import { FloatingTextPool } from '../systems/render/FloatingTextPool';
import { BuildGhost } from '../systems/render/BuildGhost';
import { validatePlacement } from '../systems/placement/PlacementSystem';
import { SplashRingPool } from '../systems/render/SplashRingPool';
import { EnemyView } from '../systems/render/EnemyView';
import { ProjectileSystem } from '../systems/render/ProjectileSystem';
import {
  projectileStyleFor,
  trailPuff,
} from '../systems/render/projectileStyle';
import { TowerUpgradeSystem } from '../systems/upgrade/TowerUpgradeSystem';
import { SkinManager } from '../systems/skins/SkinManager';
import { SoundManager } from '../systems/audio/SoundManager';
import { ParticleManager } from '../systems/effects/ParticleManager';

export class GameScene extends Phaser.Scene {
  /**
   * The run itself. This scene renders it and feeds it input; it does not
   * simulate anything of its own, so what ships is what the tests exercise.
   */
  private sim!: RunSimulator;
  private map!: MapDefinition;

  /** Authoritative run state, owned by the simulator. Read by UIScene. */
  private get store(): GameStateStore {
    return this.sim.store;
  }

  /** The archetype the player currently has selected — updated externally. */
  selectedArchetype: TowerArchetype = 'basic';

  // ── Enemy visual fields ───────────────────────────────────────────────────
  /** One view per live enemy, keyed by uid. Dying enemies leave this map. */
  private enemyViews!: Map<string, EnemyView>;

  // ── Tower visual fields ───────────────────────────────────────────────────
  /** One view per live tower, keyed by uid. */
  private towerViews!: Map<string, TowerView>;
  private towerGraphics!: Phaser.GameObjects.Graphics;
  private floatingText!: FloatingTextPool;
  private splashRings!: SplashRingPool;

  // ── Projectile visual fields ──────────────────────────────────────────────
  private projectileSystem!: ProjectileSystem;
  private projectileGraphics!: Phaser.GameObjects.Graphics;

  // ── Combat visual fields ──────────────────────────────────────────────────
  private shotGraphics!: Phaser.GameObjects.Graphics;
  private rangeIndicator!: Phaser.GameObjects.Graphics;

  // ── Upgrade fields ────────────────────────────────────────────────────────
  /** Stateless. Read by UIScene to show the upgrade panel's projections. */
  readonly upgradeSystem = new TowerUpgradeSystem();
  private selectedTowerUid: string | null = null;

  // ── Overlay guard ─────────────────────────────────────────────────────────
  private overlayShown = false;

  // ── Skin manager ──────────────────────────────────────────────────────────
  private skinManager!: SkinManager;

  // ── Audio / effects ────────────────────────────────────────────────────────
  private soundManager!: SoundManager;
  private particleManager!: ParticleManager;

  // ── Fixed-timestep simulation ─────────────────────────────────────────────
  /** Seconds of simulated time per step, shared with the simulator. */
  private static readonly SIM_STEP = SIM_STEP;
  /** Safety valve so a long frame (tab-out, GC pause) can't spiral. */
  private static readonly MAX_STEPS_PER_FRAME = 8;
  private simAccumulator: number = 0;
  /**
   * Seconds the simulation advanced on the last frame. Animations ease over
   * this rather than wall-clock time, so they track the speed multiplier and
   * stop dead when the game is paused.
   */
  private lastSimulatedSeconds: number = 0;

  /** Tower under the pointer, drawn during the render phase. */
  private hoveredTowerUid: string | null = null;

  /** Preview of the tower the player would build where they are pointing. */
  private buildGhost!: BuildGhost;
  /**
   * Last known pointer position in world space.
   *
   * Kept rather than read on demand because the preview has to answer to more
   * than pointer movement: switching archetype with 1/2/3, or earning the gold
   * mid-wave, both change the verdict without the mouse going anywhere.
   */
  private pointerWorld: { x: number; y: number } | null = null;

  // ── QoL: Speed control ────────────────────────────────────────────────────
  private speedMultiplier: number = 1;
  private speedText!: Phaser.GameObjects.Text;

  // ── QoL: Pause ───────────────────────────────────────────────────────────
  private isPaused: boolean = false;
  private pauseButton!: Phaser.GameObjects.Text;
  private pauseOverlayObjs: { visible: boolean; destroy(): void }[] = [];

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    // ── 0. Reset per-run state ────────────────────────────────────────────────
    // Phaser reuses this Scene instance across scene.restart(), so field
    // initialisers do NOT re-run. Anything mutable must be reset by hand or it
    // leaks into the next run (a stale overlayShown froze the board entirely).
    this.overlayShown = false;
    this.isPaused = false;
    this.speedMultiplier = 1;
    this.simAccumulator = 0;
    this.lastSimulatedSeconds = 0;
    this.hoveredTowerUid = null;
    this.pointerWorld = null;
    this.towerViews = new Map();
    this.pauseOverlayObjs = [];

    // ── 1. Map ────────────────────────────────────────────────────────────────
    const selectedMapId = this.registry.get('selectedMapId') as string | null;
    this.map = MAP_DEFINITIONS[selectedMapId ?? DEFAULT_MAP_ID];

    // ── 2. Enemy rendering ────────────────────────────────────────────────────
    this.enemyViews = new Map();

    // ── 3. The run ────────────────────────────────────────────────────────────
    // Hooks are presentation only — sound, sprites, particles. Every rule that
    // decides the run lives in RunSimulator.
    this.sim = new RunSimulator(this.map, {
      onSpawn: (enemy) => this.spawnEnemyView(enemy),
      onShot: (shot) => this.handleShot(shot),
      onLeak: (enemy) => {
        this.soundManager.playEnemyDeath();
        this.particleManager.enemyLeaked(enemy.x, enemy.y);
        this.retireEnemyView(enemy.uid, 'leak');
      },
      onWaveCleared: () => this.soundManager.playWaveCleared(),
    });
    this.registry.set('store', this.sim.store);

    // ── 4. Combat visuals ─────────────────────────────────────────────────────
    this.shotGraphics = this.add.graphics();
    this.rangeIndicator = this.add.graphics();

    // ── 4c. Visual systems ───────────────────────────────────────────────────
    this.projectileSystem = new ProjectileSystem();
    this.towerGraphics = this.add
      .graphics()
      .setDepth(RENDER_DEPTH.rangeIndicator);
    this.projectileGraphics = this.add
      .graphics()
      .setDepth(RENDER_DEPTH.projectiles);
    this.floatingText = new FloatingTextPool(this);
    this.splashRings = new SplashRingPool(this);
    this.buildGhost = new BuildGhost(this);

    // ── 4d. Tower selection ───────────────────────────────────────────────────
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

        // Textured tiles rather than flat rectangles. The colours still come
        // from GAME_COLORS — the textures are white and carry only the shading.
        if (tileType === 'path') {
          this.add
            .image(cx, cy, pathTileTextureKey(pathVariantAt(col, row)))
            .setTint(GAME_COLORS.path)
            .setDepth(RENDER_DEPTH.tiles);
        } else if (tileType === 'buildable') {
          this.add
            .image(cx, cy, TEXTURE_KEYS.tileBuild)
            .setTint(GAME_COLORS.buildZone)
            .setDepth(RENDER_DEPTH.tiles);
        }
      }
    }

    // ── 6. Pointer interactions ───────────────────────────────────────────────
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isPaused) return;

      if (pointer.leftButtonDown()) {
        let clickedTower: (typeof this.store.towers)[number] | null = null;
        for (const t of this.store.towers) {
          const dx = pointer.worldX - t.worldX;
          const dy = pointer.worldY - t.worldY;
          if (Math.sqrt(dx * dx + dy * dy) < t.definition.radius + 20) {
            clickedTower = t;
            break;
          }
        }

        if (clickedTower) {
          this.selectedTowerUid =
            this.selectedTowerUid === clickedTower.uid
              ? null
              : clickedTower.uid;
          this.registry.set('selectedTowerUid', this.selectedTowerUid);
        } else {
          const grid = worldToGrid(pointer.worldX, pointer.worldY);
          if (!grid) return;

          const result = this.sim.placeTower(
            grid.x,
            grid.y,
            this.selectedArchetype,
          );

          if (result.success) {
            this.addTowerView(result.tower!, true);
            this.soundManager.playUIClick();
            this.selectedTowerUid = null;
            this.registry.set('selectedTowerUid', null);
          }
        }
      } else if (pointer.rightButtonDown()) {
        const sellRadius = 30;
        for (let i = this.store.towers.length - 1; i >= 0; i--) {
          const tower = this.store.towers[i];
          const dx = pointer.worldX - tower.worldX;
          const dy = pointer.worldY - tower.worldY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < tower.definition.radius + sellRadius) {
            this.sim.sellTower(tower.uid);
            this.retireTowerView(tower.uid);
            this.soundManager.playSell();
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
    // Only records what is hovered — drawing happens in drawScene(), because
    // the render phase clears this layer every frame.
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.pointerWorld = { x: pointer.worldX, y: pointer.worldY };

      const hoverRadius = 20;
      this.hoveredTowerUid = null;
      for (const tower of this.store.towers) {
        const dx = pointer.worldX - tower.worldX;
        const dy = pointer.worldY - tower.worldY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < tower.definition.radius + hoverRadius) {
          this.hoveredTowerUid = tower.uid;
          break;
        }
      }
    });

    // ── 6c. Disable browser right-click context menu ──────────────────────────
    this.input.mouse?.disableContextMenu();

    // ── 6d. Upgrade hotkey [U] ────────────────────────────────────────────────
    this.input.keyboard?.on('keydown-U', () => {
      if (this.isPaused || !this.selectedTowerUid) return;
      const tower = this.store.towers.find(
        (t) => t.uid === this.selectedTowerUid,
      );
      if (!tower || this.sim.upgradeTower(tower.uid) === 0) return;

      this.soundManager.playUpgrade();
      this.towerViews.get(tower.uid)?.playUpgradePop();
      this.particleManager.towerUpgrade(tower.worldX, tower.worldY);
      this.registry.set('selectedTowerUid', this.selectedTowerUid);
    });

    // ── 7. Top bar controls ──────────────────────────────────────────────────
    const btnStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: '#f8fafc',
      fontFamily: 'Arial',
      fontSize: '15px',
      backgroundColor: '#334155',
      padding: { x: 6, y: 4 },
    };

    // Speed control button (right side)
    this.speedText = this.add
      .text(990, 16, 'Speed 1x', btnStyle)
      .setInteractive()
      .on('pointerdown', () => {
        const newSpeed = this.speedMultiplier === 1 ? 2 : 1;
        this.speedMultiplier = newSpeed;
        this.speedText.setText(`Speed ${newSpeed}x`);
        this.applyTimeScale();
      });

    // Pause button
    this.pauseButton = this.add
      .text(1110, 16, '⏸ Pause', { ...btnStyle, backgroundColor: '#7c3aed' })
      .setInteractive()
      .on('pointerdown', () => this.togglePause());

    // Start Wave button
    this.add
      .text(1200, 16, '▶ Start', { ...btnStyle, backgroundColor: '#1d4ed8' })
      .setInteractive()
      .on('pointerdown', () => this.startNextWave());

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-SPACE', () => this.togglePause());
    this.input.keyboard?.on('keydown-P', () => this.togglePause());

    // ── 8. Pause overlay (hidden initially) ──────────────────────────────────
    const { width, height } = this.cameras.main;
    const pauseBg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.45)
      .setDepth(1000)
      .setVisible(false);
    const pauseText = this.add
      .text(width / 2, height / 2, '⏸ PAUSED', {
        color: '#f8fafc',
        fontFamily: 'Arial',
        fontSize: '56px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1001)
      .setVisible(false);
    this.pauseOverlayObjs = [pauseBg, pauseText];

    // ── 8b. Tear-down ─────────────────────────────────────────────────────────
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.floatingText.clear();
      this.splashRings.clear();
      this.towerViews.clear();
      this.enemyViews.clear();
      this.buildGhost.destroy();
    });

    // ── 9. Launch UIScene ─────────────────────────────────────────────────────
    if (!this.scene.isActive(SCENE_KEYS.UI)) {
      this.scene.launch(SCENE_KEYS.UI);
    }
  }

  // ── Pause / resume ──────────────────────────────────────────────────────────

  private togglePause(): void {
    if (this.overlayShown) return;
    this.isPaused = !this.isPaused;
    this.pauseButton.setText(this.isPaused ? '▶ Resume' : '⏸ Pause');
    this.pauseOverlayObjs.forEach((obj) => {
      obj.visible = this.isPaused;
    });
    this.applyTimeScale();
  }

  /**
   * Keep Phaser's own clocks in step with the simulation.
   *
   * Tweens, timers and emitters run on wall-clock time by default, so at 2x
   * enemies moved twice as fast while every animation still played at 1x, and
   * pausing froze the board while damage numbers kept drifting upward.
   */
  private applyTimeScale(): void {
    const scale = this.isPaused ? 0 : this.speedMultiplier;
    this.tweens.timeScale = scale;
    this.time.timeScale = scale;
    this.particleManager.setTimeScale(scale);
  }

  // ── Wave control ──────────────────────────────────────────────────────────

  private startNextWave(): void {
    if (this.isPaused) return;
    if (this.sim.startNextWave()) this.soundManager.playWaveStart();
  }

  // ── Per-frame update ──────────────────────────────────────────────────────

  update(_time: number, delta: number): void {
    if (this.overlayShown) return;

    // ── Fixed-timestep simulation ────────────────────────────────────────────
    // The sim always advances in SIM_STEP slices, so a tower's rate of fire is
    // independent of frame rate and of the speed multiplier. Scaling a variable
    // dt instead made 2x speed *harder*: enemies moved twice as fast while
    // CombatSystem.tick() still fired each tower at most once per call.
    this.clearFrameGraphics();

    if (this.isPaused) {
      this.lastSimulatedSeconds = 0;
    } else {
      // Cap the frame delta so a tab-out or GC pause doesn't bank a huge backlog.
      this.simAccumulator +=
        Math.min(delta / 1000, 0.25) * this.speedMultiplier;

      let steps = 0;
      while (
        this.simAccumulator >= GameScene.SIM_STEP &&
        steps < GameScene.MAX_STEPS_PER_FRAME
      ) {
        this.sim.step(GameScene.SIM_STEP);
        this.simAccumulator -= GameScene.SIM_STEP;
        steps += 1;
      }

      // Hit the safety valve: drop the backlog rather than replaying it forever.
      if (steps === GameScene.MAX_STEPS_PER_FRAME) this.simAccumulator = 0;

      this.lastSimulatedSeconds = steps * GameScene.SIM_STEP;

      // Projectiles are decoration, so they animate once per frame over however
      // much time the simulation actually advanced.
      if (steps > 0) {
        this.projectileSystem.update(
          this.lastSimulatedSeconds,
          this.sim.enemies.map((e) => ({
            uid: e.uid,
            x: e.x,
            y: e.y,
            dead: e.dead,
          })),
        );
      }
    }

    // ── Render ───────────────────────────────────────────────────────────────
    this.drawScene();

    // ── Check end states ──────────────────────────────────────────────────────
    if (this.store.gameState === 'game_over') {
      this.showOverlay('GAME OVER', 0xef4444);
    }
    if (this.store.gameState === 'victory') {
      this.showOverlay('VICTORY!', 0x22c55e);
    }
  }

  /**
   * Preview the tower that would be built under the cursor.
   *
   * Hidden while the pointer is over an existing tower, because that already
   * shows its own range and the click there selects rather than builds.
   */
  private drawBuildGhost(): void {
    if (!this.pointerWorld || this.isPaused || this.hoveredTowerUid) {
      this.buildGhost.hide();
      return;
    }

    const grid = worldToGrid(this.pointerWorld.x, this.pointerWorld.y);
    if (!grid) {
      this.buildGhost.hide();
      return;
    }

    const rejection = validatePlacement(
      this.map,
      this.store.towers,
      this.store.gold,
      this.store.gameState,
      grid.x,
      grid.y,
      this.selectedArchetype,
    );

    const rect = tileRect(grid.x, grid.y);
    this.buildGhost.show(
      rect.x + rect.w / 2,
      rect.y + rect.h / 2,
      this.selectedArchetype,
      rejection,
    );
  }

  // ── Tower views ────────────────────────────────────────────────────────────

  /**
   * @param animateIn true when the player just built this tower, so it drops
   *   in. False on the recovery path below, which is backfilling a view for a
   *   tower that has been standing there all along.
   */
  private addTowerView(
    tower: (typeof this.store.towers)[number],
    animateIn = false,
  ): void {
    const color = this.skinManager.resolveTowerColor(
      tower.archetype,
      tower.definition.color,
    );
    const view = new TowerView(this, tower, color);
    this.towerViews.set(tower.uid, view);
    if (animateIn) view.playPlaceIn();
  }

  /**
   * Drop a sold tower's view and let it shrink away.
   *
   * The view leaves the registry immediately — the tower is already gone from
   * the simulation, so it must stop being synced this frame, and the tile it
   * stood on is free to build on again before the animation finishes.
   */
  private retireTowerView(uid: string): void {
    const view = this.towerViews.get(uid);
    if (!view) return;
    this.towerViews.delete(uid);
    view.playSellOut();
  }

  /**
   * Point every tower at what it is tracking.
   *
   * Aiming is eased over time, so it uses the frame's simulated seconds rather
   * than raw wall-clock: at 2x the turret has to keep up with the enemies.
   */
  private syncTowerViews(): void {
    const dt = this.lastSimulatedSeconds;

    for (const tower of this.store.towers) {
      // A tower can exist without a view after a restart mid-run.
      let view = this.towerViews.get(tower.uid);
      if (!view) {
        this.addTowerView(tower);
        view = this.towerViews.get(tower.uid)!;
      }

      const target = tower.targetUid
        ? (this.sim.enemies.find((e) => e.uid === tower.targetUid && !e.dead) ??
          null)
        : null;

      view.sync(tower, target, dt);
    }
  }

  /** Create the view for a freshly spawned enemy. */
  private spawnEnemyView(enemy: EnemyState): void {
    const enemyColor =
      this.skinManager.getEnemyColors()[
        enemy.archetype as keyof ReturnType<
          typeof this.skinManager.getEnemyColors
        >
      ] ?? enemy.color;
    this.enemyViews.set(enemy.uid, new EnemyView(this, enemy, enemyColor));
  }

  /**
   * Drop an enemy's view and let it play out how it went.
   *
   * The view leaves the registry immediately so it stops being synced this
   * frame — the enemy is gone from the run either way; what differs is whether
   * the player just earned gold or just lost a life. Safe to call twice: a
   * splash victim can be reported dead by the same shot that killed the target.
   */
  private retireEnemyView(uid: string, how: 'death' | 'leak'): void {
    const view = this.enemyViews.get(uid);
    if (!view) return;
    this.enemyViews.delete(uid);
    if (how === 'leak') view.playLeak();
    else view.playDeath();
  }

  // ── Combat helpers ────────────────────────────────────────────────────────

  private handleShot(shot: ShotEvent): void {
    // The simulator already banked the gold — this just plays the sound.
    if (shot.goldEarned > 0) this.soundManager.playGoldEarned();

    // Everything the shot touched flinches, whether or not it died — that is
    // what makes the Brute's armour legible: it flashes on every pellet while
    // its health bar barely moves.
    this.enemyViews.get(shot.target.uid)?.flashHit();
    for (const splashed of shot.splashHits) {
      this.enemyViews.get(splashed.uid)?.flashHit();
    }

    if (shot.killed) {
      this.soundManager.playEnemyDeath();
      this.particleManager.enemyDeath(shot.target);
      this.retireEnemyView(shot.target.uid, 'death');
    }

    for (const victim of shot.splashKills) {
      this.particleManager.enemyDeath(victim);
      this.retireEnemyView(victim.uid, 'death');
    }

    if (!shot.target.dead) {
      this.projectileSystem.fire(
        shot.tower.worldX,
        shot.tower.worldY,
        { uid: shot.target.uid, x: shot.target.x, y: shot.target.y },
        shot.tower.definition.color,
        shot.tower.archetype,
      );
    }

    this.soundManager.playShoot();
    this.towerViews.get(shot.tower.uid)?.fire();
    this.particleManager.towerFire(
      shot.tower.worldX,
      shot.tower.worldY,
      shot.tower.definition.color,
    );
    this.shotGraphics.lineStyle(1, 0xffffff, 0.7);
    this.shotGraphics.lineBetween(
      shot.tower.worldX,
      shot.tower.worldY,
      shot.target.x,
      shot.target.y,
    );

    // Blast ring, so the player can see what the splash actually covered. It
    // expands into the real radius over ~a third of a second: stroked straight
    // onto shotGraphics it lasted one frame, which is not long enough to read.
    const { splashRadius } = shot.tower.definition;
    if (splashRadius > 0) {
      this.splashRings.show(
        shot.target.x,
        shot.target.y,
        splashRadius,
        shot.tower.definition.color,
      );
    }

    // Floating damage number
    this.floatingText.show(
      shot.target.x,
      shot.target.y,
      shot.wasCrit ? `CRIT! ${shot.damageDealt}` : `${shot.damageDealt}`,
      shot.wasCrit ? '#ffd700' : '#ffffff',
      shot.wasCrit,
    );
  }

  /**
   * Wipe the per-frame graphics layers.
   *
   * Runs BEFORE the simulation steps, not after: shot lines are emitted from
   * inside handleShot() during a step, so clearing afterwards erased them in
   * the same frame and the shot lines never appeared at all.
   */
  private clearFrameGraphics(): void {
    this.shotGraphics.clear();
    this.towerGraphics.clear();
    this.projectileGraphics.clear();
    this.rangeIndicator.clear();
  }

  private drawScene(): void {
    // Draw hovered tower's range (recorded by the pointermove handler)
    if (
      this.hoveredTowerUid &&
      this.hoveredTowerUid !== this.selectedTowerUid
    ) {
      const hovered = this.store.towers.find(
        (t) => t.uid === this.hoveredTowerUid,
      );
      if (hovered) {
        this.rangeIndicator.lineStyle(1, 0xffffff, 0.3);
        this.rangeIndicator.strokeCircle(
          hovered.worldX,
          hovered.worldY,
          hovered.definition.range,
        );
        this.rangeIndicator.fillStyle(hovered.definition.color, 0.08);
        this.rangeIndicator.fillCircle(
          hovered.worldX,
          hovered.worldY,
          hovered.definition.range,
        );
      }
    }

    this.drawBuildGhost();

    // Towers draw themselves — this only steers them.
    this.syncTowerViews();

    // Draw selection ring + range around selected tower
    if (this.selectedTowerUid) {
      const selected = this.store.towers.find(
        (t) => t.uid === this.selectedTowerUid,
      );
      if (selected) {
        // Range circle
        this.towerGraphics.lineStyle(1, 0xffffff, 0.25);
        this.towerGraphics.strokeCircle(
          selected.worldX,
          selected.worldY,
          selected.definition.range,
        );
        this.towerGraphics.fillStyle(selected.definition.color, 0.06);
        this.towerGraphics.fillCircle(
          selected.worldX,
          selected.worldY,
          selected.definition.range,
        );

        // Selection ring
        this.towerGraphics.lineStyle(2, 0xffffff, 0.6);
        this.towerGraphics.strokeCircle(
          selected.worldX,
          selected.worldY,
          selected.definition.radius + 4,
        );
      }
    }

    // Draw projectiles: a head, plus a trail of puffs tapering out behind it.
    // The trail is derived from the flight line rather than from remembered
    // positions, so it costs no per-projectile history.
    for (const proj of this.projectileSystem.getAlive()) {
      const dx = proj.targetX - proj.startX;
      const dy = proj.targetY - proj.startY;
      const px = proj.startX + dx * proj.progress;
      const py = proj.startY + dy * proj.progress;

      const distance = Math.hypot(dx, dy);
      const style = projectileStyleFor(proj.archetype);

      if (distance > 0) {
        // Unit vector pointing back down the flight path.
        const backX = -dx / distance;
        const backY = -dy / distance;
        // Never draw trail behind the muzzle it came from.
        const travelled = distance * proj.progress;

        for (let i = 0; i < style.trailSegments; i++) {
          const puff = trailPuff(i, style);
          if (puff.distance > travelled) break;
          this.projectileGraphics.fillStyle(proj.color, puff.alpha);
          this.projectileGraphics.fillCircle(
            px + backX * puff.distance,
            py + backY * puff.distance,
            puff.radius,
          );
        }
      }

      this.projectileGraphics.fillStyle(proj.color, 1);
      this.projectileGraphics.fillCircle(px, py, style.headRadius);
    }

    // Enemies draw themselves, health bars included — this only walks them.
    // Their gait runs off distance covered, so it uses the same simulated
    // seconds the towers aim on.
    const dt = this.lastSimulatedSeconds;
    for (const enemy of this.sim.enemies) {
      if (enemy.dead) continue;

      // An enemy can exist without a view after a restart mid-run.
      let view = this.enemyViews.get(enemy.uid);
      if (!view) {
        this.spawnEnemyView(enemy);
        view = this.enemyViews.get(enemy.uid)!;
      }

      view.sync(enemy, dt);
    }
  }

  // ── Overlay ───────────────────────────────────────────────────────────────

  private showOverlay(text: string, color: number): void {
    if (this.overlayShown) return;
    this.overlayShown = true;
    this.isPaused = false;
    this.speedMultiplier = 1;
    this.applyTimeScale();
    this.selectedTowerUid = null;
    this.registry.set('selectedTowerUid', null);

    if (text === 'GAME OVER') {
      this.soundManager.playGameOver();
    } else {
      this.soundManager.playVictory();
    }

    const { width, height } = this.cameras.main;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    this.add
      .text(width / 2, height * 0.42, text, {
        color: `#${color.toString(16).padStart(6, '0')}`,
        fontFamily: 'Arial',
        fontSize: '72px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);

    // Restart
    const btnRestart = this.add
      .text(width / 2, height * 0.58, '▶ Play Again', {
        color: '#f8fafc',
        fontFamily: 'Arial',
        fontSize: '24px',
        backgroundColor: '#7c3aed',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btnRestart.on('pointerover', () =>
      btnRestart.setStyle({ backgroundColor: '#6d28d9' }),
    );
    btnRestart.on('pointerout', () =>
      btnRestart.setStyle({ backgroundColor: '#7c3aed' }),
    );
    btnRestart.on('pointerdown', () => {
      this.registry.set('store', null);
      this.scene.stop(SCENE_KEYS.UI);
      this.scene.restart();
    });

    // Main Menu
    const btnMenu = this.add
      .text(width / 2, height * 0.7, '← Main Menu', {
        color: '#cbd5e1',
        fontFamily: 'Arial',
        fontSize: '20px',
        backgroundColor: '#334155',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btnMenu.on('pointerover', () =>
      btnMenu.setStyle({ backgroundColor: '#475569' }),
    );
    btnMenu.on('pointerout', () =>
      btnMenu.setStyle({ backgroundColor: '#334155' }),
    );
    btnMenu.on('pointerdown', () => {
      this.registry.set('store', null);
      this.scene.stop(SCENE_KEYS.UI);
      this.scene.start(SCENE_KEYS.MENU);
    });
  }
}
