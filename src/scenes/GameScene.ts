import Phaser from 'phaser';

import { GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { MAP_DEFINITIONS, DEFAULT_MAP_ID } from '../data/mapDefinitions';
import type { MapDefinition } from '../data/mapDefinitions';
import { GameStateStore } from '../systems/game-state/GameStateStore';
import { PlacementSystem } from '../systems/placement/PlacementSystem';
import type { TowerArchetype } from '../types/tower';
import { worldToGrid, tileRect, getTileType } from '../utils/grid';

export class GameScene extends Phaser.Scene {
  private store!: GameStateStore;
  private map!: MapDefinition;
  private placementSystem!: PlacementSystem;

  /** The archetype the player currently has selected — updated externally. */
  selectedArchetype: TowerArchetype = 'basic';

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

    // ── 4. Draw tile grid ─────────────────────────────────────────────────────
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

    // ── 5. Pointer click — tower placement ────────────────────────────────────
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

    // ── 6. Launch UIScene ─────────────────────────────────────────────────────
    if (!this.scene.isActive(SCENE_KEYS.UI)) {
      this.scene.launch(SCENE_KEYS.UI);
    }
  }
}
