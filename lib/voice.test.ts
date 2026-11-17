import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { pickVoice } from './voice';

const voice = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;

describe('pickVoice', () => {
  it('[Req 14.3] prefers an en-ZA voice', () => {
    const za = voice('Zander', 'en-ZA');
    expect(pickVoice([voice('Alice female', 'en-GB'), za], 'female')).toBe(za);
  });

  it('[Req 14.3] among en-ZA voices, prefers the one matching the hint', () => {
    const female = voice('Thandi female', 'en_ZA');
    expect(pickVoice([voice('Zander', 'en-ZA'), female], 'female')).toBe(female);
  });

  it('[Req 14.3] falls back to the voice hint when there is no en-ZA voice', () => {
    const male = voice('Daniel male', 'en-GB');
    expect(pickVoice([voice('Alice female', 'en-GB'), male], 'male')).toBe(male);
  });

  it('[Req 14.3] returns null when nothing matches', () => {
    expect(pickVoice([voice('Alice', 'en-GB')], 'male')).toBeNull();
    expect(pickVoice([], 'male')).toBeNull();
  });

  it('[Req 14.3] any en-ZA voice present means an en-ZA voice is chosen', () => {
    const lang = fc.constantFrom('en-GB', 'en-US', 'en-ZA', 'af-ZA');
    const voices = fc.array(fc.record({ name: fc.string(), lang }), { maxLength: 8 });
    fc.assert(
      fc.property(voices, fc.constantFrom('male', 'female'), (list, hint) => {
        const picked = pickVoice(list as SpeechSynthesisVoice[], hint);
        if (list.some((v) => v.lang === 'en-ZA')) expect(picked?.lang).toBe('en-ZA');
      }),
    );
  });
});
