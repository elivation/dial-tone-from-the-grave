/**
 * Every sound in the game, made with the Web Audio API. No audio files.
 * See design.md "Audio Design".
 */

/** Session storage key for the mute choice. */
export const MUTE_KEY = 'dtftg_muted';

const DIAL_TONE_HZ = 400;
const RING_HZ = [400, 450] as const;
const BUSY_HZ = 400;
const PIP_HZ = 400;

/** How long, in seconds, each looping cadence is scheduled ahead. Calls and busy signals are far shorter. */
const RING_CYCLES = 12;
const BUSY_CYCLES = 60;
/** On and off times in seconds. The ring is a double burst, then a long gap. */
const RING_CADENCE = [
  [0.4, 0.2],
  [0.4, 2],
] as const;
const BUSY_CADENCE = [[0.375, 0.375]] as const;
const PIP_CADENCE = [[0.15, 0.15]] as const;
const PIP_COUNT = 3;

const CLICK_SECONDS = 0.005;
const STATIC_SECONDS = 2;
const STATIC_LEVEL = { low: 0.05, high: 0.4 };

type Cadence = ReadonlyArray<readonly [on: number, off: number]>;
type Playing = { stop: () => void };
type Sound = 'dialTone' | 'ring' | 'busy' | 'static';

export type AudioEngineOptions = {
  /** Makes the audio context. Returns null where Web Audio does not exist. */
  createContext?: () => AudioContext | null;
  /** Where the mute choice is kept for the session. Null if there is none. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
};

function defaultContext(): AudioContext | null {
  return typeof AudioContext === 'undefined' ? null : new AudioContext();
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Some privacy settings make session storage throw on access.
    return null;
  }
}

/**
 * The phone's sound. The audio context is made on first use, starts muted, and wakes on the
 * first pointer or key press. Muting turns the master gain to 0 and leaves the sounds running,
 * so unmuting is instant. Sound ignores prefers-reduced-motion: only the mute toggle controls it.
 */
export class AudioEngine {
  private readonly createContext: () => AudioContext | null;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;
  private readonly playing = new Map<Sound, Playing>();
  private clickBuffer: AudioBuffer | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  constructor({
    createContext = defaultContext,
    storage = defaultStorage(),
  }: AudioEngineOptions = {}) {
    this.createContext = createContext;
    this.storage = storage;
    this.muted = this.readMuted();
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Mutes or unmutes, and remembers the choice for the session. Unmuting is a user action, so it also wakes the audio. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      this.storage?.setItem(MUTE_KEY, String(muted));
    } catch {
      // The choice still holds for this page. It just is not remembered.
    }
    if (!muted) this.ready();
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  /** Wakes the audio on the first pointer press or key press, which browsers need before they allow sound. */
  unlockOnFirstInteraction(target: EventTarget = window): () => void {
    const events = ['pointerdown', 'keydown'];
    const remove = () => events.forEach((e) => target.removeEventListener(e, unlock));
    const unlock = () => {
      remove();
      this.ready();
    };
    events.forEach((e) => target.addEventListener(e, unlock));
    return remove;
  }

  startDialTone(): void {
    this.loop('dialTone', (ctx, out) => {
      const mix = this.gain(ctx, 0.3, out);
      return this.oscillators(ctx, [DIAL_TONE_HZ], mix).stop;
    });
  }
  stopDialTone(): void {
    this.end('dialTone');
  }

  startRingTone(): void {
    this.loop('ring', (ctx, out) => {
      const mix = this.gain(ctx, 0, out);
      const tones = this.oscillators(ctx, RING_HZ, mix);
      this.schedule(mix.gain, 0.25, RING_CADENCE, RING_CYCLES, ctx.currentTime, tones);
      return tones.stop;
    });
  }
  stopRingTone(): void {
    this.end('ring');
  }

  startBusyTone(): void {
    this.loop('busy', (ctx, out) => {
      const mix = this.gain(ctx, 0, out);
      const tones = this.oscillators(ctx, [BUSY_HZ], mix);
      this.schedule(mix.gain, 0.3, BUSY_CADENCE, BUSY_CYCLES, ctx.currentTime, tones);
      return tones.stop;
    });
  }
  stopBusyTone(): void {
    this.end('busy');
  }

  /** Three quick pips, then silence. Plays once and stops itself. */
  playDisconnectedTone(): void {
    const ready = this.ready();
    if (!ready) return;
    const { ctx, out } = ready;
    const mix = this.gain(ctx, 0, out);
    const tones = this.oscillators(ctx, [PIP_HZ], mix);
    this.schedule(mix.gain, 0.3, PIP_CADENCE, PIP_COUNT, ctx.currentTime, tones);
  }

  /** One dial click: a 5 ms burst of noise through a bandpass. Fire one per pulse. */
  click(): void {
    const ready = this.ready();
    if (!ready) return;
    const { ctx, out } = ready;
    this.clickBuffer ??= this.noise(ctx, CLICK_SECONDS);
    const source = ctx.createBufferSource();
    source.buffer = this.clickBuffer;
    const filter = this.bandpass(ctx, 800, 2);
    source.connect(filter);
    filter.connect(this.gain(ctx, 0.5, out));
    source.start();
  }

  /** Crackling static: looping noise whose level wobbles between 0.05 and 0.4 at 7 to 12 Hz. */
  startStatic(): void {
    this.loop('static', (ctx, out) => {
      this.noiseBuffer ??= this.noise(ctx, STATIC_SECONDS);
      const source = ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      const crackle = ctx.createGain();
      const middle = (STATIC_LEVEL.low + STATIC_LEVEL.high) / 2;
      crackle.gain.value = middle;
      source
        .connect(this.bandpass(ctx, 2000, 0.5))
        .connect(crackle)
        .connect(out);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7 + Math.random() * 5;
      const depth = ctx.createGain();
      depth.gain.value = middle - STATIC_LEVEL.low;
      lfo.connect(depth).connect(crackle.gain);
      source.start();
      lfo.start();
      return () => {
        this.safely(() => source.stop());
        this.safely(() => lfo.stop());
      };
    });
  }
  stopStatic(): void {
    this.end('static');
  }

  stopAll(): void {
    for (const sound of [...this.playing.keys()]) this.end(sound);
  }

  private readMuted(): boolean {
    try {
      return this.storage?.getItem(MUTE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  /** The audio context and the master gain, made on first use and woken if it is asleep. Null if there is no Web Audio. */
  private ready(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.context) {
      const ctx = this.createContext();
      if (!ctx) return null;
      this.context = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(ctx.destination);
    }
    if (this.context.state === 'suspended') {
      // Without a user gesture the browser refuses. That is fine: the next gesture wakes it.
      void this.context.resume().catch(() => {});
    }
    return this.master ? { ctx: this.context, out: this.master } : null;
  }

  /** Starts a sound that plays until stopped. A sound already playing is left alone. */
  private loop(name: Sound, start: (ctx: AudioContext, out: GainNode) => () => void): void {
    if (this.playing.has(name)) return;
    const ready = this.ready();
    if (!ready) return;
    this.playing.set(name, { stop: start(ready.ctx, ready.out) });
  }

  private end(name: Sound): void {
    this.playing.get(name)?.stop();
    this.playing.delete(name);
  }

  private gain(ctx: AudioContext, level: number, to: AudioNode): GainNode {
    const node = ctx.createGain();
    node.gain.value = level;
    node.connect(to);
    return node;
  }

  private bandpass(ctx: AudioContext, hz: number, q: number): BiquadFilterNode {
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = hz;
    filter.Q.value = q;
    return filter;
  }

  private oscillators(ctx: AudioContext, hz: readonly number[], to: AudioNode) {
    const nodes = hz.map((frequency) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      osc.connect(to);
      osc.start();
      return osc;
    });
    return {
      nodes,
      stop: () => nodes.forEach((osc) => this.safely(() => osc.stop())),
    };
  }

  /**
   * Switches the gain on and off along the cadence, from `from`, for `cycles` repeats. The tones
   * are told to stop when it ends, so a schedule can never play on for ever.
   */
  private schedule(
    gain: AudioParam,
    level: number,
    cadence: Cadence,
    cycles: number,
    from: number,
    tones: { nodes: OscillatorNode[] },
  ): void {
    gain.setValueAtTime(0, from);
    let t = from;
    for (let i = 0; i < cycles; i++) {
      for (const [on, off] of cadence) {
        gain.setValueAtTime(level, t);
        gain.setValueAtTime(0, t + on);
        t += on + off;
      }
    }
    for (const osc of tones.nodes) osc.stop(t);
  }

  private noise(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Stopping a node that has already ended can throw in some browsers. */
  private safely(action: () => void): void {
    try {
      action();
    } catch {
      // Already stopped.
    }
  }
}

let shared: AudioEngine | null = null;

/** The one engine for the page, made on first use so it never runs on the server. */
export function getAudioEngine(): AudioEngine {
  shared ??= new AudioEngine();
  return shared;
}
