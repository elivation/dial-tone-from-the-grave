const SOUTH_AFRICAN = /^en[-_]za$/i;

/**
 * Picks the voice for an operator reply. A South African English voice wins when the browser has
 * one. Otherwise the operator's voice hint is matched against voice names. Null means "let the
 * browser use its default", and the caller still sets the language and pitch.
 */
export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  voiceHint: string,
): SpeechSynthesisVoice | null {
  // Whole words only, because "female" contains "male".
  const hintWord = new RegExp(`\\b${voiceHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  const named = (voice: SpeechSynthesisVoice) => hintWord.test(voice.name);
  const southAfrican = voices.filter((voice) => SOUTH_AFRICAN.test(voice.lang));
  if (southAfrican.length > 0) return southAfrican.find(named) ?? southAfrican[0] ?? null;
  return voices.find(named) ?? null;
}
