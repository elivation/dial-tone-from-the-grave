import { describe, it, expect, beforeEach } from 'vitest';
import { GOO_WOBBLE } from './sceneConstants';
import { gooWobbleUniforms, updateGooWobble, wobbleAmplitude, WOBBLE_VERTEX } from './gooWobble';

describe('goo wobble', () => {
  beforeEach(() => {
    gooWobbleUniforms.gooTime.value = 0;
  });

  it('[Req 9.4] has no amplitude under reduced motion and a small one otherwise', () => {
    expect(wobbleAmplitude(true)).toBe(0);
    expect(wobbleAmplitude(false)).toBe(GOO_WOBBLE.amplitude);
    expect(GOO_WOBBLE.amplitude).toBeLessThan(0.0001);
  });

  it('[Req 9.4] holds the jelly still and stops the clock under reduced motion', () => {
    updateGooWobble(3, false);
    expect(gooWobbleUniforms.gooTime.value).toBe(3);
    updateGooWobble(9, true);
    expect(gooWobbleUniforms.gooAmplitude.value).toBe(0);
    expect(gooWobbleUniforms.gooTime.value).toBe(3);
  });

  it('[Req 1.1] moves points along the normal only', () => {
    expect(WOBBLE_VERTEX).toContain('transformed += normal * gooWave * gooAmplitude;');
  });
});
