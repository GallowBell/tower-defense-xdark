import Phaser from 'phaser';

import { APP_CONFIG, GAME_PARENT_ID } from './config';
import { RENDER_SCALE, canvasSizeFor } from './renderScale';
import { SCENE_FLOW, type SceneKey } from './constants';
import { BootScene } from '../scenes/BootScene';
import { GameScene } from '../scenes/GameScene';
import { MenuScene } from '../scenes/MenuScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { UIScene } from '../scenes/UIScene';

const SCENE_REGISTRY: Record<SceneKey, Phaser.Types.Scenes.SceneType> = {
  boot: BootScene,
  preload: PreloadScene,
  menu: MenuScene,
  game: GameScene,
  ui: UIScene,
};

export const GAME_SCENES = SCENE_FLOW.map(
  (sceneKey) => SCENE_REGISTRY[sceneKey],
);

export const createGameConfig = (): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent: GAME_PARENT_ID,
  // The canvas is sized in *render* pixels, not world pixels: every scene's
  // camera is zoomed by the same factor so gameplay still runs in the fixed
  // 1280x720 world. See renderScale.ts for why this is the only lever Phaser
  // leaves for a sharp canvas.
  ...canvasSizeFor(RENDER_SCALE),
  backgroundColor: APP_CONFIG.backgroundColor,
  scene: [...GAME_SCENES],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
  },
});

export const createGame = (): Phaser.Game =>
  new Phaser.Game(createGameConfig());
