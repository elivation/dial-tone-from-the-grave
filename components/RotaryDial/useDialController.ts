'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  PULSES,
  PULSE_INTERVAL_MS,
  accumulateRotation,
  shouldRegister,
  travelDegrees,
  type Digit,
} from '@/lib/dial';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/** How long a dial that was let go early takes to spring back to rest. */
export const SPRING_BACK_MS = 220;

/** How long a key press takes to swing the hole clockwise to the finger stop. */
export const KEY_SWING_MS = 150;

export type DialPhase = 'idle' | 'dragging' | 'swinging' | 'returning' | 'springing';

export type DialControllerOptions = {
  /** Blocks all interaction, for example while a call is connecting. */
  disabled: boolean;
  /** Called once when a digit is dialled, at the moment the user lets go at the stop. */
  onDigit: (digit: Digit) => void;
  /** Called on every pulse while the dial runs back. Hook for the click sound. */
  onPulse?: () => void;
};

export type DialController = {
  /** Degrees the finger wheel has turned clockwise from rest. 0 at rest, up to the digit's travel. */
  rotation: number;
  phase: DialPhase;
  /** The digit being dialled, from grab until the dial is back at rest. */
  activeDigit: Digit | null;
  disabled: boolean;
  reducedMotion: boolean;
  /**
   * Puts a finger in a hole. `pointerAngle` is degrees clockwise from 12 o'clock around the dial.
   * Returns false, and does nothing, if the dial is disabled or already moving.
   */
  grab: (digit: Digit, pointerAngle: number, pointerId: number) => boolean;
  /** Moves the finger. Only the pointer that grabbed the dial is listened to. */
  drag: (pointerAngle: number, pointerId: number) => void;
  /** Lets go. Returns true if this pointer was the one dragging the dial. */
  release: (pointerId: number) => boolean;
  /**
   * Dials a digit from the keyboard: the hole swings to the stop in 150 ms, then the dial runs back
   * as usual. With reduced motion the digit is dialled at once. Returns false, and does nothing,
   * if the dial is disabled or already moving.
   */
  press: (digit: Digit) => boolean;
};

type Drag = { digit: Digit; prev: number; rotation: number; pointerId: number };

/**
 * The state machine of a rotary dial: drag a hole to the stop, let go, and the dial
 * runs back one pulse every 100 ms. Shared by the 2D dial and the 3D phone, so both
 * behave the same. It holds no call logic and only reports digits and pulses.
 */
export function useDialController(options: DialControllerOptions): DialController {
  const reducedMotion = usePrefersReducedMotion();
  const [rotation, setRotation] = useState(0);
  const [phase, setPhaseState] = useState<DialPhase>('idle');
  const [activeDigit, setActiveDigit] = useState<Digit | null>(null);

  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const reducedMotionRef = useRef(reducedMotion);
  useLayoutEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  const phaseRef = useRef<DialPhase>('idle');
  const drag = useRef<Drag | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | null>(null);

  const setPhase = useCallback((next: DialPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current as ReturnType<typeof setInterval>);
      clearTimeout(timer.current as ReturnType<typeof setTimeout>);
      timer.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const runBack = useCallback(
    (digit: Digit) => {
      const pulses = PULSES[digit];
      const travel = travelDegrees(digit);
      let left = pulses;
      setPhase('returning');
      timer.current = setInterval(() => {
        left -= 1;
        setRotation(left === 0 ? 0 : (travel * left) / pulses);
        latest.current.onPulse?.();
        if (left === 0) {
          clearTimer();
          setPhase('idle');
          setActiveDigit(null);
        }
      }, PULSE_INTERVAL_MS);
    },
    [clearTimer, setPhase],
  );

  const springBack = useCallback(() => {
    setRotation(0);
    setPhase('springing');
    timer.current = setTimeout(
      () => {
        timer.current = null;
        setPhase('idle');
        setActiveDigit(null);
      },
      reducedMotionRef.current ? 0 : SPRING_BACK_MS,
    );
  }, [setPhase]);

  const grab = useCallback(
    (digit: Digit, pointerAngle: number, pointerId: number): boolean => {
      if (latest.current.disabled || phaseRef.current !== 'idle') return false;
      drag.current = { digit, prev: pointerAngle, rotation: 0, pointerId };
      setActiveDigit(digit);
      setPhase('dragging');
      return true;
    },
    [setPhase],
  );

  const move = useCallback((pointerAngle: number, pointerId: number) => {
    const current = drag.current;
    if (!current || pointerId !== current.pointerId) return;
    current.rotation = accumulateRotation(
      current.rotation,
      current.prev,
      pointerAngle,
      travelDegrees(current.digit),
    );
    current.prev = pointerAngle;
    setRotation(current.rotation);
  }, []);

  const release = useCallback(
    (pointerId: number): boolean => {
      const current = drag.current;
      if (!current || pointerId !== current.pointerId) return false;
      drag.current = null;

      const shortOfStop = travelDegrees(current.digit) - current.rotation;
      if (shouldRegister(current.digit, shortOfStop)) {
        setRotation(travelDegrees(current.digit));
        latest.current.onDigit(current.digit);
        runBack(current.digit);
      } else {
        springBack();
      }
      return true;
    },
    [runBack, springBack],
  );

  const press = useCallback(
    (digit: Digit): boolean => {
      if (latest.current.disabled || phaseRef.current !== 'idle') return false;
      setActiveDigit(digit);
      setRotation(travelDegrees(digit));
      if (reducedMotionRef.current) {
        latest.current.onDigit(digit);
        runBack(digit);
        return true;
      }
      setPhase('swinging');
      timer.current = setTimeout(() => {
        timer.current = null;
        latest.current.onDigit(digit);
        runBack(digit);
      }, KEY_SWING_MS);
      return true;
    },
    [runBack, setPhase],
  );

  return {
    rotation,
    phase,
    activeDigit,
    disabled: options.disabled,
    reducedMotion,
    grab,
    drag: move,
    release,
    press,
  };
}
