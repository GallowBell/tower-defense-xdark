import Phaser from 'phaser';

import { APP_CONFIG } from '../app/config';
import { APP_TITLE, GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { MAP_DEFINITIONS } from '../data/mapDefinitions';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.MENU);
  }

  create(): void {
    const { width, height } = APP_CONFIG.dimensions;

    this.cameras.main.setBackgroundColor(GAME_COLORS.background);

    this.add
      .text(width / 2, height * 0.12, APP_TITLE, {
        color: GAME_COLORS.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.2, 'Select a map to start', {
        color: GAME_COLORS.mutedText,
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
      })
      .setOrigin(0.5);

    // ── Map selection cards ────────────────────────────────────────────────
    const mapIds = Object.keys(MAP_DEFINITIONS);
    const cardWidth = 340;
    const cardHeight = 200;
    const gap = 30;
    const totalWidth = mapIds.length * cardWidth + (mapIds.length - 1) * gap;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height * 0.55;

    mapIds.forEach((mapId, i) => {
      const mapDef = MAP_DEFINITIONS[mapId];
      const cx = startX + i * (cardWidth + gap);
      const cy = cardY;

      // Card background
      const card = this.add.rectangle(cx, cy, cardWidth, cardHeight, 0x1e293b, 1)
        .setStrokeStyle(2, 0x3b82f6, 0.6)
        .setInteractive({ useHandCursor: true });

      // Map name
      this.add.text(cx, cy - 40, mapDef.displayName, {
        color: GAME_COLORS.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Map ID label
      this.add.text(cx, cy + 10, `Map: ${mapDef.id}`, {
        color: GAME_COLORS.mutedText,
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
      }).setOrigin(0.5);

      // Path length info
      this.add.text(cx, cy + 40, `${mapDef.waypoints.length - 1} segments`, {
        color: '#94a3b8',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
      }).setOrigin(0.5);

      // Hover effect
      card.on('pointerover', () => {
        card.setFillStyle(0x334155, 1);
        card.setStrokeStyle(2, 0x7c3aed, 1);
      });
      card.on('pointerout', () => {
        card.setFillStyle(0x1e293b, 1);
        card.setStrokeStyle(2, 0x3b82f6, 0.6);
      });

      // Click to start game with selected map
      card.on('pointerdown', () => {
        this.startGame(mapId);
      });
    });
  }

  private startGame(mapId: string): void {
    this.registry.set('selectedMapId', mapId);
    // Destroy existing store so game starts fresh
    this.registry.set('store', null);
    this.scene.start(SCENE_KEYS.GAME);
  }
}