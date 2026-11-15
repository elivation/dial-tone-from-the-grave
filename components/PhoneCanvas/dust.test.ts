import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { DUST_NOISE_SCALES, addDust } from './dust';
import { DUST_AMOUNT } from './sceneConstants';

/** Runs the patch on a stand-in for three's shader, and returns what it wrote. */
function patched(amount: number): { vertex: string; fragment: string } {
  const material = new THREE.MeshStandardMaterial();
  addDust(material, amount);
  const shader = {
    vertexShader: '#include <common>\n#include <worldpos_vertex>',
    fragmentShader: '#include <common>\n#include <roughnessmap_fragment>',
  } as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return { vertex: shader.vertexShader, fragment: shader.fragmentShader };
}

describe('addDust', () => {
  it('is a faint film: the phone gets 0.12 or less', () => {
    expect(DUST_AMOUNT).toBeLessThanOrEqual(0.12);
    expect(patched(DUST_AMOUNT).fragment).toContain(`* ${DUST_AMOUNT.toFixed(2)};`);
  });

  it('is fine grained: every noise scale has cells about a millimetre across or smaller', () => {
    // A scale of 600 means cells of about 1.7 mm. Anything coarser would show as patches.
    for (const scale of DUST_NOISE_SCALES) expect(scale).toBeGreaterThanOrEqual(600);
  });

  it('uses only those fine scales, so there are no large light or dark patches', () => {
    const used = [...patched(DUST_AMOUNT).fragment.matchAll(/vWPos \* (\d+(?:\.\d+)?)/g)].map((m) =>
      Number(m[1]),
    );
    expect(used.length).toBe(DUST_NOISE_SCALES.length);
    for (const scale of used) expect(DUST_NOISE_SCALES).toContain(scale);
  });

  it('settles only on surfaces that face up', () => {
    const { fragment } = patched(DUST_AMOUNT);
    expect(fragment).toContain('normalize(vWNorm).y');
    expect(fragment).toContain('smoothstep(0.6, 0.98, up)');
  });

  it('gets its own compiled program for each strength', () => {
    const a = new THREE.MeshStandardMaterial();
    const b = new THREE.MeshStandardMaterial();
    addDust(a, 0.12);
    addDust(b, 0.3);
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });
});
