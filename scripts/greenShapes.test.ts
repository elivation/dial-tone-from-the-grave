// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { greenOnCard, greenShapes, type Raster } from './greenShapes';

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

  it('marks a shape cut by the edge of the shot, and only that one', () => {
    const paint = (x: number, y: number) => disc(100, 2, 30)(x, y) || disc(100, 120, 30)(x, y);
    const shapes = greenShapes(image(200, 200, paint), 100);
    expect(shapes.map((s) => s.edge).sort()).toEqual([false, true]);
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

/**
 * A dark scene with a warm card: a disc of cream face, a dark ring of ink across it, and green
 * painted by `paint`. The card is what flood fills from `seed`, so its shape follows the shot.
 */
function cardScene(paint: (x: number, y: number) => boolean): Raster {
  const width = 200;
  const height = 200;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const onCard = disc(100, 100, 50)(x, y);
      const ink = onCard && y >= 95 && y <= 99 && x >= 70 && x <= 130;
      const [r, g, b] = paint(x, y)
        ? [40, 120, 20]
        : ink
          ? [30, 25, 40]
          : onCard
            ? [170, 130, 90]
            : [30, 18, 10];
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('greenOnCard', () => {
  const seed = { x: 100, y: 130 };

  it('[Req 1.1] counts goo on the card face, including under the ink', () => {
    const smear = (x: number, y: number) => y >= 94 && y <= 100 && x >= 80 && x <= 120;
    expect(greenOnCard(cardScene(smear), seed, 4)).toBeGreaterThan(200);
  });

  it('[Req 1.1] counts goo on the rim just outside the face', () => {
    const rim = (x: number, y: number) => disc(100, 100, 53)(x, y) && !disc(100, 100, 51)(x, y);
    expect(greenOnCard(cardScene(rim), seed, 4)).toBeGreaterThan(0);
  });

  it('[Req 1.1] ignores goo in the holes beyond the rim', () => {
    const pools = (x: number, y: number) => disc(100, 35, 8)(x, y) || disc(170, 100, 10)(x, y);
    expect(greenOnCard(cardScene(pools), seed, 4)).toBe(0);
  });
});
