import { describe, it, expect } from 'vitest';

import { summarizeWave, describeWave } from '../../src/systems/waves/waveSummary';
import { WAVE_DEFINITIONS } from '../../src/systems/waves/waveDefinitions';
import type { WaveDefinition } from '../../src/systems/waves/waveDefinitions';

function wave(entries: WaveDefinition['entries']): WaveDefinition {
  return { index: 0, entries, goldBonus: 0 };
}

describe('summarizeWave', () => {
  it('counts a single group', () => {
    const result = summarizeWave(wave([{ archetype: 'basic', count: 8, interval: 1 }]));

    expect(result).toEqual([{ archetype: 'basic', displayName: 'Grunt', count: 8 }]);
  });

  it('keeps archetypes in the order they first appear', () => {
    const result = summarizeWave(
      wave([
        { archetype: 'fast', count: 4, interval: 1 },
        { archetype: 'basic', count: 6, interval: 1 },
      ]),
    );

    expect(result.map(e => e.archetype)).toEqual(['fast', 'basic']);
  });

  it('merges repeated archetypes into one row', () => {
    // A trickle then a rush is a spawn detail, not two kinds of enemy.
    const result = summarizeWave(
      wave([
        { archetype: 'basic', count: 3, interval: 2 },
        { archetype: 'fast', count: 4, interval: 1 },
        { archetype: 'basic', count: 5, interval: 0.5 },
      ]),
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ archetype: 'basic', displayName: 'Grunt', count: 8 });
  });

  it('handles an empty wave', () => {
    expect(summarizeWave(wave([]))).toEqual([]);
  });
});

describe('describeWave', () => {
  it('renders one line per wave', () => {
    expect(describeWave(WAVE_DEFINITIONS[7])).toBe('10x Grunt, 8x Runner, 4x Brute');
  });

  it('renders a single-archetype wave without separators', () => {
    expect(describeWave(WAVE_DEFINITIONS[0])).toBe('8x Grunt');
  });

  it('returns an empty string past the last wave', () => {
    expect(describeWave(undefined)).toBe('');
    expect(describeWave(WAVE_DEFINITIONS[99])).toBe('');
  });

  it('describes every shipped wave without blowing up', () => {
    for (const w of WAVE_DEFINITIONS) {
      expect(describeWave(w).length).toBeGreaterThan(0);
    }
  });
});
