'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { OPERATORS } from '@/lib/operators';
import { getAudioEngine } from '@/lib/audio';
import { pickVoice } from '@/lib/voice';
import type { MuteControl } from '@/components/MuteToggle/MuteToggle';
import { findRecognition, type Recognition, type RecognitionConstructor } from './speech';

export type TranscriptEntry = { speaker: 'operator' | 'caller'; text: string };

export type OperatorPanelProps = {
  operatorNumber: string;
  onMessage: (text: string) => void;
  onHangUp: () => void;
  /** User turns sent so far in this call. */
  turnIndex: number;
  maxTurns: number;
  transcript: readonly TranscriptEntry[];
  /** True while the operator reply is still arriving. The reply is read aloud when this turns false. */
  streaming: boolean;
  audio?: MuteControl;
};

const BUTTON =
  'pointer-events-auto rounded border border-amber-200/40 bg-black/70 px-4 py-1 font-serif text-sm tracking-widest text-amber-200/90 hover:bg-amber-200/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:opacity-50';

function speak(text: string, operatorNumber: string) {
  const synth = typeof window === 'undefined' ? undefined : window.speechSynthesis;
  const config = OPERATORS[operatorNumber]?.voiceConfig;
  if (!synth || !config || typeof SpeechSynthesisUtterance === 'undefined') return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-ZA';
  utterance.pitch = config.pitch;
  utterance.rate = config.rate;
  const voice = pickVoice(synth.getVoices(), config.voiceHint);
  if (voice) utterance.voice = voice;
  synth.cancel();
  synth.speak(utterance);
}

/** The call in progress: what the operator says, and a way to answer by voice or by typing. */
export function OperatorPanel({
  operatorNumber,
  onMessage,
  onHangUp,
  turnIndex,
  maxTurns,
  transcript,
  streaming,
  audio,
}: OperatorPanelProps) {
  const operator = OPERATORS[operatorNumber];
  const [text, setText] = useState('');
  const [Recogniser, setRecogniser] = useState<RecognitionConstructor | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceFailed, setVoiceFailed] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const wasStreaming = useRef(streaming);
  const latest = useRef({ transcript, operatorNumber, audio });

  useEffect(() => {
    latest.current = { transcript, operatorNumber, audio };
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
    const { transcript: entries, operatorNumber: number, audio: control } = latest.current;
    const reply = entries[entries.length - 1];
    if (reply?.speaker !== 'operator' || !reply.text) return;
    if ((control ?? getAudioEngine()).isMuted()) return;
    speak(reply.text, number);
  }, [streaming]);

  useEffect(
    () => () => {
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
        <h2 className="text-lg tracking-wide text-amber-200">{operator?.name ?? 'Operator'}</h2>
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
