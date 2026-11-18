'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isDigit } from '@/lib/dial';
import type { UseCall } from './useCall';

/**
 * Dials a number for the caller, digit by digit, through the same dial controller as a hand on the
 * dial. It picks up if the phone is on the hook, waits for the dial to come back to rest before
 * each digit, and leaves the 2 second pause to `useCall`. A call or a half dialled number in
 * progress is hung up first, so the digits are never added to someone else's. `pending` says
 * whether digits are still waiting to be dialled.
 */
export function useDialNumber({ call, offline }: { call: UseCall; offline: boolean }) {
  const { state, controller, pickUp, hangUp } = call;
  const { phase, disabled, press } = controller;
  const status = state.status;
  const queue = useRef('');
  // Set when a call or half dialled number has to be hung up before the new number goes in.
  const reset = useRef(false);
  // A change of this nudges the effect when a number is queued while nothing else has changed.
  const [requests, setRequests] = useState(0);

  useEffect(() => {
    const next = queue.current[0];
    if (next === undefined) return;
    if (offline) {
      queue.current = '';
      return;
    }
    // A digit that is still swinging to the stop would land in the next call, so wait for rest.
    if (reset.current) {
      if (phase !== 'idle') return;
      reset.current = false;
      if (status !== 'idle') return hangUp();
    }
    if (status === 'idle') return pickUp();
    if (status !== 'off-hook' && status !== 'dialling') {
      // The call moved on by itself, so the rest of the number is no longer wanted.
      queue.current = '';
      return;
    }
    if (phase !== 'idle' || disabled || !isDigit(next)) return;
    if (press(next)) queue.current = queue.current.slice(1);
  }, [requests, offline, status, phase, disabled, press, pickUp, hangUp]);

  const dial = useCallback(
    (digits: string) => {
      if (offline || !/^\d+$/.test(digits)) return;
      queue.current = digits;
      reset.current = status !== 'idle' && status !== 'off-hook';
      setRequests((n) => n + 1);
    },
    [offline, status],
  );
  // The phone must not ring by itself while digits are still waiting to go in.
  const pending = useCallback(() => queue.current !== '', []);
  return { dial, pending };
}
