export const APP_TITLE = 'tower-defense-xdark';

export const SCENE_KEYS = {
  BOOT: 'boot',
  PRELOAD: 'preload',
  MENU: 'menu',
  GAME: 'game',
  UI: 'ui',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

export const SCENE_FLOW = [
  SCENE_KEYS.BOOT,
  SCENE_KEYS.PRELOAD,
  SCENE_KEYS.MENU,
  SCENE_KEYS.GAME,
  SCENE_KEYS.UI,
] as const satisfies readonly SceneKey[];

export const APP_DIMENSIONS = {
  width: 1280,
  height: 720,
} as const;

export const HUD_DEFAULTS = {
  gold: 200,
  lives: 20,
  wave: 1,
} as const;

export const GAME_COLORS = {
  background: '#10141f',
  panel: '#181f2e',
  accent: '#7c3aed',
  text: '#f8fafc',
  mutedText: '#cbd5e1',
  battlefield: 0x0f172a,
  buildZone: 0x1d4ed8,
  path: 0xf59e0b,
} as const;

export const UI_COPY = {
  menuPrompt: 'Click or press SPACE to deploy.',
  gameplayHint: 'Milestone 0 shell: gameplay systems land next.',
} as const;
