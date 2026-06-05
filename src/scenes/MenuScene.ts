import Phaser from 'phaser';

import { APP_CONFIG } from '../app/config';
import { APP_TITLE, GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { MAP_DEFINITIONS } from '../data/mapDefinitions';
import { THEMES } from '../data/skins/themes';

export class MenuScene extends Phaser.Scene {
  private selectedThemeId: string = 'default';

  constructor() {
    super(SCENE_KEYS.MENU);
  }

  create(): void {
    const { width, height } = APP_CONFIG.dimensions;

    this.cameras.main.setBackgroundColor(GAME_COLORS.background);

    this.add
      .text(width / 2, height * 0.1, APP_TITLE, {
        color: GAME_COLORS.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: '42px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.17, 'Select a map to start', {
        color: GAME_COLORS.mutedText,
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
      })
      .setOrigin(0.5);

    // ── Map selection cards ────────────────────────────────────────────────
    const mapIds = Object.keys(MAP_DEFINITIONS);
    const cardWidth = 340;
    const cardHeight = 190;
    const gap = 30;
    const totalWidth = mapIds.length * cardWidth + (mapIds.length - 1) * gap;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height * 0.48;

    mapIds.forEach((mapId, i) => {
      const mapDef = MAP_DEFINITIONS[mapId];
      const cx = startX + i * (cardWidth + gap);
      const cy = cardY;

      const card = this.add.rectangle(cx, cy, cardWidth, cardHeight, 0x1e293b, 1)
        .setStrokeStyle(2, 0x3b82f6, 0.6)
        .setInteractive({ useHandCursor: true });

      this.add.text(cx, cy - 40, mapDef.displayName, {
        color: GAME_COLORS.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(cx, cy + 10, `Map: ${mapDef.id}`, {
        color: GAME_COLORS.mutedText,
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
      }).setOrigin(0.5);

      this.add.text(cx, cy + 40, `${mapDef.waypoints.length - 1} segments`, {
        color: '#94a3b8',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
      }).setOrigin(0.5);

      card.on('pointerover', () => {
        card.setFillStyle(0x334155, 1);
        card.setStrokeStyle(2, 0x7c3aed, 1);
      });
      card.on('pointerout', () => {
        card.setFillStyle(0x1e293b, 1);
        card.setStrokeStyle(2, 0x3b82f6, 0.6);
      });

      card.on('pointerdown', () => {
        this.startGame(mapId);
      });
    });

    // ── Theme / Skin selector ──────────────────────────────────────────────
    this.add
      .text(width / 2, height * 0.72, 'Choose Theme', {
        color: GAME_COLORS.mutedText,
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
      })
      .setOrigin(0.5);

    // Restore previously selected theme
    const savedTheme = this.registry.get('selectedTheme') as string | null;
    if (savedTheme && THEMES.some(t => t.id === savedTheme)) {
      this.selectedThemeId = savedTheme;
    }

    const themeCardW = 150;
    const themeCardH = 70;
    const themeGap = 16;
    const themeRowWidth = THEMES.length * themeCardW + (THEMES.length - 1) * themeGap;
    const themeStartX = (width - themeRowWidth) / 2 + themeCardW / 2;
    const themeY = height * 0.82;

    THEMES.forEach((theme, i) => {
      const cx = themeStartX + i * (themeCardW + themeGap);
      const cy = themeY;

      const isSelected = theme.id === this.selectedThemeId;

      const card = this.add.rectangle(cx, cy, themeCardW, themeCardH, 0x1e293b, 1)
        .setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x7c3aed : 0x334155, isSelected ? 1 : 0.5)
        .setInteractive({ useHandCursor: true });

      // Theme name
      this.add.text(cx, cy - 14, theme.displayName, {
        color: GAME_COLORS.text,
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        fontStyle: isSelected ? 'bold' : 'normal',
      }).setOrigin(0.5);

      // Color swatches: tower colors (3 small circles)
      const towerColors = Object.values(theme.towerColors);
      const enemyColors = Object.values(theme.enemyColors);
      const swatchY = cy + 12;
      const swatchR = 6;

      // Label
      this.add.text(cx - 40, swatchY, '🏰', { fontSize: '10px' }).setOrigin(0.5);
      towerColors.forEach((c, ci) => {
        const sx = cx + (ci - 1) * 14;
        this.add.circle(sx, swatchY, swatchR, c);
      });

      // Enemy swatches
      this.add.text(cx - 40, swatchY + 16, '👾', { fontSize: '10px' }).setOrigin(0.5);
      enemyColors.forEach((c, ci) => {
        const sx = cx + (ci - 1) * 14;
        this.add.circle(sx, swatchY + 16, swatchR, c);
      });

      // Hover
      card.on('pointerover', () => {
        if (theme.id !== this.selectedThemeId) {
          card.setFillStyle(0x334155, 1);
        }
      });
      card.on('pointerout', () => {
        if (theme.id !== this.selectedThemeId) {
          card.setFillStyle(0x1e293b, 1);
        }
      });

      // Click to select
      card.on('pointerdown', () => {
        this.selectedThemeId = theme.id;
        this.registry.set('selectedTheme', theme.id);
        // Redraw theme cards to update highlight
        this.scene.restart();
      });
    });
  }

  private startGame(mapId: string): void {
    this.registry.set('selectedMapId', mapId);
    this.registry.set('store', null);
    this.scene.start(SCENE_KEYS.GAME);
  }
}