import Phaser from 'phaser';

import { GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { GameStateStore } from '../systems/game-state/GameStateStore';

export class UIScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private selectorTexts: Phaser.GameObjects.Text[] = [];

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

    // ── Tower selector bar ────────────────────────────────────────────────────
    const archetypes: Array<{ key: string; label: string }> = [
      { key: 'basic', label: 'Archer [1]  100g' },
      { key: 'fast',  label: 'Gunner [2]   75g' },
      { key: 'heavy', label: 'Cannon [3]  175g' },
    ];

    archetypes.forEach((arch, i) => {
      const t = this.add.text(40 + i * 280, 680, arch.label, {
        color: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        backgroundColor: '#1d4ed8',
        padding: { x: 8, y: 4 },
      }).setInteractive();

      t.on('pointerdown', () => {
        const gameScene = this.scene.get(SCENE_KEYS.GAME) as unknown as { selectedArchetype: string };
        gameScene.selectedArchetype = arch.key;
        // Highlight selected, deselect others
        this.selectorTexts.forEach((st, j) => {
          st.setStyle({ backgroundColor: j === i ? '#7c3aed' : '#1d4ed8' });
        });
      });

      this.selectorTexts.push(t);
    });

    // ── Keyboard shortcuts 1 / 2 / 3 ─────────────────────────────────────────
    this.input.keyboard?.on('keydown-ONE',   () => this.selectorTexts[0]?.emit('pointerdown'));
    this.input.keyboard?.on('keydown-TWO',   () => this.selectorTexts[1]?.emit('pointerdown'));
    this.input.keyboard?.on('keydown-THREE', () => this.selectorTexts[2]?.emit('pointerdown'));
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
