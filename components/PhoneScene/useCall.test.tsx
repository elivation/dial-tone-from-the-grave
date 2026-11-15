import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { HOLE_ANGLES, PULSES, type Digit } from '@/lib/dial';
import type { OperatorDefinition } from '@/lib/operators';
import { useCall, type CallAudio } from './useCall';

const operator = (number: string, ringCount: 2 | 3): OperatorDefinition => ({
  number,
  name: `Operator ${number}`,
  systemPrompt: '',
  voiceConfig: { pitch: 1, rate: 1, voiceHint: '' },
  ringCount,
  tools: [],
  greeting: '',
});
const operators = {
  '1023': operator('1023', 3),
  '1026': operator('1026', 2),
  '11': operator('11', 3),
};

const makeAudio = () => ({
  startDialTone: vi.fn(),
  stopDialTone: vi.fn(),
  startRingTone: vi.fn(),
  stopRingTone: vi.fn(),
  startBusyTone: vi.fn(),
  stopBusyTone: vi.fn(),
  startStatic: vi.fn(),
  stopStatic: vi.fn(),
  playDisconnectedTone: vi.fn(),
  click: vi.fn(),
  stopAll: vi.fn(),
  unlockOnFirstInteraction: vi.fn(() => vi.fn()),
});

let audio: ReturnType<typeof makeAudio>;

function setup() {
  return renderHook(() => useCall({ operators, audio: audio as CallAudio }));
}
type Hook = ReturnType<typeof setup>;

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

/** Press a key and wait for the hole to swing to the stop and the dial to run back to rest. */
function dialDigit(hook: Hook, digit: Digit) {
  act(() => void hook.result.current.controller.press(digit));
  wait(150 + PULSES[digit] * 100);
}
function dial(hook: Hook, number: string) {
  for (const digit of number) dialDigit(hook, digit as Digit);
}
/** Dials the speaking clock (2 rings) and waits until the operator picks up. Each wait is its own step, so the timers set by each state exist before the next wait. */
function connect(hook: Hook) {
  pickUp(hook);
  dial(hook, '1026');
  wait(2000);
  wait(1000);
  wait(3000);
}
function pickUp(hook: Hook) {
  act(() => hook.result.current.pickUp());
}
const status = (hook: Hook) => hook.result.current.state.status;

beforeEach(() => {
  vi.useFakeTimers();
  audio = makeAudio();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useCall', () => {
  it('[Req 2.2] starts idle with the dial locked, then picking up plays the dial tone', () => {
    const hook = setup();
    expect(status(hook)).toBe('idle');
    expect(hook.result.current.controller.disabled).toBe(true);
    expect(audio.startDialTone).not.toHaveBeenCalled();
    pickUp(hook);
    expect(status(hook)).toBe('off-hook');
    expect(hook.result.current.controller.disabled).toBe(false);
    expect(audio.startDialTone).toHaveBeenCalledTimes(1);
  });

  it('[Req 2.3] the first digit moves to dialling and stops the dial tone', () => {
    const hook = setup();
    pickUp(hook);
    dialDigit(hook, '1');
    expect(hook.result.current.state).toEqual({ status: 'dialling', digits: '1' });
    expect(audio.stopDialTone).toHaveBeenCalledTimes(1);
  });

  it('[Req 8.2] clicks once for every pulse the dial runs back', () => {
    const hook = setup();
    pickUp(hook);
    dialDigit(hook, '3');
    expect(audio.click).toHaveBeenCalledTimes(PULSES['3']);
  });

  it('[Req 2.4] places the call 2 seconds after the dial is back at rest, and not before', () => {
    const hook = setup();
    pickUp(hook);
    dial(hook, '1023');
    expect(status(hook)).toBe('dialling');
    wait(1999);
    expect(status(hook)).toBe('dialling');
    wait(1);
    expect(status(hook)).toBe('ringing');
  });

  it('[Req 2.4] another digit inside the pause starts the 2 seconds again', () => {
    const hook = setup();
    pickUp(hook);
    dial(hook, '102');
    wait(1500);
    dialDigit(hook, '3');
    wait(1999);
    expect(hook.result.current.state).toEqual({ status: 'dialling', digits: '1023' });
    wait(1);
    expect(status(hook)).toBe('ringing');
  });

  it('[Req 2.4] does not count the wait while the dial is still turning', () => {
    const hook = setup();
    pickUp(hook);
    dialDigit(hook, '1');
    act(() => void hook.result.current.controller.press('0'));
    // The 0 is mid swing, so the 2 seconds has not begun.
    wait(149);
    expect(hook.result.current.state).toEqual({ status: 'dialling', digits: '1' });
    wait(1);
    expect(hook.result.current.state).toEqual({ status: 'dialling', digits: '10' });
  });

  it('[Req 2.4] does not place the call while a finger is still holding the dial, however long', () => {
    const hook = setup();
    pickUp(hook);
    dialDigit(hook, '1');
    act(() => void hook.result.current.controller.grab('5', HOLE_ANGLES['5'], 1));
    wait(5000);
    expect(hook.result.current.state).toEqual({ status: 'dialling', digits: '1' });
    // Letting go early springs the dial back, and the 2 seconds count from when it is at rest.
    act(() => void hook.result.current.controller.release(1));
    wait(1000);
    expect(status(hook)).toBe('dialling');
    wait(2000);
    expect(status(hook)).toBe('wrong-number');
  });

  it('[Req 2.5] a known number rings the tone, then connects after the operator ring count', () => {
    const hook = setup();
    pickUp(hook);
    dial(hook, '1026');
    wait(2000);
    expect(hook.result.current.state).toMatchObject({ status: 'ringing', operatorNumber: '1026' });
    expect(audio.startRingTone).toHaveBeenCalledTimes(1);
    // Two rings: each ends 1 s into its 3 s cycle.
    wait(1000);
    expect(status(hook)).toBe('ringing');
    wait(3000);
    expect(hook.result.current.state).toEqual({
      status: 'connected',
      operatorNumber: '1026',
      turnIndex: 0,
    });
    expect(audio.stopRingTone).toHaveBeenCalledTimes(1);
  });

  it('[Req 2.5] rings three times for an operator with a ring count of 3', () => {
    const hook = setup();
    pickUp(hook);
    dial(hook, '1023');
    wait(2000);
    wait(1000);
    wait(3000);
    expect(status(hook)).toBe('ringing');
    wait(3000);
    expect(status(hook)).toBe('connected');
  });

  it('[Req 2.6] an unknown number plays static, then the disconnected tone, then goes back to idle', () => {
    const hook = setup();
    pickUp(hook);
    dial(hook, '5555');
    wait(2000);
    expect(status(hook)).toBe('wrong-number');
    expect(audio.startStatic).toHaveBeenCalledTimes(1);
    expect(audio.playDisconnectedTone).not.toHaveBeenCalled();
    wait(2000);
    expect(audio.stopStatic).toHaveBeenCalled();
    expect(audio.playDisconnectedTone).toHaveBeenCalledTimes(1);
    expect(status(hook)).toBe('wrong-number');
    wait(900);
    expect(status(hook)).toBe('idle');
  });

  it('[Req 2.8] an emergency number goes to the plain notice, with no static, ring or tone', () => {
    const hook = setup();
    pickUp(hook);
    dial(hook, '112');
    wait(2000);
    expect(status(hook)).toBe('emergency-notice');
    expect(audio.startStatic).not.toHaveBeenCalled();
    expect(audio.startRingTone).not.toHaveBeenCalled();
    expect(audio.playDisconnectedTone).not.toHaveBeenCalled();
    act(() => hook.result.current.dismiss());
    expect(status(hook)).toBe('idle');
  });

  it('[Req 2.7] hanging up from any state goes back to idle and stops what was playing', () => {
    const hook = setup();
    pickUp(hook);
    act(() => hook.result.current.hangUp());
    expect(status(hook)).toBe('idle');
    expect(audio.stopDialTone).toHaveBeenCalledTimes(1);

    pickUp(hook);
    dial(hook, '1023');
    wait(2000);
    expect(status(hook)).toBe('ringing');
    act(() => hook.result.current.hangUp());
    expect(status(hook)).toBe('idle');
    expect(audio.stopRingTone).toHaveBeenCalledTimes(1);
    // The number is gone: the next call starts clean, and the old timer does not fire.
    wait(10_000);
    expect(status(hook)).toBe('idle');
    pickUp(hook);
    dialDigit(hook, '2');
    expect(hook.result.current.state).toEqual({ status: 'dialling', digits: '2' });
  });

  it('[Req 2.7] the rings of a call that was hung up do not count towards the next call', () => {
    const hook = setup();
    pickUp(hook);
    dial(hook, '1023');
    wait(2000);
    wait(1200);
    act(() => hook.result.current.hangUp());
    pickUp(hook);
    dial(hook, '11');
    wait(2000);
    expect(status(hook)).toBe('ringing');
    // Three rings need 7 seconds. Leftover ticks from the first call would connect it far sooner.
    wait(3500);
    expect(status(hook)).toBe('ringing');
  });

  it('[Req 2.9] once connected, the dial is locked and digits are ignored', () => {
    const hook = setup();
    connect(hook);
    expect(status(hook)).toBe('connected');
    expect(hook.result.current.controller.disabled).toBe(true);
    let accepted = true;
    act(() => {
      accepted = hook.result.current.controller.press('5');
    });
    expect(accepted).toBe(false);
    wait(1000);
    expect(status(hook)).toBe('connected');
  });

  it('[Req 2.10] a rate limit plays the busy tone, then goes back to idle', () => {
    const hook = setup();
    connect(hook);
    act(() => hook.result.current.send({ type: 'RATE_LIMITED' }));
    expect(status(hook)).toBe('busy');
    expect(audio.startBusyTone).toHaveBeenCalledTimes(1);
    wait(3000);
    expect(status(hook)).toBe('idle');
    expect(audio.stopBusyTone).toHaveBeenCalledTimes(1);
  });

  it('[Req 8.7] wakes the audio on the first interaction, and lets go of that listener when it goes', () => {
    const remove = vi.fn();
    audio.unlockOnFirstInteraction.mockReturnValue(remove);
    const hook = setup();
    expect(audio.unlockOnFirstInteraction).toHaveBeenCalledTimes(1);
    hook.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('silences everything when the page goes away', () => {
    const hook = setup();
    pickUp(hook);
    hook.unmount();
    expect(audio.stopAll).toHaveBeenCalled();
  });

  it('does not place a call, or change state, after it has gone', () => {
    const hook = setup();
    pickUp(hook);
    dial(hook, '1023');
    hook.unmount();
    expect(() => wait(10_000)).not.toThrow();
    expect(audio.startRingTone).not.toHaveBeenCalled();
  });
});
