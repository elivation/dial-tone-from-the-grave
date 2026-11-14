/**
 * Rotary dial geometry and pulse maths.
 *
 * Angles are measured in degrees clockwise from 12 o'clock.
 * The finger stop sits at STOP_ANGLE (bottom-right of the dial).
 * Holes are arranged anticlockwise from the stop: 1 is closest to the stop,
 * 0 is furthest (one full revolution minus one hole step).
 *
 * On a real dial the return spring runs at 10 pulses per second.
 * Digit d generates d pulses (0 generates 10 pulses).
 */

/** Degrees clockwise from 12 o'clock where the finger stop sits. */
export const STOP_ANGLE = 345;

/**
 * Resting angle (degrees) for each digit's finger hole.
 * Holes are spaced 36 degrees apart, numbered 1-9 then 0 anticlockwise
 * from the finger stop position.
 *
 * Hole 1 starts at STOP_ANGLE - 36 = 309, hole 2 at 273, ... hole 0 at 9.
 * Values are normalised to [0, 360).
 */
export const HOLE_ANGLES: Record<string, number> = {
  '1': 309,
  '2': 273,
  '3': 237,
  '4': 201,
  '5': 165,
  '6': 129,
  '7': 93,
  '8': 57,
  '9': 21,
  '0': 345, // resting position is at the stop — 0 degrees of travel before the stop
};

// Note: digit '0' rests AT the stop. Its hole travels the full 360 degrees
// (10 pulses worth), passing every other hole. We store 345 as its rest
// angle; in practice the UI starts it one full revolution back.
// For geometry purposes here, all 10 values are unique in [0, 360).

/**
 * Pulse count per digit. A real rotary dial sends d pulses for digit d,
 * except 0 which sends 10 pulses.
 */
export const PULSES: Record<string, number> = {
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

/**
 * Returns the total return animation duration in milliseconds for a digit.
 * Rate is exactly 10 pulses per second (100 ms per pulse).
 */
export function returnDuration(digit: string): number {
  const pulses = PULSES[digit];
  if (pulses === undefined) {
    throw new Error(`Unknown digit: ${digit}`);
  }
  return pulses * 100;
}

/**
 * Returns true if the dial has been dragged far enough to register the digit.
 *
 * @param digit - The digit whose hole is being dragged.
 * @param degreesShortOfStop - How many degrees before the finger stop the
 *   user released. 0 means they reached the stop exactly. Positive means
 *   they released early (did not reach the stop).
 *
 * Registration happens when the hole is within REGISTER_TOLERANCE degrees
 * of the stop (i.e. degreesShortOfStop <= REGISTER_TOLERANCE).
 */
export const REGISTER_TOLERANCE = 3; // degrees

export function shouldRegister(digit: string, degreesShortOfStop: number): boolean {
  // Validate digit exists (guard for property tests with arbitrary input)
  if (!(digit in PULSES)) return false;
  return degreesShortOfStop <= REGISTER_TOLERANCE;
}

/**
 * Returns the digit string for a given hole index (0 = hole for '1',
 * 1 = hole for '2', ..., 9 = hole for '0').
 */
export function digitFromHoleIndex(index: number): string {
  if (index < 0 || index > 9) {
    throw new RangeError(`Hole index must be 0-9, got ${index}`);
  }
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  return digits[index] as string;
}
