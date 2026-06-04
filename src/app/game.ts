import Phaser from 'phaser';

import { APP_CONFIG, GAME_PARENT_ID } from './config';
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

export const GAME_SCENES = SCENE_FLOW.map((sceneKey) => SCENE_REGISTRY[sceneKey]);

export const createGameConfig = (): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent: GAME_PARENT_ID,
  width: APP_CONFIG.dimensions.width,
  height: APP_CONFIG.dimensions.height,
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

export const createGame = (): Phaser.Game => new Phaser.Game(createGameConfig());
