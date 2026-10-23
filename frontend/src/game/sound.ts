import type { FloorStyle } from './art';

/**
 * Tiny synthesized sound bank: zero audio assets, pure Web Audio.
 * The context is created lazily and resumed on first user gesture
 * (autoplay policies); the mute preference persists in localStorage.
 */

const STORAGE_KEY = 'sherlock-sound';
const VOLUME_STORAGE_KEY = 'sherlock-volume';

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
  private output: GainNode | null = null;
  private currentVolume = 1;
  private rainRequested = false;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  constructor() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
      const storedVolume = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (storedVolume?.trim()) {
        const parsedVolume = Number(storedVolume);
        if (Number.isFinite(parsedVolume)) {
          this.currentVolume = Math.max(0, Math.min(1, parsedVolume));
        }
      }
    } catch {
      this.enabled = true;
    }
  }

  get volume(): number {
    return this.currentVolume;
  }

  setVolume(volume: number): boolean {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    this.updateOutputGain();
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, String(this.currentVolume));
      return true;
    } catch {
      return false;
    }
  }

  setEnabled(on: boolean): boolean {
    this.enabled = on;
    this.updateOutputGain();
    if (on) this.startRain();
    else this.stopRain();
    try {
      localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a user gesture so the context is allowed to start. */
  unlock(): void {
    this.ensure();
    this.startRain();
  }

  /** Toggle the soft outdoor rain bed as the player enters/leaves marsh. */
  setRain(active: boolean): void {
    this.rainRequested = active;
    if (active) this.startRain();
    else this.stopRain();
  }

  private startRain(): void {
    const ctx = this.ensure();
    if (!ctx || !this.enabled || !this.rainRequested || this.rainSource) return;
    try {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1050;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.setTargetAtTime(0.018, ctx.currentTime, 0.35);
      source.connect(filter).connect(gain).connect(this.output ?? ctx.destination);
      this.rainSource = source;
      this.rainGain = gain;
      source.onended = () => {
        if (this.rainSource !== source) return;
        this.rainSource = null;
        this.rainGain = null;
        if (this.rainRequested && this.enabled) this.startRain();
      };
      source.start();
    } catch {
      /* Ambient audio must never interrupt investigation. */
    }
  }

  private stopRain(): void {
    const source = this.rainSource;
    const gain = this.rainGain;
    if (!source || !gain) return;
    try {
      const now = this.ctx?.currentTime ?? 0;
      gain.gain.setTargetAtTime(0.0001, now, 0.035);
      source.stop(now + 0.22);
    } catch {
      /* The source may already have ended while a room transition arrived. */
    }
  }

  private ensure(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) this.ctx = audioContext();
    if (this.ctx && !this.output) {
      this.output = this.ctx.createGain();
      this.output.gain.value = this.currentVolume;
      this.output.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  private updateOutputGain(): void {
    if (this.output && this.ctx) {
      this.output.gain.setTargetAtTime(
        this.enabled ? this.currentVolume : 0,
        this.ctx.currentTime,
        0.015,
      );
    }
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
      osc.connect(amp).connect(this.output ?? ctx.destination);
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

  /** A distinct note for each forensic calibration tile. */
  labTile(tile: number): void {
    const notes = [262, 294, 330, 349, 392, 440, 494, 523, 587];
    const note = notes[tile] ?? notes[0];
    this.tone(note, note, 0.12, 'sine', 0.045);
  }

  /** Low, brief feedback when a calibration tile is incorrect. */
  labMistake(): void {
    this.tone(190, 115, 0.14, 'triangle', 0.035);
  }

  /** Short ascending cue when forensic calibration is complete. */
  labComplete(): void {
    this.tone(523, 523, 0.1, 'triangle', 0.06);
    this.tone(659, 659, 0.1, 'triangle', 0.06, 0.1);
    this.tone(784, 784, 0.16, 'triangle', 0.07, 0.2);
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

  /**
   * Room entry motif: a soft two-note figure whose base note is hashed
   * from the room id, so each room gets its own faint tonal color.
   */
  enterRoom(roomId: string): void {
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) hash = (hash * 31 + roomId.charCodeAt(i)) >>> 0;
    const scale = [196, 220, 247, 262, 294, 330, 349];
    const base = scale[hash % scale.length];
    this.tone(base, base, 0.18, 'sine', 0.05);
    this.tone(base * 1.5, base * 1.5, 0.24, 'sine', 0.04, 0.16);
  }

  /** Quiet, short footfalls with a different timbre for each floor. */
  footstep(surface: FloorStyle): void {
    if (surface === 'carpet') {
      this.tone(105, 68, 0.055, 'sine', 0.018);
    } else if (surface === 'wood') {
      this.tone(185, 92, 0.065, 'triangle', 0.028);
      this.tone(310, 170, 0.035, 'sine', 0.008, 0.008);
    } else if (surface === 'grass') {
      this.tone(132, 78, 0.07, 'sine', 0.02);
    } else if (surface === 'marsh') {
      this.tone(115, 58, 0.085, 'sine', 0.022);
      this.tone(420, 240, 0.035, 'triangle', 0.007, 0.012);
    } else {
      this.tone(155, 70, 0.055, 'triangle', 0.028);
      this.tone(390, 210, 0.03, 'sine', 0.008, 0.006);
    }
  }

  /** NPC ambient bark murmur — deliberately quieter than dialogue talk. */
  murmur(): void {
    this.tone(392, 330, 0.08, 'sine', 0.05);
  }

  /** A quiet metal rattle when a locked door refuses entry. */
  doorLocked(): void {
    this.tone(170, 105, 0.08, 'triangle', 0.04);
    this.tone(390, 310, 0.045, 'sine', 0.02, 0.015);
  }

  /** A brief brass click when discovered evidence opens a door. */
  doorUnlocked(): void {
    this.tone(520, 760, 0.1, 'triangle', 0.055);
    this.tone(920, 650, 0.08, 'sine', 0.025, 0.055);
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
