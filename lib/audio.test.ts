import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine, MUTE_KEY } from './audio';

type Call = { value: number; time: number };

class FakeParam {
  value = 0;
  sets: Call[] = [];
  setValueAtTime(value: number, time: number) {
    this.sets.push({ value, time });
    return this;
  }
}

class FakeNode {
  frequency = new FakeParam();
  gain = new FakeParam();
  Q = new FakeParam();
  type = '';
  buffer: { length: number; sampleRate: number } | null = null;
  loop = false;
  started: number | null = null;
  stopped: number | null = null;
  to: Array<FakeNode | FakeParam> = [];
  constructor(readonly kind: 'oscillator' | 'gain' | 'source' | 'filter') {}
  connect<T extends FakeNode | FakeParam>(target: T) {
    this.to.push(target);
    return target;
  }
  disconnect() {}
  start(when = 0) {
    this.started = when;
  }
  stop(when = 0) {
    this.stopped = when;
  }
}

class FakeContext {
  state: 'running' | 'suspended' = 'running';
  currentTime = 10;
  sampleRate = 8000;
  destination = new FakeNode('gain');
  nodes: FakeNode[] = [];
  resume = vi.fn(() => Promise.resolve());
  private make(kind: FakeNode['kind']) {
    const node = new FakeNode(kind);
    this.nodes.push(node);
    return node;
  }
  createOscillator() {
    return this.make('oscillator');
  }
  createGain() {
    return this.make('gain');
  }
  createBiquadFilter() {
    return this.make('filter');
  }
  createBufferSource() {
    return this.make('source');
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return { length, sampleRate, getChannelData: () => new Float32Array(length) };
  }
  of(kind: FakeNode['kind']) {
    return this.nodes.filter((n) => n.kind === kind);
  }
}

class FakeStorage {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

let ctx: FakeContext;
let storage: FakeStorage;
let created: number;

function makeEngine(options: { storage?: FakeStorage | null; noAudio?: boolean } = {}) {
  return new AudioEngine({
    createContext: () => {
      if (options.noAudio) return null;
      created++;
      return ctx as unknown as AudioContext;
    },
    storage: options.storage === undefined ? storage : options.storage,
  });
}

/** The gain the sound passes through before the master gain. */
const masterOf = () => ctx.of('gain')[0] as FakeNode;

beforeEach(() => {
  ctx = new FakeContext();
  storage = new FakeStorage();
  created = 0;
});

describe('AudioEngine mute and set-up', () => {
  it('[Req 8.7] starts muted, and makes no audio context until a sound is needed', () => {
    const engine = makeEngine();
    expect(engine.isMuted()).toBe(true);
    expect(created).toBe(0);
    engine.click();
    expect(created).toBe(1);
    expect(masterOf().gain.value).toBe(0);
  });

  it('[Req 8.7] setMuted(false) lifts the master gain to 1, and setMuted(true) sets it back to 0', () => {
    const engine = makeEngine();
    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);
    expect(masterOf().gain.value).toBe(1);
    engine.setMuted(true);
    expect(masterOf().gain.value).toBe(0);
  });

  it('[Req 8.7] remembers the choice for the session, and reads it back', () => {
    makeEngine().setMuted(false);
    expect(storage.getItem(MUTE_KEY)).toBe('false');
    expect(makeEngine().isMuted()).toBe(false);
    makeEngine().setMuted(true);
    expect(storage.getItem(MUTE_KEY)).toBe('true');
    expect(makeEngine().isMuted()).toBe(true);
  });

  it('[Req 8.7] treats anything but a saved "false" as muted', () => {
    storage.setItem(MUTE_KEY, 'banana');
    expect(makeEngine().isMuted()).toBe(true);
  });

  it('[Req 8.7] still works when session storage is not available', () => {
    const engine = makeEngine({ storage: null });
    expect(engine.isMuted()).toBe(true);
    engine.setMuted(false);
    expect(engine.isMuted()).toBe(false);
  });

  it('[Req 8.7] creates the context and wakes it on the first pointer or key press, once', () => {
    const engine = makeEngine();
    ctx.state = 'suspended';
    const target = new EventTarget();
    engine.unlockOnFirstInteraction(target);
    target.dispatchEvent(new Event('pointerdown'));
    expect(created).toBe(1);
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event('keydown'));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('wakes a suspended context before playing, and carries on if that fails', () => {
    const engine = makeEngine();
    ctx.state = 'suspended';
    ctx.resume.mockImplementation(() => Promise.reject(new Error('needs a gesture')));
    expect(() => engine.startDialTone()).not.toThrow();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('does nothing, without throwing, in a browser with no Web Audio', () => {
    const engine = makeEngine({ noAudio: true });
    expect(() => {
      engine.startDialTone();
      engine.startRingTone();
      engine.startBusyTone();
      engine.playDisconnectedTone();
      engine.startStatic();
      engine.click();
      engine.stopAll();
      engine.setMuted(false);
    }).not.toThrow();
  });

  it('[Req 8.8] ignores prefers-reduced-motion: sound is only the mute toggle', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', matchMedia);
    const engine = makeEngine();
    engine.setMuted(false);
    engine.click();
    expect(matchMedia).not.toHaveBeenCalled();
    expect(ctx.of('source')).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});

describe('AudioEngine sounds', () => {
  it('[Req 8.3] dial tone is a 400 Hz sine, and stops when told to', () => {
    const engine = makeEngine();
    engine.startDialTone();
    const [tone] = ctx.of('oscillator') as [FakeNode];
    expect(tone.type).toBe('sine');
    expect(tone.frequency.value).toBe(400);
    expect(tone.started).not.toBeNull();
    engine.stopDialTone();
    expect(tone.stopped).not.toBeNull();
  });

  it('starting a sound that is already playing does not stack a second one', () => {
    const engine = makeEngine();
    engine.startDialTone();
    engine.startDialTone();
    expect(ctx.of('oscillator')).toHaveLength(1);
  });

  it('[Req 8.4] ring tone mixes 400 and 450 Hz, 400 ms on, 200 off, 400 on, 2 s off', () => {
    makeEngine().startRingTone();
    const oscillators = ctx.of('oscillator');
    expect(oscillators.map((o) => o.frequency.value).sort()).toEqual([400, 450]);
    const mixer = ctx.of('gain').find((g) => g.gain.sets.length > 0) as FakeNode;
    const first = mixer.gain.sets
      .slice(0, 5)
      .map((s) => [s.value > 0 ? 1 : 0, +(s.time - 10).toFixed(3)]);
    expect(first).toEqual([
      [0, 0],
      [1, 0],
      [0, 0.4],
      [1, 0.6],
      [0, 1],
    ]);
    // The next ring starts after the 2 second gap.
    const next = mixer.gain.sets[5] as Call;
    expect(+(next.time - 10).toFixed(3)).toBe(3);
  });

  it('[Req 8.6] busy tone is 400 Hz, 375 ms on and 375 ms off', () => {
    makeEngine().startBusyTone();
    const [tone] = ctx.of('oscillator') as [FakeNode];
    expect(tone.frequency.value).toBe(400);
    const mixer = ctx.of('gain').find((g) => g.gain.sets.length > 0) as FakeNode;
    const times = mixer.gain.sets.slice(0, 5).map((s) => +(s.time - 10).toFixed(3));
    expect(times).toEqual([0, 0, 0.375, 0.75, 0.75 + 0.375]);
  });

  it('[Req 8.5] disconnected tone is three 400 Hz pips, 150 ms on and 150 ms off, then silence', () => {
    makeEngine().playDisconnectedTone();
    const [tone] = ctx.of('oscillator') as [FakeNode];
    expect(tone.frequency.value).toBe(400);
    const mixer = ctx.of('gain').find((g) => g.gain.sets.length > 0) as FakeNode;
    const ons = mixer.gain.sets.filter((s) => s.value > 0).map((s) => +(s.time - 10).toFixed(3));
    expect(ons).toEqual([0, 0.3, 0.6]);
    expect(tone.stopped).toBeCloseTo(10.9, 6);
  });

  it('[Req 8.2] a dial click is a 5 ms burst of noise through a 800 Hz, Q 2 bandpass at gain 0.5', () => {
    makeEngine().click();
    const [source] = ctx.of('source') as [FakeNode];
    expect(source.started).not.toBeNull();
    expect(source.loop).toBe(false);
    expect(source.buffer?.length).toBe(Math.ceil(8000 * 0.005));
    const [filter] = ctx.of('filter') as [FakeNode];
    expect(filter.type).toBe('bandpass');
    expect(filter.frequency.value).toBe(800);
    expect(filter.Q.value).toBe(2);
    const click = ctx.of('gain').find((g) => g.gain.value === 0.5);
    expect(click).toBeDefined();
    expect(source.to).toContain(filter);
    expect(filter.to).toContain(click);
  });

  it('[Req 8.5] static is looping noise through a 2000 Hz, Q 0.5 bandpass, crackled by a 7 to 12 Hz LFO', () => {
    const engine = makeEngine();
    engine.startStatic();
    const [source] = ctx.of('source') as [FakeNode];
    expect(source.loop).toBe(true);
    const [filter] = ctx.of('filter') as [FakeNode];
    expect(filter.frequency.value).toBe(2000);
    expect(filter.Q.value).toBe(0.5);
    const [lfo] = ctx.of('oscillator') as [FakeNode];
    expect(lfo.frequency.value).toBeGreaterThanOrEqual(7);
    expect(lfo.frequency.value).toBeLessThanOrEqual(12);
    // The LFO drives the gain through its own depth gain, and swings the level between 0.05 and 0.4.
    const depth = lfo.to[0] as FakeNode;
    const crackle = ctx.of('gain').find((g) => g.gain === depth.to[0]) as FakeNode;
    expect(crackle).toBeDefined();
    const low = crackle.gain.value - depth.gain.value;
    const high = crackle.gain.value + depth.gain.value;
    expect(low).toBeCloseTo(0.05, 6);
    expect(high).toBeCloseTo(0.4, 6);
    engine.stopStatic();
    expect(source.stopped).not.toBeNull();
    expect(lfo.stopped).not.toBeNull();
  });

  it('every sound goes through the master gain, so muting silences all of them', () => {
    const engine = makeEngine();
    engine.startDialTone();
    engine.click();
    engine.startStatic();
    const master = masterOf();
    const reachesMaster = (node: FakeNode, seen = new Set<FakeNode>()): boolean => {
      if (node === master) return true;
      if (seen.has(node)) return false;
      seen.add(node);
      return node.to.some((n) => n instanceof FakeNode && reachesMaster(n, seen));
    };
    for (const node of [...ctx.of('oscillator'), ...ctx.of('source')]) {
      // A crackle LFO only drives a gain. It makes no sound itself.
      if (node.frequency.value > 0 && node.frequency.value < 20) continue;
      expect(reachesMaster(node), `${node.kind} is routed through the master gain`).toBe(true);
    }
  });

  it('stopAll silences every sound that is playing', () => {
    const engine = makeEngine();
    engine.startDialTone();
    engine.startRingTone();
    engine.startBusyTone();
    engine.startStatic();
    engine.stopAll();
    for (const node of [...ctx.of('oscillator'), ...ctx.of('source')]) {
      expect(node.stopped, `${node.kind} stopped`).not.toBeNull();
    }
  });
});
