import { PULSES, PULSE_INTERVAL_MS, travelDegrees, type Digit } from '@/lib/dial';
import { SPRING_BACK_MS, type DialPhase } from '@/components/RotaryDial/useDialController';

/** A spring-back is an ease-out. Three time constants fill the spring-back time. */
const SPRING_TIME_CONSTANT_S = SPRING_BACK_MS / 1000 / 3;

/**
 * Degrees per second the wheel runs back at. Constant, so the digit's travel takes
 * exactly one pulse interval per pulse (0 takes a full second).
 */
export function returnSpeed(digit: Digit): number {
  return travelDegrees(digit) / PULSES[digit] / (PULSE_INTERVAL_MS / 1000);
}

export type MotionInput = {
  /** Where the wheel is drawn now, in degrees from rest. */
  shown: number;
  /** Where the dial controller says it is. */
  target: number;
  phase: DialPhase;
  reducedMotion: boolean;
  /** Degrees per second, from returnSpeed. */
  returnSpeed: number;
  /** Seconds since the last frame. */
  dt: number;
};

/**
 * One frame of wheel motion. The controller moves in steps, one per pulse. This turns that
 * into what the eye should see: the wheel follows the finger, runs back at constant speed,
 * or eases back if it was let go early.
 */
export function stepShown({
  shown,
  target,
  phase,
  reducedMotion,
  returnSpeed: speed,
  dt,
}: MotionInput): number {
  if (reducedMotion || phase === 'dragging' || phase === 'idle') return target;
  if (phase === 'returning') return Math.max(0, shown - speed * dt);
  const next = shown + (target - shown) * (1 - Math.exp(-dt / SPRING_TIME_CONSTANT_S));
  return Math.abs(next - target) < 0.01 ? target : next;
}
