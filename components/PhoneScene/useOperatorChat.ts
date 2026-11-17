'use client';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { TranscriptEntry } from '@/components/OperatorPanel';
import { OPERATORS } from '@/lib/operators';
import { createSseParser, type Listing } from '@/lib/sse';

/** The spirit line speaks first and answers without Claude, so the page opens the request itself. */
const SPIRIT_LINE = '1313';

export const OPERATOR_DOWN_MESSAGE = 'The operator is unreachable. Please try again later.';
export const TOO_LONG_MESSAGE = "I couldn't quite catch that. Say it shorter.";

type HistoryTurn = { role: 'user' | 'assistant'; content: string };

type ChatState = {
  entries: TranscriptEntry[];
  streaming: boolean;
  results: Listing[];
  bookOpen: boolean;
  /** The reply on screen is the operator's last word, so the call should now end. */
  closing: boolean;
};

type ChatAction =
  | { type: 'connect' }
  | { type: 'hangUp' }
  | { type: 'start' }
  | { type: 'sent'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'fail'; message: string }
  | { type: 'finish'; closing?: boolean }
  | { type: 'results'; results: Listing[] }
  | { type: 'closeBook' };

const initialChat: ChatState = {
  entries: [],
  streaming: false,
  results: [],
  bookOpen: false,
  closing: false,
};

const OPEN_REPLY: TranscriptEntry = { speaker: 'operator', text: '' };

function appendToReply(entries: TranscriptEntry[], text: string): TranscriptEntry[] {
  const last = entries[entries.length - 1];
  if (last?.speaker !== 'operator') return [...entries, { speaker: 'operator', text }];
  return [...entries.slice(0, -1), { speaker: 'operator', text: last.text + text }];
}

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'connect':
      return initialChat;
    // The book outlives the call. The next connect or closeBook() takes it away.
    case 'hangUp':
      return { ...initialChat, results: state.results, bookOpen: state.bookOpen };
    case 'start':
      return { ...state, entries: [...state.entries, OPEN_REPLY], streaming: true };
    case 'sent':
      return {
        ...state,
        entries: [...state.entries, { speaker: 'caller', text: action.text }, OPEN_REPLY],
        streaming: true,
      };
    case 'delta':
      return { ...state, entries: appendToReply(state.entries, action.text) };
    case 'fail': {
      const last = state.entries[state.entries.length - 1];
      const spoken = last?.speaker === 'operator' && last.text !== '';
      return {
        ...state,
        entries: appendToReply(state.entries, spoken ? ` ${action.message}` : action.message),
        streaming: false,
      };
    }
    case 'finish':
      return { ...state, streaming: false, closing: action.closing ?? false };
    case 'results':
      return { ...state, results: action.results, bookOpen: true };
    case 'closeBook':
      return { ...state, bookOpen: false };
  }
}

export type OperatorChatOptions = {
  /** The operator on the line, or null when there is no call. Changing it ends the previous call. */
  operatorNumber: string | null;
  /** User turns already sent in this call. */
  turnIndex: number;
  /** The server's turn cap. The user turn at index `maxTurns - 1` gets the goodbye. */
  maxTurns: number;
  onTurnSent: () => void;
  onRateLimited: () => void;
};

export type OperatorChat = {
  transcript: readonly TranscriptEntry[];
  streaming: boolean;
  results: readonly Listing[];
  /** True once a search has come back. The phone book renders from this and `results`. */
  bookOpen: boolean;
  /** True once the operator's last words are on screen. The call ends after they are heard. */
  closing: boolean;
  send: (text: string) => void;
  closeBook: () => void;
};

async function failureMessage(response: Response): Promise<string> {
  if (response.status !== 400) return OPERATOR_DOWN_MESSAGE;
  const body: unknown = await response.json().catch(() => null);
  const code =
    typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : null;
  return code === 'input_too_long' ? TOO_LONG_MESSAGE : OPERATOR_DOWN_MESSAGE;
}

/**
 * Talks to `/api/operator` for the call in progress and reads the reply as it streams. One
 * request is live at a time. Ending the call, or leaving the page, aborts it.
 */
export function useOperatorChat(options: OperatorChatOptions): OperatorChat {
  const { operatorNumber } = options;
  const [state, dispatch] = useReducer(chatReducer, initialChat);
  const latest = useRef(options);
  const controllerRef = useRef<AbortController | null>(null);
  const history = useRef<HistoryTurn[]>([]);

  useEffect(() => {
    latest.current = options;
  });

  const run = useCallback(async (number: string, message: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    dispatch(message === '' ? { type: 'start' } : { type: 'sent', text: message });

    const sentTurn = latest.current.turnIndex;
    const lastTurn = number === SPIRIT_LINE || sentTurn >= latest.current.maxTurns - 1;
    let reply = '';
    let completed = false;
    try {
      const response = await fetch('/api/operator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          number,
          message,
          history: history.current,
          turnIndex: latest.current.turnIndex,
        }),
        signal,
      });
      if (response.status === 429) {
        dispatch({ type: 'finish' });
        latest.current.onRateLimited();
        return;
      }
      if (!response.ok || !response.body) {
        dispatch({ type: 'fail', message: await failureMessage(response) });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of parser.push(decoder.decode(value, { stream: true }))) {
            if (signal.aborted) return;
            if (event.type === 'delta') {
              reply += event.text;
              dispatch({ type: 'delta', text: event.text });
            } else if (event.type === 'tool_result') {
              dispatch({ type: 'results', results: event.results });
            } else if (event.type === 'done') {
              completed = true;
            } else if (event.type === 'error') {
              if (event.code === 'turn_cap') {
                dispatch({ type: 'finish', closing: true });
              } else if (event.code === 'rate_limited') {
                dispatch({ type: 'finish' });
                latest.current.onRateLimited();
              } else {
                dispatch({
                  type: 'fail',
                  message:
                    event.code === 'input_too_long' ? TOO_LONG_MESSAGE : OPERATOR_DOWN_MESSAGE,
                });
              }
              return;
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
    } catch {
      if (!signal.aborted) dispatch({ type: 'fail', message: OPERATOR_DOWN_MESSAGE });
      return;
    }

    if (signal.aborted) return;
    if (completed && message !== '') {
      history.current = [
        ...history.current,
        { role: 'user', content: message },
        { role: 'assistant', content: reply },
      ];
    }
    dispatch(
      completed
        ? { type: 'finish', closing: lastTurn }
        : { type: 'fail', message: OPERATOR_DOWN_MESSAGE },
    );
  }, []);

  useEffect(() => {
    if (operatorNumber === null) return;
    dispatch({ type: 'connect' });
    // Deferred so React strict mode, which mounts, cleans up and mounts again, sends one request.
    const timer =
      operatorNumber === SPIRIT_LINE
        ? setTimeout(() => void run(operatorNumber, ''), 0)
        : undefined;
    return () => {
      clearTimeout(timer);
      controllerRef.current?.abort();
      controllerRef.current = null;
      history.current = [];
      dispatch({ type: 'hangUp' });
    };
  }, [operatorNumber, run]);

  const send = useCallback(
    (text: string) => {
      const number = latest.current.operatorNumber;
      if (number === null) return;
      latest.current.onTurnSent();
      void run(number, text);
    },
    [run],
  );

  const closeBook = useCallback(() => dispatch({ type: 'closeBook' }), []);

  const greeting = operatorNumber === null ? undefined : OPERATORS[operatorNumber]?.greeting;
  const transcript = useMemo<readonly TranscriptEntry[]>(
    () =>
      greeting && operatorNumber !== SPIRIT_LINE
        ? [{ speaker: 'operator', text: greeting }, ...state.entries]
        : state.entries,
    [greeting, operatorNumber, state.entries],
  );

  return {
    transcript,
    streaming: state.streaming,
    results: state.results,
    bookOpen: state.bookOpen,
    closing: state.closing,
    send,
    closeBook,
  };
}
