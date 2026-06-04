import { describe, expect, it } from 'vitest';

import { APP_CONFIG, GAME_PARENT_ID } from '../../src/app/config';
import { APP_TITLE, SCENE_FLOW, SCENE_KEYS } from '../../src/app/constants';

describe('app bootstrap exports', () => {
  it('exposes a stable application shell configuration', () => {
    expect(APP_TITLE).toBe('tower-defense-xdark');
    expect(GAME_PARENT_ID).toBe('game-root');
    expect(APP_CONFIG.dimensions.width).toBeGreaterThan(0);
    expect(APP_CONFIG.dimensions.height).toBeGreaterThan(0);
    expect(APP_CONFIG.hudDefaults.gold).toBeGreaterThan(0);
    expect(APP_CONFIG.hudDefaults.lives).toBeGreaterThan(0);
  });

  it('declares a deterministic scene order', () => {
    expect([...SCENE_FLOW]).toEqual([
      SCENE_KEYS.BOOT,
      SCENE_KEYS.PRELOAD,
      SCENE_KEYS.MENU,
      SCENE_KEYS.GAME,
      SCENE_KEYS.UI,
    ]);
    expect(new Set(SCENE_FLOW).size).toBe(SCENE_FLOW.length);
  });
});
