import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const css = readFileSync(path.join(__dirname, 'globals.css'), 'utf8');

/** The text of a block that opens at the first `{` after `header`, braces balanced. */
function blockAfter(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start === -1) return '';
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  return '';
}

describe('candle flicker', () => {
  const motionOk = blockAfter(css, '@media (prefers-reduced-motion: no-preference)');

  it('[Req 5.4] only animates when the visitor has not asked for less motion', () => {
    expect(motionOk).toContain('.scene-vignette-flicker');
    expect(motionOk).toContain('animation:');
    const outside = css.replace(motionOk, '');
    expect(outside).not.toMatch(/\.scene-vignette[^{]*\{[^}]*animation/);
  });

  it('[Req 5.4] leaves the vignette static: the base class has no animation', () => {
    expect(blockAfter(css, '.scene-vignette {')).not.toContain('animation');
  });

  it('[Req 5.3] stays slow and shallow, well under three flashes a second', () => {
    const frames = blockAfter(css, '@keyframes candle-flicker');
    const stops = frames.match(/\d+%/g) ?? [];
    const seconds = Number(/animation:\s*candle-flicker\s+([\d.]+)s/.exec(motionOk)?.[1]);
    expect(seconds).toBeGreaterThanOrEqual(4);
    expect(stops.length / seconds).toBeLessThan(2);
    const opacities = [...frames.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    expect(opacities.length).toBeGreaterThan(3);
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0.85);
    expect(Math.max(...opacities)).toBeLessThanOrEqual(1);
  });
});

describe('desk backdrop', () => {
  it('[Req 5.3] is built from CSS gradients only, with no image files', () => {
    const rule = blockAfter(css, '.desk-backdrop {');
    expect(rule).toContain('radial-gradient');
    expect(rule).toContain('linear-gradient');
    expect(rule).not.toMatch(/url\(/);
  });
});

describe('fonts', () => {
  it('uses the self-hosted typewriter font for serif UI copy and Nixie One for digits', () => {
    expect(css).toMatch(/--font-serif:\s*var\(--font-special-elite\)/);
    expect(css).toMatch(/--font-mono:\s*var\(--font-nixie-one\)/);
  });
});
