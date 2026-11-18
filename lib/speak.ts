import type { VoiceConfig } from './operators';
import { pickVoice } from './voice';

/**
 * Reads the text aloud in the given voice. Returns false when there is no speech to wait for,
 * and then `onDone` is never called, so the caller must carry on itself.
 */
export function speak(text: string, config: VoiceConfig | undefined, onDone: () => void): boolean {
  const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  if (!synth || !config || typeof SpeechSynthesisUtterance === 'undefined') return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-ZA';
  utterance.pitch = config.pitch;
  utterance.rate = config.rate;
  const voice = pickVoice(synth.getVoices(), config.voiceHint);
  if (voice) utterance.voice = voice;
  utterance.onend = onDone;
  utterance.onerror = onDone;
  try {
    synth.cancel();
    synth.speak(utterance);
  } catch {
    // Some browsers throw when no voice engine is installed. The text is already on screen.
    return false;
  }
  return true;
}

/** Stops whatever is being said. Safe where there is no speech. */
export function stopSpeaking(): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // Nothing to stop.
  }
}
