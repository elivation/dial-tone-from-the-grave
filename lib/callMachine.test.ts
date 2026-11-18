import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  EMERGENCY_NUMBERS,
  callReducer,
  initialCallState,
  type CallEvent,
  type CallState,
} from './callMachine';

const dialling = (digits: string): CallState => ({ status: 'dialling', digits });
const connected: CallState = {
  status: 'connected',
  operatorNumber: '1023',
  callee: 'operator',
  turnIndex: 2,
};
const ringing: CallState = {
  status: 'ringing',
  operatorNumber: '1023',
  callee: 'operator',
  ringsRemaining: 3,
};

describe('callReducer transitions', () => {
  it('[Req 2.2] starts idle and goes off-hook on PICK_UP', () => {
    expect(initialCallState).toEqual({ status: 'idle' });
    expect(callReducer({ status: 'idle' }, { type: 'PICK_UP' })).toEqual({ status: 'off-hook' });
  });

  it('[Req 2.3] the first digit moves off-hook to dialling', () => {
    expect(callReducer({ status: 'off-hook' }, { type: 'DIGIT_DIALLED', digit: '1' })).toEqual(
      dialling('1'),
    );
  });

  it('[Req 2.3] later digits are added to the number', () => {
    expect(callReducer(dialling('10'), { type: 'DIGIT_DIALLED', digit: '2' })).toEqual(
      dialling('102'),
    );
  });

  it('[Req 2.5] a matched number starts ringing with the operator ring count', () => {
    expect(
      callReducer(dialling('1023'), {
        type: 'NUMBER_MATCHED',
        operatorNumber: '1023',
        callee: 'operator',
        ringCount: 3,
      }),
    ).toEqual(ringing);
  });
  it('[Req 11.2] a listing number rings twice, then connects as a listing', () => {
    const matched = callReducer(dialling('61019'), {
      type: 'NUMBER_MATCHED',
      operatorNumber: '61019',
      callee: 'listing',
      ringCount: 2,
    });
    expect(matched).toEqual({
      status: 'ringing',
      operatorNumber: '61019',
      callee: 'listing',
      ringsRemaining: 2,
    });
    const once = callReducer(matched, { type: 'RING_TICK' });
    expect(callReducer(once, { type: 'RING_TICK' })).toEqual({
      status: 'connected',
      operatorNumber: '61019',
      callee: 'listing',
      turnIndex: 0,
    });
  });

  it('[Req 2.6] a number nobody owns goes to wrong-number', () => {
    expect(callReducer(dialling('5555'), { type: 'NO_MATCH' })).toEqual({
      status: 'wrong-number',
    });
  });

  it('[Req 2.8] the timer placing an emergency number goes to emergency-notice, not wrong-number', () => {
    expect(callReducer(dialling('112'), { type: 'CALL_PLACED' })).toEqual({
      status: 'emergency-notice',
    });
  });

  it('[Req 2.8] EMERGENCY_NUMBER goes to emergency-notice from dialling', () => {
    expect(callReducer(dialling('999'), { type: 'EMERGENCY_NUMBER' })).toEqual({
      status: 'emergency-notice',
    });
  });

  it('[Req 2.5] each ring counts down, and the last one connects', () => {
    const once = callReducer(ringing, { type: 'RING_TICK' });
    expect(once).toEqual({ ...ringing, ringsRemaining: 2 });
    const twice = callReducer(once, { type: 'RING_TICK' });
    expect(callReducer(twice, { type: 'RING_TICK' })).toEqual({
      status: 'connected',
      operatorNumber: '1023',
      callee: 'operator',
      turnIndex: 0,
    });
  });

  it('[Req 2.7] hanging up from any state goes back to idle', () => {
    const states: CallState[] = [
      { status: 'off-hook' },
      dialling('10'),
      ringing,
      connected,
      { status: 'wrong-number' },
      { status: 'emergency-notice' },
      { status: 'busy' },
    ];
    for (const state of states) {
      expect(callReducer(state, { type: 'HANG_UP' })).toEqual({ status: 'idle' });
    }
  });

  it('[Req 2.7] the next call starts with an empty number', () => {
    const afterHangUp = callReducer(dialling('1023'), { type: 'HANG_UP' });
    const pickedUp = callReducer(afterHangUp, { type: 'PICK_UP' });
    expect(callReducer(pickedUp, { type: 'DIGIT_DIALLED', digit: '7' })).toEqual(dialling('7'));
  });

  it('a sent turn moves the conversation on', () => {
    expect(callReducer(connected, { type: 'TURN_SENT' })).toEqual({ ...connected, turnIndex: 3 });
  });

  it('the turn cap hangs up for the caller', () => {
    expect(callReducer(connected, { type: 'TURN_CAP_REACHED' })).toEqual({ status: 'idle' });
  });

  it('[Req 2.10] a rate limit while connected goes to busy', () => {
    expect(callReducer(connected, { type: 'RATE_LIMITED' })).toEqual({ status: 'busy' });
  });

  it('[Req 2.6] [Req 2.10] the wrong-number and busy sequences end back at idle', () => {
    expect(callReducer({ status: 'wrong-number' }, { type: 'SEQUENCE_COMPLETE' })).toEqual({
      status: 'idle',
    });
    expect(callReducer({ status: 'busy' }, { type: 'SEQUENCE_COMPLETE' })).toEqual({
      status: 'idle',
    });
  });

  it('[Req 2.8] dismissing the emergency notice goes back to idle', () => {
    expect(callReducer({ status: 'emergency-notice' }, { type: 'DISMISSED' })).toEqual({
      status: 'idle',
    });
  });

  it('[Req 2.9] a digit while connected is ignored', () => {
    expect(callReducer(connected, { type: 'DIGIT_DIALLED', digit: '5' })).toBe(connected);
  });

  it('[Req 2.4] a non-emergency number waits for the caller to look it up', () => {
    const state = dialling('1023');
    expect(callReducer(state, { type: 'CALL_PLACED' })).toBe(state);
  });

  it('ignores events that make no sense in the current state', () => {
    const idle: CallState = { status: 'idle' };
    expect(callReducer(idle, { type: 'RATE_LIMITED' })).toBe(idle);
    expect(callReducer(idle, { type: 'DIGIT_DIALLED', digit: '1' })).toBe(idle);
    expect(callReducer(idle, { type: 'HANG_UP' })).toBe(idle);
    expect(callReducer(ringing, { type: 'PICK_UP' })).toBe(ringing);
  });
});

const digit = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9');
const digits = fc.array(digit, { minLength: 1, maxLength: 8 }).map((d) => d.join(''));

const anyState: fc.Arbitrary<CallState> = fc.oneof(
  fc.constant<CallState>({ status: 'idle' }),
  fc.constant<CallState>({ status: 'off-hook' }),
  digits.map((d): CallState => ({ status: 'dialling', digits: d })),
  fc.record({
    status: fc.constant('ringing' as const),
    operatorNumber: digits,
    callee: fc.constantFrom('operator' as const, 'listing' as const),
    ringsRemaining: fc.integer({ min: 0, max: 5 }),
  }),
  fc.record({
    status: fc.constant('connected' as const),
    operatorNumber: digits,
    callee: fc.constantFrom('operator' as const, 'listing' as const),
    turnIndex: fc.integer({ min: 0, max: 10 }),
  }),
  fc.constant<CallState>({ status: 'wrong-number' }),
  fc.constant<CallState>({ status: 'emergency-notice' }),
  fc.constant<CallState>({ status: 'busy' }),
  fc
    .integer({ min: 0, max: 11 })
    .map((messageIndex): CallState => ({ status: 'ringing-in', messageIndex })),
  fc
    .integer({ min: 0, max: 11 })
    .map((messageIndex): CallState => ({ status: 'incoming-message', messageIndex })),
);

const anyEvent: fc.Arbitrary<CallEvent> = fc.oneof(
  fc.constantFrom<CallEvent>(
    { type: 'PICK_UP' },
    { type: 'HANG_UP' },
    { type: 'CALL_PLACED' },
    { type: 'EMERGENCY_NUMBER' },
    { type: 'NO_MATCH' },
    { type: 'RING_TICK' },
    { type: 'TURN_SENT' },
    { type: 'TURN_CAP_REACHED' },
    { type: 'RATE_LIMITED' },
    { type: 'SEQUENCE_COMPLETE' },
    { type: 'DISMISSED' },
    { type: 'RING_TIMEOUT' },
    { type: 'MESSAGE_DONE' },
  ),
  fc
    .integer({ min: 0, max: 11 })
    .map((messageIndex): CallEvent => ({ type: 'INCOMING_RING', messageIndex })),
  digit.map((d): CallEvent => ({ type: 'DIGIT_DIALLED', digit: d })),
  fc.record({
    type: fc.constant('NUMBER_MATCHED' as const),
    operatorNumber: digits,
    callee: fc.constantFrom('operator' as const, 'listing' as const),
    ringCount: fc.integer({ min: 1, max: 3 }),
  }),
);

const STATUSES = [
  'idle',
  'off-hook',
  'dialling',
  'ringing',
  'connected',
  'wrong-number',
  'emergency-notice',
  'busy',
  'ringing-in',
  'incoming-message',
];

describe('callReducer incoming calls', () => {
  const ringingIn: CallState = { status: 'ringing-in', messageIndex: 4 };
  it('[Req 12.1] an incoming ring on an idle phone makes it ring in', () => {
    expect(callReducer({ status: 'idle' }, { type: 'INCOMING_RING', messageIndex: 4 })).toEqual(
      ringingIn,
    );
  });
  it('[Req 12.2] picking up while it rings in plays the chosen message', () => {
    expect(callReducer(ringingIn, { type: 'PICK_UP' })).toEqual({
      status: 'incoming-message',
      messageIndex: 4,
    });
  });
  it('[Req 12.3] nobody answering returns the phone to idle', () => {
    expect(callReducer(ringingIn, { type: 'RING_TIMEOUT' })).toEqual({ status: 'idle' });
  });
  it('[Req 12.2] the message finishing hangs up by itself', () => {
    expect(
      callReducer({ status: 'incoming-message', messageIndex: 4 }, { type: 'MESSAGE_DONE' }),
    ).toEqual({ status: 'idle' });
  });
  it('[Req 12.2] hanging up during the message goes idle', () => {
    expect(
      callReducer({ status: 'incoming-message', messageIndex: 4 }, { type: 'HANG_UP' }),
    ).toEqual({ status: 'idle' });
  });
  it('[Req 12.1] hanging up while it rings goes idle', () => {
    expect(callReducer(ringingIn, { type: 'HANG_UP' })).toEqual({ status: 'idle' });
  });
  it('[Req 12.3] a timeout or a finished message means nothing outside its own state', () => {
    expect(callReducer({ status: 'idle' }, { type: 'RING_TIMEOUT' })).toEqual({ status: 'idle' });
    expect(callReducer(connected, { type: 'RING_TIMEOUT' })).toBe(connected);
    expect(callReducer(ringingIn, { type: 'MESSAGE_DONE' })).toBe(ringingIn);
  });
});
describe('callReducer properties', () => {
  it('[P5] never returns undefined or an unknown state, for any state and event', () => {
    fc.assert(
      fc.property(anyState, anyEvent, (state, event) => {
        const next = callReducer(state, event);
        return next !== undefined && STATUSES.includes(next.status);
      }),
    );
  });

  it('[P16] the phone never rings by itself unless it is idle', () => {
    fc.assert(
      fc.property(
        anyState.filter((state) => state.status !== 'idle'),
        fc.integer({ min: 0, max: 11 }),
        (state, messageIndex) =>
          callReducer(state, { type: 'INCOMING_RING', messageIndex }) === state,
      ),
    );
  });
  it('[P6] the exact emergency number goes to emergency-notice, extra digits do not', () => {
    fc.assert(
      fc.property(fc.constantFrom(...EMERGENCY_NUMBERS), digit, (number, extra) => {
        const exact = callReducer(dialling(number), { type: 'CALL_PLACED' });
        const longer = number + extra;
        const next = callReducer(dialling(longer), { type: 'CALL_PLACED' });
        return (
          exact.status === 'emergency-notice' &&
          (EMERGENCY_NUMBERS.has(longer) || next.status !== 'emergency-notice')
        );
      }),
    );
  });
});
