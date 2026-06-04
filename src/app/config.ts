import { APP_DIMENSIONS, APP_TITLE, GAME_COLORS, HUD_DEFAULTS } from './constants';

export const GAME_PARENT_ID = 'game-root';

export interface AppConfig {
  title: string;
  dimensions: {
    width: number;
    height: number;
  };
  hudDefaults: {
    gold: number;
    lives: number;
    wave: number;
  };
  backgroundColor: string;
}

export const APP_CONFIG: Readonly<AppConfig> = {
  title: APP_TITLE,
  dimensions: {
    width: APP_DIMENSIONS.width,
    height: APP_DIMENSIONS.height,
  },
  hudDefaults: {
    gold: HUD_DEFAULTS.gold,
    lives: HUD_DEFAULTS.lives,
    wave: HUD_DEFAULTS.wave,
  },
  backgroundColor: GAME_COLORS.background,
};
