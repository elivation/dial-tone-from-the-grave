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
 * The slime: bright lime jelly. Strongly see-through with a glow from inside, so it reads in the
 * dark. Lime in the thick middle, a deeper green at the thin edges, very glossy.
 */
export const GOO = {
  thickColour: 0x8fe000,
  thinColour: 0x3fa000,
  /** How much of the way to the thick colour a thickness gets, as thickness to this power. */
  greenCurve: 0.8,
  /** White, because the shader multiplies the glow by the slime's own colour at each point. */
  emissive: 0xffffff,
  /** Tone mapping washes green towards grey, so the glow leans a little more to pure green. */
  glowTint: [0.75, 1.0, 0.1],
  emissiveIntensity: 1.7,
  roughness: 0.03,
  clearcoat: 1,
  clearcoatRoughness: 0.01,
  transmission: 0.85,
  thickness: 0.012,
  ior: 1.45,
  /** Light that passes through the jelly is tinted this green over this distance in metres. */
  attenuationColour: 0x5fc400,
  attenuationDistance: 0.02,
  /** Old goo dries towards this dark brown-olive, this far at full crust, 0 to 1. */
  crustColour: 0x1a1f08,
  crustDarkening: 0.75,
  /** How rough fully dried goo is. Fresh goo keeps `roughness`. */
  crustRoughness: 0.82,
  /** Soot and dirt caught in the goo. */
  grimeColour: 0x0c0a05,
} as const;

/** Shape of the slime. Lengths are in metres. */
export const GOO_SHAPE = {
  /** No pool comes closer than this to the lowest point of the wheel's top surface round its hole. */
  minClearance: 0.0003,
  /** The fullest holes stand this far below the rim, about 80 percent of the hole's depth. */
  fullGap: { min: 0.0003, max: 0.0008 },
  /** How many holes are that full. */
  fullHoles: 3,
  /** How many holes hold only a film on the floor, and how high that film stands. */
  filmHoles: 2,
  film: { min: 0.00025, max: 0.00045 },
  /** The rest are part full, this fraction of the way from the floor to the highest a pool may go. */
  partFill: { min: 0.2, max: 0.6 },
  /** Old leaks on the number plate, under the ring of holes. */
  stains: { min: 5, max: 7 },
  /** Half the width of a stain before its outline is roughened. */
  stainSize: { min: 0.0012, max: 0.0022 },
  /** Globs left on the webs of wheel between holes. */
  globs: 3,
  /** Fine splatter on the body round the dial. */
  specks: 200,
} as const;

/** The phone book on the desk: where it lies, how far it is turned, and how much smaller than the 0.21 m pages of the reference. */
export const BOOK_POSITION = [0.09, 0, 0.17] as const;
export const BOOK_ROTATION_Y = -0.08;
export const BOOK_SCALE = 0.38;
/** How long the book takes to slide onto the desk, in seconds. Skipped with reduced motion. */
export const BOOK_APPEAR_SECONDS = 0.6;
/** How strong the dust is on the phone body, 0 to 1. A faint film, never patches. */
export const DUST_AMOUNT = 0.12;
/** Vertical field of view of the desk camera, in degrees. */
export const CAMERA_FOV = 32;
/** Fog density at the home camera distance. The camera thins it when it backs away. */
export const FOG_DENSITY = 1.4;

/** The slow wobble of the jelly. Lengths are in metres. */
export const GOO_WOBBLE = {
  /** How far a surface point moves along its normal at most. Small beside the finger holes' clearance. */
  amplitude: 0.00007,
  /** Radians per metre across the surface, so neighbouring points move out of step. */
  frequency: 420,
  /** Radians per second. */
  speed: 1.3,
} as const;
