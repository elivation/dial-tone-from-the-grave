import {
  DIGITS,
  HOLE_ANGLES,
  PULSES,
  PULSE_INTERVAL_MS,
  travelDegrees,
  type Digit,
} from '@/lib/dial';

export type ReplayStep = {
  /** Milliseconds from the start. */
  at: number;
  kind: 'grab' | 'drag' | 'release';
  digit: Digit;
  /** Where the finger is, degrees clockwise from 12 o'clock. */
  angle: number;
};

/** How far the finger moves per step, and how often. Close to a real drag at 60 frames a second. */
const DRAG_STEP_DEGREES = 6;
const DRAG_STEP_MS = 20;
/** A pause before the first digit, and after each run back, as a person would. */
const PAUSE_MS = 400;

const isDigit = (c: string): c is Digit => (DIGITS as readonly string[]).includes(c);

/**
 * A scripted drag of every digit in `number`, the way a finger would: into the hole, round to the
 * stop, let go, and wait for the dial to run back. For the dev preview, to render what dialling
 * leaves behind.
 */
export function replayPlan(number: string): ReplayStep[] {
  const steps: ReplayStep[] = [];
  let at = PAUSE_MS;
  for (const digit of [...number].filter(isDigit)) {
    const start = HOLE_ANGLES[digit];
    const travel = travelDegrees(digit);
    steps.push({ at, kind: 'grab', digit, angle: start });
    for (let moved = DRAG_STEP_DEGREES; moved < travel; moved += DRAG_STEP_DEGREES) {
      at += DRAG_STEP_MS;
      steps.push({ at, kind: 'drag', digit, angle: start + moved });
    }
    at += DRAG_STEP_MS;
    steps.push({ at, kind: 'drag', digit, angle: start + travel });
    at += DRAG_STEP_MS;
    steps.push({ at, kind: 'release', digit, angle: start + travel });
    at += PULSES[digit] * PULSE_INTERVAL_MS + PAUSE_MS;
  }
  return steps;
}
