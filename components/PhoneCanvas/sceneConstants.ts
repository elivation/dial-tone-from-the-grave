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
 * The slime. Murky: near black olive, with deep toxic green only in the thick middle, where light
 * gets into it. Wet and a little see-through there, with a faint glow so it reads in the dark.
 */
export const GOO = {
  thickColour: 0x3f7a1c,
  thinColour: 0x1a2410,
  /** How much of the way to the green a thickness gets, as thickness to this power. Higher keeps the edges murky. */
  greenCurve: 2.4,
  /** White, because the shader multiplies the glow by the slime's own colour at each point. */
  emissive: 0xffffff,
  emissiveIntensity: 0.12,
  roughness: 0.05,
  clearcoat: 1,
  clearcoatRoughness: 0.02,
  transmission: 0.35,
  thickness: 0.004,
  ior: 1.4,
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
