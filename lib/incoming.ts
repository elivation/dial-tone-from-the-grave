import type { VoiceConfig } from './operators';

/** Invented lines for the phone that rings by itself. No Claude call is made for them. */
export const INCOMING_MESSAGES: readonly string[] = [
  'Is this The Dead Pages? I have been holding since 1974.',
  "Don't hang up. Something in the walls is dialling your number.",
  'Edenvale exchange, final call. The geyser is still hot, and nobody has lived there since 1981.',
  'Load shedding ends at midnight. The switchboard never did.',
  'I am ringing for the lady who used to live in your house. She left a message in the wires.',
  'Braamfontein, third floor. We are still waiting for the lift.',
  'I dialled a number that was disconnected years ago. Funny, you picked up.',
  'The robot at the corner has been stuck on red since 1989. Nobody minds.',
  'This is a courtesy call from the night shift. All the lines are quiet, and we like it that way.',
  'Is that the Hillbrow switchboard? Tell them the tea is cold and the candles are low.',
  'Somebody left the book open at your page. Just so you know.',
  'Please hold. Your call is important to the dead, and they have time.',
];

/** A low, slow voice, so the message sounds like it came down a long cable. */
export const INCOMING_VOICE: VoiceConfig = { pitch: 0.6, rate: 0.8, voiceHint: 'male' };

/** Nobody picking up within this long ends the ringing (Req 12.3). */
export const RING_IN_TIMEOUT_MS = 20_000;
/** The line stays up this long after a spoken message, so the last words land. */
export const INCOMING_HANGUP_DELAY_MS = 2000;
/** A speech engine that never reports the end of a line must not hold the phone for ever. */
export const INCOMING_SPEECH_LIMIT_MS = 30_000;
const READ_MIN_MS = 4000;
const READ_MS_PER_CHAR = 80;

/** How long to show a message that is not read aloud, before the line goes dead. */
export function incomingReadingMs(text: string): number {
  return Math.max(READ_MIN_MS, text.length * READ_MS_PER_CHAR);
}

export type RingInConfig = {
  enabled: boolean;
  minS: number;
  maxS: number;
  maxPerSession: number;
};

export const RING_IN_DEFAULTS: RingInConfig = {
  enabled: true,
  minS: 45,
  maxS: 120,
  maxPerSession: 2,
};

const wholeNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined || !/^\d+$/.test(value.trim())) return fallback;
  return Number(value.trim());
};

/**
 * Reads the NEXT_PUBLIC_RING_IN_* settings. Only the exact word "false" turns the feature off.
 * Anything unreadable falls back to the default, and the longest wait never falls below the shortest.
 */
export function readRingInConfig(env: {
  enabled?: string;
  minS?: string;
  maxS?: string;
  maxPerSession?: string;
}): RingInConfig {
  const minS = Math.max(1, wholeNumber(env.minS, RING_IN_DEFAULTS.minS));
  return {
    enabled: env.enabled?.trim().toLowerCase() !== 'false',
    minS,
    maxS: Math.max(minS, wholeNumber(env.maxS, RING_IN_DEFAULTS.maxS)),
    maxPerSession: wholeNumber(env.maxPerSession, RING_IN_DEFAULTS.maxPerSession),
  };
}

/** A wait between the shortest and longest, in milliseconds. `random` is a value from 0 up to 1. */
export function pickWaitMs(minS: number, maxS: number, random: number): number {
  return Math.round((minS + random * (maxS - minS)) * 1000);
}
