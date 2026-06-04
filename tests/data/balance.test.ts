import { describe, expect, it } from 'vitest';

import { BALANCE } from '../../src/data/balance';

describe('BALANCE constants', () => {
  it('startingGold is positive', () => {
    expect(BALANCE.startingGold).toBeGreaterThan(0);
  });

  it('startingLives is positive', () => {
    expect(BALANCE.startingLives).toBeGreaterThan(0);
  });

  it('totalWaves equals 8', () => {
    expect(BALANCE.totalWaves).toBe(8);
  });

  it('tileSize is positive', () => {
    expect(BALANCE.tileSize).toBeGreaterThan(0);
  });

  it('gridCols and gridRows are both positive', () => {
    expect(BALANCE.gridCols).toBeGreaterThan(0);
    expect(BALANCE.gridRows).toBeGreaterThan(0);
  });
});
