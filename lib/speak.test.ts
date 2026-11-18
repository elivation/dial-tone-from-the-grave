import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speak } from './speak';

type FakeUtterance = { text: string; lang: string; pitch: number; rate: number; voice?: unknown };
const voice = (name: string, lang: string) => ({ name, lang });
const config = { pitch: 1, rate: 1, voiceHint: 'female' };
let spoken: FakeUtterance[];

function install(voices: unknown[]) {
  spoken = [];
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = '';
      pitch = 0;
      rate = 0;
      voice: unknown;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    },
  );
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voices,
    cancel: () => {},
    speak: (u: FakeUtterance) => spoken.push(u),
  });
}

beforeEach(() => install([]));
afterEach(() => vi.unstubAllGlobals());

describe('speak', () => {
  it('[Req 14.3] uses an en-ZA voice when the browser has one', () => {
    const za = voice('Thandi', 'en-ZA');
    install([voice('Alice female', 'en-GB'), za]);
    speak('Hello', config, () => {});
    expect(spoken[0]?.voice).toBe(za);
    expect(spoken[0]?.lang).toBe('en-ZA');
  });

  it('[Req 14.3] falls back to the voice hint when there is no en-ZA voice', () => {
    const female = voice('Alice female', 'en-GB');
    install([voice('Daniel male', 'en-GB'), female]);
    speak('Hello', config, () => {});
    expect(spoken[0]?.voice).toBe(female);
  });

  it('[Req 14.3] with no en-ZA voice and no hint match it leaves the browser default voice, still asking for en-ZA', () => {
    install([voice('Daniel male', 'en-GB')]);
    speak('Hello', config, () => {});
    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.voice).toBeUndefined();
    expect(spoken[0]?.lang).toBe('en-ZA');
  });

  it('[Req 14.3] still speaks when the browser reports no voices at all', () => {
    install([]);
    expect(speak('Hello', config, () => {})).toBe(true);
    expect(spoken[0]?.voice).toBeUndefined();
  });
});
