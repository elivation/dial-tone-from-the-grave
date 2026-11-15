import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as THREE from 'three';
import { gooColourAt, glowWithSlimeColour, paintGoo } from './gooColour';
import { GOO } from './sceneConstants';

const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

describe('gooColourAt', () => {
  it('is deep toxic green where the goo is thick and dark olive where it is thin', () => {
    expect(gooColourAt(1).getHex()).toBe(GOO.thickColour);
    expect(gooColourAt(0).getHex()).toBe(GOO.thinColour);
  });

  it('never leaves the range between the two colours', () => {
    expect(gooColourAt(5).getHex()).toBe(GOO.thickColour);
    expect(gooColourAt(-3).getHex()).toBe(GOO.thinColour);
  });

  it('gets lighter the thicker it is', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (a, b) => {
          const [thin, thick] = a <= b ? [a, b] : [b, a];
          return luminance(gooColourAt(thin)) <= luminance(gooColourAt(thick)) + 1e-12;
        },
      ),
    );
  });

  it('stays green at every thickness, never grey or neon', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (t) => {
        const c = gooColourAt(t);
        return c.g > c.r && c.g > c.b && c.g < 0.5;
      }),
    );
  });
});

describe('paintGoo', () => {
  it('gives every vertex a colour from its own thickness', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    paintGoo(geometry, (_, position) => (position.y > 0 ? 1 : 0));
    const color = geometry.getAttribute('color');
    const position = geometry.getAttribute('position');
    expect(color.count).toBe(position.count);
    for (let i = 0; i < position.count; i++) {
      const painted = new THREE.Color().fromBufferAttribute(color, i);
      const expected = gooColourAt(position.getY(i) > 0 ? 1 : 0);
      expect(painted.getHex()).toBe(expected.getHex());
    }
  });
});

describe('glowWithSlimeColour', () => {
  const fragmentShader =
    'vec3 totalEmissiveRadiance = emissive;\n#include <emissivemap_fragment>\nmore();';

  it('makes the glow take the slime colour at each point, so thin edges glow olive', () => {
    const material = new THREE.MeshPhysicalMaterial({ vertexColors: true });
    glowWithSlimeColour(material);
    const shader = { fragmentShader } as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance *= vColor.rgb;');
    // It adds to the standard chunk, after it, and leaves the rest of the shader alone.
    expect(shader.fragmentShader.indexOf('#include <emissivemap_fragment>')).toBeLessThan(
      shader.fragmentShader.indexOf('totalEmissiveRadiance *= vColor.rgb;'),
    );
    expect(shader.fragmentShader).toContain('more();');
  });

  it('gets its own compiled program, apart from other materials', () => {
    const material = new THREE.MeshPhysicalMaterial({ vertexColors: true });
    glowWithSlimeColour(material);
    expect(material.customProgramCacheKey()).toBe('goo-slime');
  });
});
