import type { GameState } from '../../types/game';
import type { TowerState } from '../../types/tower';
import { BALANCE } from '../../data/balance';

export interface StoreSnapshot {
  gold: number;
  lives: number;
  wave: number;
  totalWaves: number;
  gameState: GameState;
  towers: TowerState[];
}

export class GameStateStore {
  gold: number = BALANCE.startingGold;
  lives: number = BALANCE.startingLives;
  wave: number = 1;
  totalWaves: number = BALANCE.totalWaves;
  gameState: GameState = 'idle';
  towers: TowerState[] = [];

  spendGold(amount: number): void {
    this.gold = Math.max(0, this.gold - amount);
  }

  earnGold(amount: number): void {
    this.gold += amount;
  }

  loseLife(): void {
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives === 0) this.gameState = 'game_over';
  }

  addTower(tower: TowerState): void {
    this.towers.push(tower);
  }

  removeTower(uid: string): void {
    this.towers = this.towers.filter(t => t.uid !== uid);
  }

  nextWave(): void {
    if (this.gameState === 'wave_cleared' || this.gameState === 'idle') {
      this.gameState = 'wave_active';
    }
  }

  onWaveCleared(): void {
    if (this.wave < this.totalWaves) {
      this.wave += 1;
      this.gameState = 'wave_cleared';
    } else {
      this.gameState = 'victory';
    }
  }

  snapshot(): StoreSnapshot {
    return {
      gold: this.gold,
      lives: this.lives,
      wave: this.wave,
      totalWaves: this.totalWaves,
      gameState: this.gameState,
      towers: [...this.towers],
    };
  }
}
