'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Callee } from '@/lib/callMachine';
import { LISTING_VOICE } from '@/lib/listingGhost';
import { OPERATORS, type VoiceConfig } from '@/lib/operators';
import { getAudioEngine } from '@/lib/audio';
import { pickVoice } from '@/lib/voice';
import type { MuteControl } from '@/components/MuteToggle/MuteToggle';
import { findRecognition, type Recognition, type RecognitionConstructor } from './speech';

/** How long the line stays up after the goodbye has been heard. */
export const GOODBYE_DELAY_MS = 2000;

export type TranscriptEntry = { speaker: 'operator' | 'caller'; text: string };

export type OperatorPanelProps = {
  operatorNumber: string;
  /** A listing ghost has its own voice and no operator entry. Defaults to an operator. */
  callee?: Callee;
  onMessage: (text: string) => void;
  onHangUp: () => void;
  /** User turns sent so far in this call. */
  turnIndex: number;
  maxTurns: number;
  transcript: readonly TranscriptEntry[];
  /** True while the operator reply is still arriving. The reply is read aloud when this turns false. */
  streaming: boolean;
  /** The reply on screen is the operator's last word. */
  closing?: boolean;
  /** Called GOODBYE_DELAY_MS after a closing reply has been spoken, or shown if there is no speech. */
  onClosed?: () => void;
  audio?: MuteControl;
};

const BUTTON =
  'pointer-events-auto rounded border border-amber-200/40 bg-black/70 px-4 py-1 font-serif text-sm tracking-widest text-amber-200/90 hover:bg-amber-200/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:opacity-50';

/** Reads the text aloud. Returns false when there is no speech to wait for. */
function speak(text: string, config: VoiceConfig | undefined, onDone: () => void): boolean {
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

/** The call in progress: what the operator says, and a way to answer by voice or by typing. */
export function OperatorPanel({
  operatorNumber,
  callee = 'operator',
  onMessage,
  onHangUp,
  turnIndex,
  maxTurns,
  transcript,
  streaming,
  closing = false,
  onClosed,
  audio,
}: OperatorPanelProps) {
  const operator = callee === 'operator' ? OPERATORS[operatorNumber] : undefined;
  const voiceConfig = callee === 'listing' ? LISTING_VOICE : operator?.voiceConfig;
  const [text, setText] = useState('');
  const [Recogniser, setRecogniser] = useState<RecognitionConstructor | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceFailed, setVoiceFailed] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const wasStreaming = useRef(streaming);
  const replyId = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ transcript, voiceConfig, audio, closing, onClosed });

  useEffect(() => {
    latest.current = { transcript, voiceConfig, audio, closing, onClosed };
  });

  // Detected after mount so the server and first client render agree.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser feature detection has to wait for mount
    setRecogniser(() => findRecognition(window));
  }, []);

  useEffect(() => {
    const finished = wasStreaming.current && !streaming;
    wasStreaming.current = streaming;
    if (!finished) return;
    const { transcript: entries, voiceConfig: voice, audio: control } = latest.current;
    // The goodbye is heard, or if nothing is spoken, read, before the line goes dead.
    // Cancelling an earlier utterance fires its end event, which must not start the countdown.
    const id = ++replyId.current;
    const heard = () => {
      if (id !== replyId.current || !latest.current.closing) return;
      closeTimer.current = setTimeout(() => latest.current.onClosed?.(), GOODBYE_DELAY_MS);
    };
    const reply = entries[entries.length - 1];
    if (reply?.speaker !== 'operator' || !reply.text) return heard();
    if ((control ?? getAudioEngine()).isMuted()) return heard();
    if (!speak(reply.text, voice, heard)) heard();
  }, [streaming]);

  useEffect(
    () => () => {
      replyId.current++;
      clearTimeout(closeTimer.current);
      recognition.current?.stop();
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    },
    [],
  );

  const turnsLeft = Math.max(0, maxTurns - turnIndex);
  const canSend = text.trim().length > 0 && !streaming && turnsLeft > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    onMessage(text.trim());
    setText('');
  };

  const toggleListening = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    if (!Recogniser) return;
    const next = new Recogniser();
    next.lang = 'en-ZA';
    next.interimResults = false;
    next.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript;
      if (heard) setText(heard);
    };
    next.onerror = () => {
      setVoiceFailed(true);
      setListening(false);
    };
    next.onend = () => setListening(false);
    recognition.current = next;
    setVoiceFailed(false);
    setListening(true);
    next.start();
  };

  return (
    <section
      aria-label="Telephone call"
      className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded border border-amber-200/30 bg-black/75 p-3 font-serif text-amber-100"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg tracking-wide text-amber-200">
          {callee === 'listing' ? 'A ghost on the line' : (operator?.name ?? 'Operator')}
        </h2>
        <p className="text-sm text-amber-200/70">Turns left: {turnsLeft}</p>
      </header>
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        tabIndex={0}
        className="max-h-48 min-h-16 overflow-y-auto rounded bg-black/40 p-2 focus-visible:outline-2 focus-visible:outline-amber-200"
      >
        {transcript.map((entry, index) => (
          <p
            key={index}
            className={entry.speaker === 'operator' ? 'mb-1' : 'mb-1 text-amber-200/70'}
          >
            <span className="text-sm text-amber-200/60">
              {entry.speaker === 'operator' ? 'Operator: ' : 'You: '}
            </span>
            {entry.text}
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <label htmlFor="operator-message" className="sr-only">
          Your message
        </label>
        <input
          id="operator-message"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={300}
          autoComplete="off"
          className="min-w-0 flex-1 rounded border border-amber-200/40 bg-black/60 px-2 py-1 text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-200"
        />
        {Recogniser && (
          <button
            type="button"
            onClick={toggleListening}
            aria-pressed={listening}
            className={BUTTON}
          >
            {listening ? 'Stop listening' : 'Speak'}
          </button>
        )}
        <button type="submit" disabled={!canSend} className={BUTTON}>
          Send
        </button>
        <button type="button" onClick={onHangUp} className={BUTTON}>
          Hang up
        </button>
      </form>
      {voiceFailed && (
        <p role="status" className="text-sm text-amber-200/80">
          The line could not hear you. Type your message instead.
        </p>
      )}
    </section>
  );
}
