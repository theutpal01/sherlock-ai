/**
 * Tiny synthesized sound bank: zero audio assets, pure Web Audio.
 * The context is created lazily and resumed on first user gesture
 * (autoplay policies); the mute preference persists in localStorage.
 */

const STORAGE_KEY = 'sherlock-sound';

function audioContext(): AudioContext | null {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

class SoundBank {
  enabled: boolean;
  private ctx: AudioContext | null = null;

  constructor() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      this.enabled = true;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }

  /** Call from a user gesture so the context is allowed to start. */
  unlock(): void {
    this.ensure();
  }

  private ensure(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) this.ctx = audioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.ensure();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch {
      /* audio is decoration — never break the game */
    }
  }

  /** Evidence examined. */
  blip(): void {
    this.tone(660, 880, 0.09, 'sine', 0.12);
  }

  /** Dialogue opened. */
  talk(): void {
    this.tone(520, 520, 0.07, 'triangle', 0.1);
    this.tone(640, 640, 0.07, 'triangle', 0.1, 0.09);
  }

  /** Room change whoosh. */
  sweep(): void {
    this.tone(280, 1100, 0.22, 'sawtooth', 0.04);
  }

  /** Case verdict sting. */
  sting(win: boolean): void {
    if (win) {
      this.tone(523, 523, 0.12, 'triangle', 0.12);
      this.tone(659, 659, 0.12, 'triangle', 0.12, 0.12);
      this.tone(784, 784, 0.22, 'triangle', 0.14, 0.24);
    } else {
      this.tone(220, 110, 0.35, 'sawtooth', 0.07);
    }
  }
}

export const sound = new SoundBank();
