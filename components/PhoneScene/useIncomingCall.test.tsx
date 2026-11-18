import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducer } from 'react';
import { callReducer, initialCallState } from '@/lib/callMachine';
import {
  INCOMING_HANGUP_DELAY_MS,
  INCOMING_MESSAGES,
  INCOMING_SPEECH_LIMIT_MS,
  INCOMING_VOICE,
  RING_IN_TIMEOUT_MS,
  incomingReadingMs,
  type RingInConfig,
} from '@/lib/incoming';
import { INCOMING_COUNT_KEY, useIncomingCall } from './useIncomingCall';

const speakMock = vi.hoisted(() => vi.fn());
const stopSpeakingMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/speak', () => ({ speak: speakMock, stopSpeaking: stopSpeakingMock }));

const config: RingInConfig = { enabled: true, minS: 10, maxS: 10, maxPerSession: 2 };
const WAIT_MS = 10_000;

const makeAudio = (muted = false) => ({
  startRingTone: vi.fn(),
  stopRingTone: vi.fn(),
  isMuted: vi.fn(() => muted),
});
let audio: ReturnType<typeof makeAudio>;

type Options = { offline?: boolean; dialPending?: boolean; config?: RingInConfig };
/** The real reducer with the hook on top, so the tests follow the phone through its states. */
function setup(options: Options = {}) {
  return renderHook(
    (props: Options) => {
      const [state, send] = useReducer(callReducer, initialCallState);
      useIncomingCall({
        state,
        send,
        offline: props.offline ?? false,
        dialPending: () => props.dialPending ?? false,
        audio,
        config: props.config ?? config,
        random: () => 0,
      });
      return { state, send };
    },
    { initialProps: options },
  );
}
type Hook = ReturnType<typeof setup>;
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const interact = () => act(() => void window.dispatchEvent(new Event('pointerdown')));
const status = (hook: Hook) => hook.result.current.state.status;
const ringIn = () => {
  interact();
  wait(WAIT_MS);
};

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  audio = makeAudio();
  speakMock.mockReset().mockReturnValue(true);
  stopSpeakingMock.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('useIncomingCall scheduling', () => {
  it('[Req 12.1] never rings before the first interaction', () => {
    const hook = setup();
    wait(WAIT_MS * 5);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.1] rings with the normal ring tone once the wait is over', () => {
    const hook = setup();
    interact();
    wait(WAIT_MS - 1);
    expect(status(hook)).toBe('idle');
    wait(1);
    expect(status(hook)).toBe('ringing-in');
    expect(audio.startRingTone).toHaveBeenCalledTimes(1);
  });

  it('[Req 12.1] a key press counts as the first interaction', () => {
    const hook = setup();
    act(() => void window.dispatchEvent(new Event('keydown')));
    wait(WAIT_MS);
    expect(status(hook)).toBe('ringing-in');
  });

  it('[Req 12.4] does not ring while the phone is off the hook, dialling or on a call', () => {
    const hook = setup();
    interact();
    act(() => hook.result.current.send({ type: 'PICK_UP' }));
    wait(WAIT_MS * 3);
    expect(status(hook)).toBe('off-hook');
    act(() => hook.result.current.send({ type: 'DIGIT_DIALLED', digit: '1' }));
    wait(WAIT_MS * 3);
    expect(status(hook)).toBe('dialling');
  });

  it('[Req 12.4] waits afresh after a call ends instead of ringing straight away', () => {
    const hook = setup();
    interact();
    wait(WAIT_MS - 1000);
    act(() => hook.result.current.send({ type: 'PICK_UP' }));
    act(() => hook.result.current.send({ type: 'HANG_UP' }));
    wait(WAIT_MS - 1);
    expect(status(hook)).toBe('idle');
    wait(1);
    expect(status(hook)).toBe('ringing-in');
  });

  it('[Req 12.4] does not ring while the phone book is dialling a number for the caller', () => {
    const hook = setup({ dialPending: true });
    ringIn();
    wait(WAIT_MS * 3);
    expect(status(hook)).toBe('idle');
    hook.rerender({ dialPending: false });
    wait(WAIT_MS * 2);
    expect(status(hook)).toBe('ringing-in');
  });

  it('[Req 12.4] does not ring while offline', () => {
    const hook = setup({ offline: true });
    ringIn();
    wait(WAIT_MS * 3);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.7] stays quiet when switched off', () => {
    const hook = setup({ config: { ...config, enabled: false } });
    ringIn();
    wait(WAIT_MS * 3);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.1] rings at most the session cap, counted in session storage', () => {
    const hook = setup();
    ringIn();
    expect(sessionStorage.getItem(INCOMING_COUNT_KEY)).toBe('1');
    wait(RING_IN_TIMEOUT_MS);
    wait(WAIT_MS);
    expect(status(hook)).toBe('ringing-in');
    expect(sessionStorage.getItem(INCOMING_COUNT_KEY)).toBe('2');
    wait(RING_IN_TIMEOUT_MS);
    wait(WAIT_MS * 5);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.1] a reload in the same tab does not reset the cap', () => {
    sessionStorage.setItem(INCOMING_COUNT_KEY, '2');
    const hook = setup();
    ringIn();
    wait(WAIT_MS * 3);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.1] still rings when session storage is unavailable', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const hook = setup();
    ringIn();
    expect(status(hook)).toBe('ringing-in');
    getItem.mockRestore();
  });
});

describe('useIncomingCall ringing', () => {
  it('[Req 12.3] stops ringing after 20 seconds with no message', () => {
    const hook = setup();
    ringIn();
    wait(RING_IN_TIMEOUT_MS - 1);
    expect(status(hook)).toBe('ringing-in');
    wait(1);
    expect(status(hook)).toBe('idle');
    expect(audio.stopRingTone).toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
  });

  it('[Req 12.5] asks for the ring tone even when muted, and the engine keeps it silent', () => {
    audio = makeAudio(true);
    const hook = setup();
    ringIn();
    expect(status(hook)).toBe('ringing-in');
    expect(audio.startRingTone).toHaveBeenCalled();
  });
});

describe('useIncomingCall message', () => {
  const pickUp = (hook: Hook) => act(() => hook.result.current.send({ type: 'PICK_UP' }));
  const shown = (hook: Hook) => {
    const state = hook.result.current.state;
    return state.status === 'incoming-message' ? INCOMING_MESSAGES[state.messageIndex] : undefined;
  };

  it('[Req 12.2] picking up stops the ring and speaks one of the fixed lines in the ghost voice', () => {
    const hook = setup();
    ringIn();
    pickUp(hook);
    expect(status(hook)).toBe('incoming-message');
    expect(audio.stopRingTone).toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith(shown(hook), INCOMING_VOICE, expect.any(Function));
    expect(INCOMING_MESSAGES).toContain(shown(hook));
  });

  it('[Req 12.2] hangs up by itself a moment after the line has been spoken', () => {
    const hook = setup();
    ringIn();
    pickUp(hook);
    const onDone = speakMock.mock.calls[0]?.[2] as () => void;
    wait(INCOMING_SPEECH_LIMIT_MS - 1);
    expect(status(hook)).toBe('incoming-message');
    act(() => onDone());
    wait(INCOMING_HANGUP_DELAY_MS - 1);
    expect(status(hook)).toBe('incoming-message');
    wait(1);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.5] when muted the line is only shown, then the call ends after reading time', () => {
    audio = makeAudio(true);
    const hook = setup();
    ringIn();
    pickUp(hook);
    const text = shown(hook) ?? '';
    expect(speakMock).not.toHaveBeenCalled();
    wait(incomingReadingMs(text) - 1);
    expect(status(hook)).toBe('incoming-message');
    wait(1);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.2] a voice that never finishes cannot hold the line for ever', () => {
    const hook = setup();
    ringIn();
    pickUp(hook);
    wait(INCOMING_SPEECH_LIMIT_MS);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.2] when speech is unavailable the line is only shown, then the call ends', () => {
    speakMock.mockReturnValue(false);
    const hook = setup();
    ringIn();
    pickUp(hook);
    const text = shown(hook) ?? '';
    wait(incomingReadingMs(text));
    expect(status(hook)).toBe('idle');
  });

  it('[Req 12.2] hanging up mid message stops the voice and nothing fires later', () => {
    const hook = setup();
    ringIn();
    pickUp(hook);
    const onDone = speakMock.mock.calls[0]?.[2] as () => void;
    act(() => hook.result.current.send({ type: 'HANG_UP' }));
    expect(stopSpeakingMock).toHaveBeenCalled();
    act(() => onDone());
    act(() => hook.result.current.send({ type: 'PICK_UP' }));
    wait(INCOMING_HANGUP_DELAY_MS * 3);
    expect(status(hook)).toBe('off-hook');
  });

  it('[Req 12.2] makes no network request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const hook = setup();
    ringIn();
    pickUp(hook);
    wait(60_000);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
