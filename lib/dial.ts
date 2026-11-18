/**
 * Rotary dial geometry and pulse maths.
 *
 * Angles are degrees clockwise from 12 o'clock, in [0, 360).
 *
 * Layout follows a real dial: the metal finger stop sits at the bottom right.
 * The hole for 1 is closest to the stop (anticlockwise of it), then 2 to 9,
 * and 0 is the furthest away. There is a blank gap between the 0 hole and the
 * stop. You drag clockwise to the stop and let go, then the dial runs back
 * anticlockwise at 10 pulses per second.
 */

export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
export type Digit = (typeof DIGITS)[number];

/** Finger stop position, about 4 o'clock. */
export const STOP_ANGLE = 130;

/** Angle between neighbouring finger holes. */
export const HOLE_SPACING = 30;

/** Clockwise travel from the 1 hole to the stop. */
export const FIRST_HOLE_TRAVEL = 60;

/** Release within this many degrees of the stop counts as dialled. */
export const REGISTER_TOLERANCE = 3;

/** One pulse every 100 ms, the real rotary rate of 10 pulses per second. */
export const PULSE_INTERVAL_MS = 100;

/** Pulses sent per digit. 0 sends 10. */
export const PULSES: Record<Digit, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '0': 10,
};

export function isDigit(value: string): value is Digit {
  return (DIGITS as readonly string[]).includes(value);
}

function normalise(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Clockwise degrees a digit's hole must travel to reach the stop. */
export function travelDegrees(digit: Digit): number {
  return FIRST_HOLE_TRAVEL + (PULSES[digit] - 1) * HOLE_SPACING;
}

/** Resting angle of each digit's finger hole. */
export const HOLE_ANGLES: Record<Digit, number> = Object.fromEntries(
  DIGITS.map((d) => [d, normalise(STOP_ANGLE - travelDegrees(d))]),
) as Record<Digit, number>;

/** Time for the dial to run back after a digit, at 100 ms per pulse. */
export function returnDuration(digit: string): number {
  if (!isDigit(digit)) {
    throw new Error(`Unknown digit: ${digit}`);
  }
  return PULSES[digit] * PULSE_INTERVAL_MS;
}

/**
 * True when the release point is close enough to the stop to dial the digit.
 * `degreesShortOfStop` is 0 at the stop and grows the earlier the user lets go.
 */
export function shouldRegister(digit: string, degreesShortOfStop: number): boolean {
  if (!isDigit(digit)) return false;
  return degreesShortOfStop <= REGISTER_TOLERANCE;
}

/** Pointer position as degrees clockwise from 12 o'clock around (cx, cy). */
export function pointerAngle(cx: number, cy: number, x: number, y: number): number {
  const deg = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  return normalise(deg);
}

/**
 * Adds one pointer move to the current dial rotation.
 *
 * Each move is read as the shortest turn between the two pointer angles, so a
 * slow drag can carry the 0 hole most of the way round without jumping.
 * The result is clamped: the dial cannot turn anticlockwise past rest or
 * clockwise past the finger stop.
 */
export function accumulateRotation(
  current: number,
  prevPointer: number,
  nextPointer: number,
  max: number,
): number {
  let delta = normalise(nextPointer - prevPointer);
  if (delta > 180) delta -= 360;
  return Math.min(max, Math.max(0, current + delta));
}

/** Hole index 0 is the 1 hole, index 9 is the 0 hole. */
export function digitFromHoleIndex(index: number): Digit {
  const digit = DIGITS[index];
  if (digit === undefined) {
    throw new RangeError(`Hole index must be 0-9, got ${index}`);
  }
  return digit;
}
