'use client';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { getAudioEngine, type AudioEngine } from '@/lib/audio';
import {
  EMERGENCY_NUMBERS,
  callReducer,
  initialCallState,
  type CallEvent,
  type CallState,
} from '@/lib/callMachine';
import { LISTING_RING_COUNT } from '@/lib/listingGhost';
import { OPERATORS, type OperatorDefinition } from '@/lib/operators';
import { useDialController, type DialController } from '@/components/RotaryDial/useDialController';
import { useDialKeyboard } from '@/components/RotaryDial/useDialKeyboard';

/** The sounds a call needs. The real AudioEngine fits, and tests pass a fake. */
export type CallAudio = Pick<
  AudioEngine,
  | 'startDialTone'
  | 'stopDialTone'
  | 'startRingTone'
  | 'stopRingTone'
  | 'startBusyTone'
  | 'stopBusyTone'
  | 'startStatic'
  | 'stopStatic'
  | 'playDisconnectedTone'
  | 'click'
  | 'stopAll'
  | 'unlockOnFirstInteraction'
>;

/** The call is placed this long after the dial is back at rest (Req 2.4). */
export const DIAL_PAUSE_MS = 2000;
/** One ring is a 1 s double burst, then a 2 s gap. The call counts as rung once the burst ends. */
export const RING_BURST_MS = 1000;
export const RING_CYCLE_MS = 3000;
/** Static, then the three pips (0.9 s), then the line goes back to idle. */
export const STATIC_MS = 2000;
export const PIPS_MS = 900;
/** The busy tone plays for four beats, then the line goes back to idle. */
export const BUSY_MS = 3000;

/** Only a five digit short number or a ten digit 011 number can belong to a listing. */
const LISTING_NUMBER = /^(\d{5}|\d{10})$/;

/** Asks the server what a dialled number reaches. Any failure counts as a wrong number. */
async function reachesListing(digits: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch('/api/number', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ digits }),
      signal,
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return (
      typeof body === 'object' && body !== null && (body as { kind?: unknown }).kind === 'listing'
    );
  } catch {
    return false;
  }
}

export type UseCall = {
  state: CallState;
  /** The rotary dial's controller. It is locked unless the phone is off the hook and no call is in progress. */
  controller: DialController;
  pickUp: () => void;
  hangUp: () => void;
  dismiss: () => void;
  /** Sends any other event, such as RATE_LIMITED or TURN_CAP_REACHED, from the operator chat. */
  send: (event: CallEvent) => void;
};

/**
 * The whole call: the state machine, the dial, the timers that place and ring the call, and the
 * sounds for each state. Sounds start when a state is entered and stop when it is left, so a
 * hang-up from anywhere silences the line.
 */
export function useCall({
  operators = OPERATORS,
  audio: audioOverride,
  offline = false,
}: {
  operators?: Record<string, OperatorDefinition>;
  audio?: CallAudio;
  /** While true the dial is locked, whatever the call is doing. */
  offline?: boolean;
} = {}): UseCall {
  const [state, dispatch] = useReducer(callReducer, initialCallState);
  const [audio] = useState<CallAudio>(() => audioOverride ?? getAudioEngine());

  const dialable = !offline && (state.status === 'off-hook' || state.status === 'dialling');
  const controller = useDialController({
    disabled: !dialable,
    onDigit: (digit) => dispatch({ type: 'DIGIT_DIALLED', digit }),
    onPulse: () => audio.click(),
  });
  useDialKeyboard(controller);

  useEffect(() => audio.unlockOnFirstInteraction(), [audio]);
  useEffect(() => () => audio.stopAll(), [audio]);

  // Place the call once the dial has been at rest for the pause.
  const dialled = state.status === 'dialling' ? state.digits : null;
  const atRest = controller.phase === 'idle';
  useEffect(() => {
    if (dialled === null || !atRest) return;
    const lookup = new AbortController();
    const timer = setTimeout(() => {
      // The reducer sends emergency numbers to their notice. Anything else is looked up here.
      dispatch({ type: 'CALL_PLACED' });
      if (EMERGENCY_NUMBERS.has(dialled)) return;
      const operator = operators[dialled];
      if (operator) {
        dispatch({
          type: 'NUMBER_MATCHED',
          operatorNumber: operator.number,
          callee: 'operator',
          ringCount: operator.ringCount,
        });
      } else if (!LISTING_NUMBER.test(dialled)) {
        dispatch({ type: 'NO_MATCH' });
      } else {
        // The line stays in `dialling` while the answer is out. A hang-up or another digit
        // aborts the request, and an aborted request sends no event.
        void reachesListing(dialled, lookup.signal).then((found) => {
          if (lookup.signal.aborted) return;
          dispatch(
            found
              ? {
                  type: 'NUMBER_MATCHED',
                  operatorNumber: dialled,
                  callee: 'listing',
                  ringCount: LISTING_RING_COUNT,
                }
              : { type: 'NO_MATCH' },
          );
        });
      }
    }, DIAL_PAUSE_MS);
    return () => {
      clearTimeout(timer);
      lookup.abort();
    };
  }, [dialled, atRest, operators]);

  const status = state.status;
  const ringingNumber = state.status === 'ringing' ? state.operatorNumber : null;
  const ringingCallee = state.status === 'ringing' ? state.callee : null;

  useEffect(() => {
    if (status !== 'off-hook') return;
    audio.startDialTone();
    return () => audio.stopDialTone();
  }, [status, audio]);

  useEffect(() => {
    if (ringingNumber === null) return;
    audio.startRingTone();
    const rings =
      ringingCallee === 'listing' ? LISTING_RING_COUNT : (operators[ringingNumber]?.ringCount ?? 0);
    const timers = Array.from({ length: rings }, (_, i) =>
      setTimeout(() => dispatch({ type: 'RING_TICK' }), RING_BURST_MS + i * RING_CYCLE_MS),
    );
    return () => {
      timers.forEach(clearTimeout);
      audio.stopRingTone();
    };
  }, [ringingNumber, ringingCallee, operators, audio]);

  useEffect(() => {
    if (status !== 'wrong-number') return;
    audio.startStatic();
    const pips = setTimeout(() => {
      audio.stopStatic();
      audio.playDisconnectedTone();
    }, STATIC_MS);
    const done = setTimeout(() => dispatch({ type: 'SEQUENCE_COMPLETE' }), STATIC_MS + PIPS_MS);
    return () => {
      clearTimeout(pips);
      clearTimeout(done);
      audio.stopStatic();
    };
  }, [status, audio]);

  useEffect(() => {
    if (status !== 'busy') return;
    audio.startBusyTone();
    const done = setTimeout(() => dispatch({ type: 'SEQUENCE_COMPLETE' }), BUSY_MS);
    return () => {
      clearTimeout(done);
      audio.stopBusyTone();
    };
  }, [status, audio]);

  const pickUp = useCallback(() => dispatch({ type: 'PICK_UP' }), []);
  const hangUp = useCallback(() => dispatch({ type: 'HANG_UP' }), []);
  const dismiss = useCallback(() => dispatch({ type: 'DISMISSED' }), []);

  return { state, controller, pickUp, hangUp, dismiss, send: dispatch };
}
