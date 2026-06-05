import Phaser from 'phaser';

import { GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { GameStateStore } from '../systems/game-state/GameStateStore';

export class UIScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.UI);
  }

  create(): void {
    const store = this.registry.get('store') as GameStateStore | null;
    if (!store) return;

    // ── Semi-transparent top bar ───────────────────────────────────────────────
    const panelColor = Phaser.Display.Color.HexStringToColor(GAME_COLORS.panel).color;
    this.add.rectangle(this.cameras.main.width / 2, 24, this.cameras.main.width, 48, panelColor, 0.9);

    // ── HUD text objects ───────────────────────────────────────────────────────
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: GAME_COLORS.text,
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    };

    this.goldText = this.add.text(32, 16, `Gold: ${store.gold}`, textStyle);
    this.livesText = this.add.text(220, 16, `Lives: ${store.lives}`, textStyle);
    this.waveText = this.add.text(420, 16, `Wave: ${store.wave}/${store.totalWaves}`, textStyle);
    this.stateText = this.add.text(900, 16, `State: ${store.gameState}`, textStyle);
  }

  update(): void {
    const storeRef = this.registry.get('store') as GameStateStore | null;
    if (!storeRef) return;

    const s = storeRef.snapshot();
    this.goldText.setText(`Gold: ${s.gold}`);
    this.livesText.setText(`Lives: ${s.lives}`);
    this.waveText.setText(`Wave: ${s.wave}/${s.totalWaves}`);
    this.stateText.setText('State: ' + s.gameState);
  }
}
