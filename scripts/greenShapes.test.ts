// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { greenInside, greenShapes, type Raster } from './greenShapes';

/** A black image with green painted by `paint(x, y)`. */
function image(width: number, height: number, paint: (x: number, y: number) => boolean): Raster {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const green = paint(x, y);
      data[i] = green ? 40 : 20;
      data[i + 1] = green ? 120 : 20;
      data[i + 2] = green ? 20 : 20;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const disc = (cx: number, cy: number, r: number) => (x: number, y: number) =>
  (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

describe('greenShapes', () => {
  it('finds a round blob and measures it as round', () => {
    const shapes = greenShapes(image(200, 200, disc(100, 100, 30)), 100);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.aspect).toBeLessThan(1.2);
    expect(shapes[0]?.cx).toBeCloseTo(100, 0);
  });

  it('measures a thin wire as very elongated', () => {
    const wire = (x: number, y: number) => x >= 20 && x <= 180 && y >= 99 && y <= 101;
    const shapes = greenShapes(image(200, 200, wire), 100);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.aspect).toBeGreaterThan(10);
  });

  it('keeps separate shapes separate, and ignores specks below the minimum size', () => {
    const paint = (x: number, y: number) =>
      disc(50, 50, 20)(x, y) || disc(150, 150, 20)(x, y) || disc(100, 20, 3)(x, y);
    expect(greenShapes(image(200, 200, paint), 200)).toHaveLength(2);
  });

  it('does not count grey, brown or orange as green', () => {
    const data = new Uint8Array(40 * 40 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 150;
      data[i + 1] = 110;
      data[i + 2] = 60;
      data[i + 3] = 255;
    }
    expect(greenShapes({ data, width: 40, height: 40 }, 10)).toHaveLength(0);
  });
});

describe('greenInside', () => {
  const ellipse = { cx: 100, cy: 100, rx: 40, ry: 25 };

  it('counts green inside the ellipse and nothing outside it', () => {
    expect(greenInside(image(200, 200, disc(100, 100, 10)), ellipse)).toBeGreaterThan(250);
    expect(greenInside(image(200, 200, disc(20, 20, 10)), ellipse)).toBe(0);
  });

  it('catches a drip that runs across the card', () => {
    const drip = (x: number, y: number) => y >= 98 && y <= 102 && x >= 20 && x <= 120;
    expect(greenInside(image(200, 200, drip), ellipse)).toBeGreaterThan(0);
  });
});
