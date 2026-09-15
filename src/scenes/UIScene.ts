import Phaser from 'phaser';

import { GAME_COLORS, SCENE_KEYS } from '../app/constants';
import { GameStateStore } from '../systems/game-state/GameStateStore';
import type { TowerUpgradeSystem } from '../systems/upgrade/TowerUpgradeSystem';
import { TARGETING_LABELS } from '../systems/combat/TargetingSystem';
import { describeWave } from '../systems/waves/waveSummary';
import { campaignSource, endlessSource } from '../systems/waves/waveSource';
import { APP_DIMENSIONS } from '../app/constants';
import { applyCameraScale } from '../app/applyRenderScale';
import { RENDER_SCALE } from '../app/renderScale';

export class UIScene extends Phaser.Scene {
  private goldText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private selectorTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex: number = 0;
  private archetypes: Array<{ key: string; label: string; cost: number }> = [
    { key: 'basic', label: 'Archer [1]  100g', cost: 100 },
    { key: 'fast', label: 'Gunner [2]   75g', cost: 75 },
    { key: 'heavy', label: 'Cannon [3]  175g', cost: 175 },
  ];
  private upgradeTexts: Phaser.GameObjects.Text[] = [];
  private wavePreviewText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.UI);
  }

  create(): void {
    // The canvas is rendered at RENDER_SCALE; this puts the camera back

    // into the fixed 1280x720 world every scene is laid out for.

    applyCameraScale(this, RENDER_SCALE);

    const store = this.registry.get('store') as GameStateStore | null;
    if (!store) return;

    // ── Reset state from any previous launch (scene.stop/launch reuses instance) ──
    this.selectorTexts = [];
    this.upgradeTexts = [];
    this.selectedIndex = 0;
    this.input.keyboard?.removeAllListeners();

    // ── Semi-transparent top bar ───────────────────────────────────────────────
    const panelColor = Phaser.Display.Color.HexStringToColor(
      GAME_COLORS.panel,
    ).color;
    this.add.rectangle(
      APP_DIMENSIONS.width / 2,
      24,
      APP_DIMENSIONS.width,
      48,
      panelColor,
      0.9,
    );

    // ── HUD text objects ───────────────────────────────────────────────────────
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: GAME_COLORS.text,
      fontFamily: 'Arial, sans-serif',
      fontSize: '20px',
    };

    this.goldText = this.add.text(32, 16, `Gold: ${store.gold}`, textStyle);
    this.livesText = this.add.text(220, 16, `Lives: ${store.lives}`, textStyle);
    this.waveText = this.add.text(
      420,
      16,
      `Wave: ${store.wave}/${store.totalWaves}`,
      textStyle,
    );
    this.stateText = this.add.text(
      900,
      16,
      `State: ${store.gameState}`,
      textStyle,
    );

    // ── Tower selector bar ────────────────────────────────────────────────────
    this.archetypes.forEach((arch, i) => {
      const t = this.add
        .text(40 + i * 280, 680, arch.label, {
          color: '#f8fafc',
          fontFamily: 'Arial, sans-serif',
          fontSize: '16px',
          backgroundColor: '#1d4ed8',
          padding: { x: 8, y: 4 },
        })
        .setInteractive();

      t.on('pointerdown', () => {
        const gameScene = this.scene.get(SCENE_KEYS.GAME) as unknown as {
          selectedArchetype: string;
        };
        gameScene.selectedArchetype = arch.key;
        this.selectedIndex = i;
        this.selectorTexts.forEach((st, j) => {
          st.setStyle({ backgroundColor: j === i ? '#7c3aed' : '#1d4ed8' });
        });
      });

      this.selectorTexts.push(t);
    });

    // ── Wave preview ──────────────────────────────────────────────────────────
    // Right-aligned under the top bar, so it never collides with the upgrade
    // panel on the left. Composition comes straight from the wave data.
    this.wavePreviewText = this.add
      .text(APP_DIMENSIONS.width - 16, 60, '', {
        color: '#e2e8f0',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        backgroundColor: '#1e293b',
        padding: { x: 8, y: 6 },
        align: 'right',
      })
      .setOrigin(1, 0);

    // ── Keyboard shortcuts 1 / 2 / 3 ─────────────────────────────────────────
    this.input.keyboard?.on('keydown-ONE', () =>
      this.selectorTexts[0]?.emit('pointerdown'),
    );
    this.input.keyboard?.on('keydown-TWO', () =>
      this.selectorTexts[1]?.emit('pointerdown'),
    );
    this.input.keyboard?.on('keydown-THREE', () =>
      this.selectorTexts[2]?.emit('pointerdown'),
    );
  }

  /**
   * What the wave-preview panel should say right now: the composition of the
   * wave in progress, or of the one the player is about to call in.
   */
  private wavePreview(gameState: string, wave: number): string {
    if (gameState === 'game_over' || gameState === 'victory') return '';

    // Endless generates waves past the authored eight, so the preview has to
    // ask the same source the run does rather than index a fixed table.
    const mode = this.registry.get('mode') as string | null;
    const source = mode === 'endless' ? endlessSource() : campaignSource();
    const definition = source.waveAt(wave - 1);
    if (!definition) return '';

    const composition = describeWave(definition);
    if (!composition) return '';

    const heading =
      gameState === 'wave_active'
        ? `Wave ${wave} incoming`
        : `Next — Wave ${wave}`;
    return `${heading}\n${composition}`;
  }

  update(): void {
    const storeRef = this.registry.get('store') as GameStateStore | null;
    if (!storeRef) return;

    const s = storeRef.snapshot();
    this.goldText.setText(`Gold: ${s.gold}`);
    this.livesText.setText(`Lives: ${s.lives}`);
    // Endless has no denominator to show — "Wave: 12/Infinity" is worse than
    // nothing. It shows the best instead, which is the number that matters.
    const mode = this.registry.get('mode') as string | null;
    if (mode === 'endless') {
      const best = (this.registry.get('bestScore') as number | null) ?? 0;
      this.waveText.setText(
        best > 0 ? `Wave: ${s.wave}   (best ${best})` : `Wave: ${s.wave}`,
      );
    } else {
      this.waveText.setText(`Wave: ${s.wave}/${s.totalWaves}`);
    }
    this.stateText.setText('State: ' + s.gameState);
    this.wavePreviewText.setText(this.wavePreview(s.gameState, s.wave));

    // ── Update selector button affordability ──────────────────────────────────
    const gold = s.gold;
    this.selectorTexts.forEach((t, i) => {
      const arch = this.archetypes[i];
      const canAfford = gold >= arch.cost;
      t.setAlpha(
        i === this.selectedIndex ? (canAfford ? 1 : 0.6) : canAfford ? 1 : 0.4,
      );
    });

    // ── Tower Upgrade Panel ──────────────────────────────────────────────────
    this.upgradeTexts.forEach((t) => t.destroy());
    this.upgradeTexts = [];

    const selectedUid = this.registry.get('selectedTowerUid') as string | null;
    if (selectedUid) {
      const gs = this.scene.get(SCENE_KEYS.GAME) as unknown as {
        store: GameStateStore;
        upgradeSystem: TowerUpgradeSystem;
      };

      const selectedTower = gs.store.towers.find((t) => t.uid === selectedUid);
      if (selectedTower && gs.upgradeSystem) {
        const upgrades = gs.upgradeSystem;
        const def = selectedTower.definition;
        const atMax = upgrades.isMaxLevel(selectedTower);
        const proj = upgrades.getProjectedStats(selectedTower);
        const canAfford = upgrades.canUpgrade(selectedTower, storeRef.gold);

        const panelX = 16;
        const panelY = 80;
        // Targeting is shown on both panels: it is the one thing a maxed
        // tower can still change.
        const targeting = `Target [T]: ${TARGETING_LABELS[selectedTower.targetingMode]}`;
        const infoLines = atMax
          ? [
              `${def.displayName} Lv.${selectedTower.level} — MAX`,
              `DMG: ${def.damage}`,
              `RNG: ${def.range}`,
              `SPD: ${def.fireRate.toFixed(1)}`,
              targeting,
              `Sell value: ${Math.floor(selectedTower.investedGold * 0.5)}g`,
            ]
          : [
              `${def.displayName} Lv.${selectedTower.level}`,
              `DMG: ${def.damage} → ${proj.nextDamage}`,
              `RNG: ${def.range} → ${proj.nextRange}`,
              `SPD: ${def.fireRate.toFixed(1)} → ${proj.nextFireRate.toFixed(1)}`,
              targeting,
              `Upgrade [U]: ${proj.cost}g`,
            ];

        infoLines.forEach((line, i) => {
          const t = this.add.text(panelX, panelY + i * 20, line, {
            color: '#f8fafc',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            backgroundColor: atMax
              ? '#1f3d2b'
              : canAfford
                ? '#1e3a5f'
                : '#3a1a1a',
            padding: { x: 4, y: 2 },
          });
          this.upgradeTexts.push(t);
        });
      }
    }
  }
}
