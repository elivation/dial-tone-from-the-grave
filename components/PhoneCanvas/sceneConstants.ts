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

/**
 * The slime in the finger holes. Thick goo is deep toxic green, thin goo and drips run to dark olive.
 * Wet and a little see-through, with a faint glow so it reads against the black phone in the dark.
 */
export const GOO = {
  thickColour: 0x3f7a1c,
  thinColour: 0x1d3a0c,
  /** White, because the shader multiplies the glow by the slime's own colour at each point. */
  emissive: 0xffffff,
  emissiveIntensity: 0.25,
  roughness: 0.05,
  clearcoat: 1,
  clearcoatRoughness: 0.02,
  transmission: 0.35,
  thickness: 0.004,
  ior: 1.4,
} as const;
