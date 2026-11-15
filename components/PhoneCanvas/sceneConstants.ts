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

/** Shape of the slime. Lengths are in fractions of a hole's diameter unless it says otherwise. */
export const GOO_SHAPE = {
  /** How far a drip runs past the rim of its hole. */
  dripLength: { min: 0.4, max: 0.7 },
  /** At most this many holes drip. At least two do. */
  maxDrips: 3,
  /** A hole counts as in the lower half of the dial if its outward direction points this far downhill, 0 to 1. */
  lowerHalf: 0.5,
  /** How full an ordinary hole is, as a fraction of its depth. These are low puddles. */
  fill: { min: 0.12, max: 0.38 },
  /** Holes this full reach the rim, and get goo smeared over part of it. */
  fullFill: { min: 0.9, max: 1 },
  /** How much the middle of the surface rises above its edge, in metres. A puddle is nearly flat, a full hole bulges. */
  dome: { puddle: 0.0005, full: 0.0011 },
} as const;

/** How strong the dust is on the phone body, 0 to 1. A faint film, never patches. */
export const DUST_AMOUNT = 0.12;
