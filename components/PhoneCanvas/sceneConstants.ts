/** Positions in metres, matching the reference scene in assets-src/scene-test.html. */
export const CANDLE_X = 0.2;
export const CANDLE_Z = -0.16;
export const FLAME_Y = 0.138;

/** The phone is turned a little so the dial faces the camera. */
export const PHONE_ROTATION_Y = -0.3;
/** The phone is scaled so its longest side is this wide. */
export const PHONE_WIDTH = 0.23;

/**
 * Scales every light so the render matches the reference image in assets-src/renders.
 * Measured by comparing average brightness and colour across the desk, phone and flame.
 */
export const LIGHT_GAIN = 0.55;
