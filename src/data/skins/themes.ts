/**
 * Theme definitions for tower defense visual skins.
 * Each theme defines colors for towers, enemies, and UI accents.
 */

export interface ThemeDefinition {
  id: string;
  displayName: string;
  description: string;
  towerColors: { basic: number; fast: number; heavy: number };
  enemyColors: { basic: number; fast: number; tank: number };
  hudAccent: string;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    displayName: 'Classic',
    description: 'The original look',
    towerColors: { basic: 0x3b82f6, fast: 0x22c55e, heavy: 0xeab308 },
    enemyColors: { basic: 0xef4444, fast: 0xf97316, tank: 0x7c3aed },
    hudAccent: '#7c3aed',
  },
  {
    id: 'blaze',
    displayName: '🔥 Blaze',
    description: 'Fire and fury',
    towerColors: { basic: 0xef4444, fast: 0xf97316, heavy: 0xfbbf24 },
    enemyColors: { basic: 0xdc2626, fast: 0xea580c, tank: 0x991b1b },
    hudAccent: '#ef4444',
  },
  {
    id: 'frost',
    displayName: '❄️ Frost',
    description: 'Winter is coming',
    towerColors: { basic: 0x38bdf8, fast: 0x7dd3fc, heavy: 0x0ea5e9 },
    enemyColors: { basic: 0x94a3b8, fast: 0xcbd5e1, tank: 0x475569 },
    hudAccent: '#38bdf8',
  },
  {
    id: 'verdant',
    displayName: '🌿 Verdant',
    description: "Nature's embrace",
    towerColors: { basic: 0x22c55e, fast: 0x4ade80, heavy: 0x16a34a },
    enemyColors: { basic: 0x854d0e, fast: 0xa16207, tank: 0x713f12 },
    hudAccent: '#22c55e',
  },
  {
    id: 'void',
    displayName: '🌌 Void',
    description: 'Darkness manifests',
    towerColors: { basic: 0x8b5cf6, fast: 0xa78bfa, heavy: 0x7c3aed },
    enemyColors: { basic: 0xd946ef, fast: 0xe879f9, tank: 0x86198f },
    hudAccent: '#8b5cf6',
  },
  {
    id: 'royal',
    displayName: '👑 Royal',
    description: 'Fit for a king',
    towerColors: { basic: 0xfbbf24, fast: 0xfef3c7, heavy: 0xf59e0b },
    enemyColors: { basic: 0x881337, fast: 0xbe123c, tank: 0x4c0519 },
    hudAccent: '#fbbf24',
  },
];