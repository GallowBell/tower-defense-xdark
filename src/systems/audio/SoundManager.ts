/**
 * Programmatic sound manager using the Web Audio API.
 * Generates synth sounds on-the-fly — no audio files needed.
 */
export class SoundManager {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = true;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(val: boolean) {
    this._enabled = val;
  }

  /** Toggle on/off. Returns new state. */
  toggle(): boolean {
    this._enabled = !this._enabled;
    return this._enabled;
  }

  private ensureContext(): AudioContext | null {
    if (!this._enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.1,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Web Audio not available — silently ignore
    }
  }

  // ── Game sounds ───────────────────────────────────────────────────────────

  /** Tower fires a shot */
  playShoot(): void {
    this.playTone(800, 0.04, 'square', 0.04);
  }

  /** Enemy dies */
  playEnemyDeath(): void {
    this.playTone(250, 0.08, 'sine', 0.06);
  }

  /** New wave starts */
  playWaveStart(): void {
    this.playTone(440, 0.12, 'sine', 0.06);
    setTimeout(() => this.playTone(660, 0.12, 'sine', 0.06), 120);
  }

  /** Tower upgraded */
  playUpgrade(): void {
    this.playTone(523, 0.08, 'sine', 0.06);
    setTimeout(() => this.playTone(659, 0.08, 'sine', 0.06), 70);
    setTimeout(() => this.playTone(784, 0.12, 'sine', 0.06), 140);
  }

  /** Tower sold */
  playSell(): void {
    this.playTone(600, 0.06, 'triangle', 0.05);
    setTimeout(() => this.playTone(800, 0.06, 'triangle', 0.05), 60);
  }

  /** UI button click */
  playUIClick(): void {
    this.playTone(1000, 0.025, 'square', 0.025);
  }

  /** Game over */
  playGameOver(): void {
    this.playTone(400, 0.3, 'sawtooth', 0.05);
    setTimeout(() => this.playTone(300, 0.3, 'sawtooth', 0.05), 300);
    setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.05), 600);
  }

  /** Victory! */
  playVictory(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.2, 'sine', 0.06), i * 120);
    });
  }

  /** Wave cleared */
  playWaveCleared(): void {
    this.playTone(660, 0.1, 'sine', 0.05);
    setTimeout(() => this.playTone(880, 0.15, 'sine', 0.05), 100);
  }

  /** Gold earned */
  playGoldEarned(): void {
    this.playTone(1200, 0.04, 'sine', 0.04);
  }
}