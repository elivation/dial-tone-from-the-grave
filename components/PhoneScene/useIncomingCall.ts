'use client';
import { useEffect, useRef, useState } from 'react';
import { getAudioEngine, type AudioEngine } from '@/lib/audio';
import type { CallEvent, CallState } from '@/lib/callMachine';
import {
  INCOMING_HANGUP_DELAY_MS,
  INCOMING_MESSAGES,
  INCOMING_SPEECH_LIMIT_MS,
  INCOMING_VOICE,
  RING_IN_TIMEOUT_MS,
  incomingReadingMs,
  pickWaitMs,
  readRingInConfig,
  type RingInConfig,
} from '@/lib/incoming';
import { speak, stopSpeaking } from '@/lib/speak';

/** Session storage key for how many times the phone has rung by itself in this tab. */
export const INCOMING_COUNT_KEY = 'dtftg_incoming_count';
/** When the book is still dialling at the moment the phone would ring, try again after this long. */
const RETRY_MS = 5000;

/** The sound the incoming ring needs. The real AudioEngine fits, and tests pass a fake. */
export type IncomingAudio = Pick<AudioEngine, 'startRingTone' | 'stopRingTone' | 'isMuted'>;

// NEXT_PUBLIC variables are replaced at build time, so each one has to be named in full here.
const ENV_CONFIG = readRingInConfig({
  enabled: process.env.NEXT_PUBLIC_RING_IN_ENABLED,
  minS: process.env.NEXT_PUBLIC_RING_IN_MIN_S,
  maxS: process.env.NEXT_PUBLIC_RING_IN_MAX_S,
  maxPerSession: process.env.NEXT_PUBLIC_RING_IN_MAX_PER_SESSION,
});

function readCount(): number {
  try {
    const count = Number(window.sessionStorage.getItem(INCOMING_COUNT_KEY));
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    // Storage can be blocked. The phone then rings on the usual wait, with no cap to remember.
    return 0;
  }
}

function writeCount(count: number): void {
  try {
    window.sessionStorage.setItem(INCOMING_COUNT_KEY, String(count));
  } catch {
    // The cap still holds for this page load only.
  }
}

/**
 * Makes the phone ring by itself. After the first pointer or key press it waits a random time
 * while the phone is idle, then rings. Picking up plays one fixed line, spoken and shown, and the
 * call then ends on its own. Leaving a state clears its timers, so any other change starts the
 * wait again. Nothing here talks to the server.
 */
export function useIncomingCall({
  state,
  send,
  offline,
  dialPending,
  audio: audioOverride,
  config = ENV_CONFIG,
  random = Math.random,
}: {
  state: CallState;
  send: (event: CallEvent) => void;
  /** While true the phone never rings, because the line is dead. */
  offline: boolean;
  /** True while the phone book is about to dial a number, so a ring cannot cut in. */
  dialPending: () => boolean;
  audio?: IncomingAudio;
  config?: RingInConfig;
  random?: () => number;
}): void {
  const [interacted, setInteracted] = useState(false);
  const [audio] = useState<IncomingAudio>(() => audioOverride ?? getAudioEngine());
  const latest = useRef({ send, dialPending, random });
  useEffect(() => {
    latest.current = { send, dialPending, random };
  });
  const { enabled, minS, maxS, maxPerSession } = config;

  useEffect(() => {
    if (!enabled || interacted) return;
    const events = ['pointerdown', 'keydown'];
    const heard = () => setInteracted(true);
    events.forEach((name) => window.addEventListener(name, heard, { once: true }));
    return () => events.forEach((name) => window.removeEventListener(name, heard));
  }, [enabled, interacted]);

  const mayRing = enabled && interacted && !offline && state.status === 'idle';
  useEffect(() => {
    if (!mayRing || readCount() >= maxPerSession) return;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      if (latest.current.dialPending()) {
        timer = setTimeout(attempt, RETRY_MS);
        return;
      }
      writeCount(readCount() + 1);
      const messageIndex = Math.floor(latest.current.random() * INCOMING_MESSAGES.length);
      latest.current.send({ type: 'INCOMING_RING', messageIndex });
    };
    timer = setTimeout(attempt, pickWaitMs(minS, maxS, latest.current.random()));
    return () => clearTimeout(timer);
  }, [mayRing, minS, maxS, maxPerSession]);

  const ringing = state.status === 'ringing-in';
  useEffect(() => {
    if (!ringing) return;
    // Muting turns the engine's master gain to 0, so a muted phone rings on screen only.
    audio.startRingTone();
    const timer = setTimeout(
      () => latest.current.send({ type: 'RING_TIMEOUT' }),
      RING_IN_TIMEOUT_MS,
    );
    return () => {
      clearTimeout(timer);
      audio.stopRingTone();
    };
  }, [ringing, audio]);

  const messageIndex = state.status === 'incoming-message' ? state.messageIndex : null;
  useEffect(() => {
    if (messageIndex === null) return;
    const text = INCOMING_MESSAGES[messageIndex] ?? '';
    let live = true;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const hangUpIn = (ms: number) =>
      timers.push(setTimeout(() => latest.current.send({ type: 'MESSAGE_DONE' }), ms));
    const heard = () => {
      if (!live) return;
      timers.forEach(clearTimeout);
      hangUpIn(INCOMING_HANGUP_DELAY_MS);
    };
    if (!audio.isMuted() && speak(text, INCOMING_VOICE, heard)) {
      hangUpIn(INCOMING_SPEECH_LIMIT_MS);
    } else {
      hangUpIn(incomingReadingMs(text));
    }
    return () => {
      live = false;
      timers.forEach(clearTimeout);
      stopSpeaking();
    };
  }, [messageIndex, audio]);
}
