import { GOO_WOBBLE } from './sceneConstants';

/** Shared by every slime material, so one write per frame moves all the goo. */
export const gooWobbleUniforms = {
  gooTime: { value: 0 },
  gooAmplitude: { value: GOO_WOBBLE.amplitude as number },
};

/** How far the jelly moves: nothing when the visitor asked for less motion. */
export function wobbleAmplitude(reducedMotion: boolean): number {
  return reducedMotion ? 0 : GOO_WOBBLE.amplitude;
}

/** Sets the shared uniforms for one frame. Under reduced motion the goo is held still. */
export function updateGooWobble(elapsedSeconds: number, reducedMotion: boolean): void {
  gooWobbleUniforms.gooAmplitude.value = wobbleAmplitude(reducedMotion);
  if (!reducedMotion) gooWobbleUniforms.gooTime.value = elapsedSeconds;
}

/**
 * Vertex shader lines that push each point along its normal. The two sine waves run at different
 * rates and the phase follows position, so the surface swells and settles rather than sliding.
 */
export const WOBBLE_VERTEX = `
float gooPhase = dot( position, vec3( 1.0, 0.7, 1.3 ) ) * ${GOO_WOBBLE.frequency.toFixed(1)};
float gooWave = sin( gooPhase + gooTime * ${GOO_WOBBLE.speed.toFixed(2)} ) + 0.6 * sin( gooPhase * 0.53 - gooTime * ${(GOO_WOBBLE.speed * 0.7).toFixed(2)} );
transformed += normal * gooWave * gooAmplitude;`;
