import { THEMES, type ThemeDefinition } from '../../data/skins/themes';

/**
 * Manages visual skin theming for the game.
 * Reads the active theme from the Phaser registry and provides
 * color lookups for towers and enemies.
 */
export class SkinManager {
  private currentThemeId: string;

  constructor(themeId?: string) {
    this.currentThemeId = themeId ?? 'default';
  }

  getCurrentTheme(): ThemeDefinition {
    return THEMES.find(t => t.id === this.currentThemeId) ?? THEMES[0];
  }

  setTheme(themeId: string): void {
    this.currentThemeId = themeId;
  }

  getTowerColors(): { basic: number; fast: number; heavy: number } {
    return this.getCurrentTheme().towerColors;
  }

  getEnemyColors(): { basic: number; fast: number; tank: number } {
    return this.getCurrentTheme().enemyColors;
  }

  getHudAccent(): string {
    return this.getCurrentTheme().hudAccent;
  }

  /** Resolve tower color: skin color if available, else default. */
  resolveTowerColor(archetype: string, defaultColor: number): number {
    const colors = this.getTowerColors() as Record<string, number>;
    return colors[archetype] ?? defaultColor;
  }

  /** Resolve enemy color: skin color if available, else default. */
  resolveEnemyColor(archetype: string, defaultColor: number): number {
    const colors = this.getEnemyColors() as Record<string, number>;
    return colors[archetype] ?? defaultColor;
  }

  static getAvailableThemes(): ThemeDefinition[] {
    return THEMES;
  }
}