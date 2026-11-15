/** Small deterministic noise helpers, so every render of the scene looks the same. */

/** Park-Miller generator. Same seed, same sequence, values in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = Math.max(1, Math.floor(seed)) % 2147483647;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483647;
  };
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  const blended = a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  // The blend can drift a hair outside [0, 1] through float rounding.
  return Math.min(1, Math.max(0, blended));
}

/** Fractal value noise in [0, 1). */
export function fbm(x: number, y: number, octaves = 5): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency);
    frequency *= 2;
    amplitude *= 0.5;
  }
  return sum;
}
