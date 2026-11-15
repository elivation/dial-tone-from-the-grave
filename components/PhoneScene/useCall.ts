'use client';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { getAudioEngine, type AudioEngine } from '@/lib/audio';
import { callReducer, initialCallState, type CallEvent, type CallState } from '@/lib/callMachine';
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
}: {
  operators?: Record<string, OperatorDefinition>;
  audio?: CallAudio;
} = {}): UseCall {
  const [state, dispatch] = useReducer(callReducer, initialCallState);
  const [audio] = useState<CallAudio>(() => audioOverride ?? getAudioEngine());

  const dialable = state.status === 'off-hook' || state.status === 'dialling';
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
    const timer = setTimeout(() => {
      // The reducer sends emergency numbers to their notice. Anything else is looked up here.
      dispatch({ type: 'CALL_PLACED' });
      const operator = operators[dialled];
      dispatch(
        operator
          ? {
              type: 'NUMBER_MATCHED',
              operatorNumber: operator.number,
              ringCount: operator.ringCount,
            }
          : { type: 'NO_MATCH' },
      );
    }, DIAL_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [dialled, atRest, operators]);

  const status = state.status;
  const ringing = state.status === 'ringing' ? state.operatorNumber : null;

  useEffect(() => {
    if (status !== 'off-hook') return;
    audio.startDialTone();
    return () => audio.stopDialTone();
  }, [status, audio]);

  useEffect(() => {
    if (ringing === null) return;
    audio.startRingTone();
    const rings = operators[ringing]?.ringCount ?? 0;
    const timers = Array.from({ length: rings }, (_, i) =>
      setTimeout(() => dispatch({ type: 'RING_TICK' }), RING_BURST_MS + i * RING_CYCLE_MS),
    );
    return () => {
      timers.forEach(clearTimeout);
      audio.stopRingTone();
    };
  }, [ringing, operators, audio]);

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
