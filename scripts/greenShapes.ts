/**
 * Pixel checks for the render test. They find the green slime in a screenshot and measure it,
 * so a regression such as thin wires, or goo on the card, fails a test and not just someone's eye.
 */

/** An image as flat RGBA bytes, the way PNG decoders hand it over. */
export type Raster = { data: Uint8Array | Uint8ClampedArray; width: number; height: number };

export type Shape = {
  /** Pixels in the shape. */
  area: number;
  /** Long side over short side. A round blob is near 1, a wire is 6 or more. */
  aspect: number;
  cx: number;
  cy: number;
  /** Cut by the edge of the shot, so its true outline is unknown. */
  edge: boolean;
};

/** Slime green: clearly greener than red or blue, and not black. Orange candle glints and brown wood do not pass. */
function isGreen(r: number, g: number, b: number): boolean {
  return g > r * 1.15 && g > b * 1.5 && g > 28;
}

function greenMask(image: Raster): Uint8Array {
  const mask = new Uint8Array(image.width * image.height);
  for (let i = 0; i < mask.length; i++) {
    const p = i * 4;
    if (isGreen(image.data[p] ?? 0, image.data[p + 1] ?? 0, image.data[p + 2] ?? 0)) mask[i] = 1;
  }
  return mask;
}

/** Every connected patch of green with at least `minArea` pixels, measured. */
export function greenShapes(image: Raster, minArea: number): Shape[] {
  const { width, height } = image;
  const mask = greenMask(image);
  const seen = new Uint8Array(mask.length);
  const shapes: Shape[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    let edge = false;
    while (stack.length) {
      const at = stack.pop() as number;
      const x = at % width;
      const y = (at - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge = true;
      area++;
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
      for (const next of [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        y > 0 ? at - width : -1,
        y < height - 1 ? at + width : -1,
      ]) {
        if (next >= 0 && mask[next] && !seen[next]) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    if (area < minArea) continue;
    const cx = sx / area;
    const cy = sy / area;
    // Eigenvalues of the 2x2 covariance matrix give the long and short spread.
    const a = sxx / area - cx * cx;
    const d = syy / area - cy * cy;
    const b = sxy / area - cx * cy;
    const mid = (a + d) / 2;
    const gap = Math.sqrt(((a - d) / 2) ** 2 + b * b);
    const long = mid + gap;
    const short = Math.max(mid - gap, 1e-9);
    shapes.push({ area, aspect: Math.sqrt(long / short), cx, cy, edge });
  }
  return shapes;
}

/** The card's warm cream face. The black ink and the dark wood around it do not pass. */
function isCardFace(r: number, g: number, b: number): boolean {
  return r > 100 && r > g && g > b && r - b > 25;
}

/**
 * The card as it lies in the shot: its face flood filled from `seed`, with every row and column
 * span closed so the ink counts as card, then grown by `rim` pixels to take in the card's rim.
 * Taken from the shot itself so it follows the perspective of the camera, which a fixed ellipse
 * cannot: the far half of the card is narrower than the near half.
 */
export function cardMask(image: Raster, seed: { x: number; y: number }, rim: number): Uint8Array {
  const { width, height, data } = image;
  const face = new Uint8Array(width * height);
  const stack = [seed.y * width + seed.x];
  face[stack[0] as number] = 1;
  while (stack.length) {
    const at = stack.pop() as number;
    const x = at % width;
    const y = (at - x) / width;
    for (const next of [
      x > 0 ? at - 1 : -1,
      x < width - 1 ? at + 1 : -1,
      y > 0 ? at - width : -1,
      y < height - 1 ? at + width : -1,
    ]) {
      const p = next * 4;
      if (
        next >= 0 &&
        !face[next] &&
        isCardFace(data[p] ?? 0, data[p + 1] ?? 0, data[p + 2] ?? 0)
      ) {
        face[next] = 1;
        stack.push(next);
      }
    }
  }
  const closed = face.slice();
  const fillSpans = (lines: number, along: number, index: (line: number, k: number) => number) => {
    for (let line = 0; line < lines; line++) {
      let first = -1;
      let last = -1;
      for (let k = 0; k < along; k++) {
        if (face[index(line, k)]) {
          if (first < 0) first = k;
          last = k;
        }
      }
      for (let k = first; first >= 0 && k <= last; k++) closed[index(line, k)] = 1;
    }
  };
  fillSpans(height, width, (y, x) => y * width + x);
  fillSpans(width, height, (x, y) => y * width + x);
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!closed[y * width + x]) continue;
      for (let dy = -rim; dy <= rim; dy++) {
        for (let dx = -rim; dx <= rim; dx++) {
          const X = x + dx;
          const Y = y + dy;
          if (dx * dx + dy * dy <= rim * rim && X >= 0 && X < width && Y >= 0 && Y < height)
            mask[Y * width + X] = 1;
        }
      }
    }
  }
  return mask;
}

/**
 * Where the card is in the render checks' dial close-up (1440 by 900 at 4x, clipped to the dial):
 * a point on the face below the "1023", and the rim's width, about 12 shot pixels at top and bottom.
 * A fixed ellipse used to stand in for the card, but it took in the gap round it, where the pools
 * in the far holes show once the goo is bright.
 */
export const CLOSE_UP_CARD = { seed: { x: 456, y: 330 }, rim: 10 } as const;

/** How many green pixels lie on the card, its face and rim, found from `seed` on the face. */
export function greenOnCard(image: Raster, seed: { x: number; y: number }, rim: number): number {
  const card = cardMask(image, seed, rim);
  const green = greenMask(image);
  let count = 0;
  for (let i = 0; i < card.length; i++) if (card[i] && green[i]) count++;
  return count;
}
