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
    while (stack.length) {
      const at = stack.pop() as number;
      const x = at % width;
      const y = (at - x) / width;
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
    shapes.push({ area, aspect: Math.sqrt(long / short), cx, cy });
  }
  return shapes;
}

/** How many green pixels fall inside an ellipse. Used to check the slime stays off the centre card. */
export function greenInside(
  image: Raster,
  ellipse: { cx: number; cy: number; rx: number; ry: number },
): number {
  const mask = greenMask(image);
  let count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const inside =
        ((x - ellipse.cx) / ellipse.rx) ** 2 + ((y - ellipse.cy) / ellipse.ry) ** 2 <= 1;
      if (inside && mask[y * image.width + x]) count++;
    }
  }
  return count;
}
