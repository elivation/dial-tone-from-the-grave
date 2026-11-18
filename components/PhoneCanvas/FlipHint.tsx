'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { flipStripGeometry } from './bookGeometry';
import type { PageSide } from './flipStrip';

const RAMP_STEPS = 16;
/** How dark the thumbed edge gets at the very edge of the page, 0 to 255. */
const EDGE_ALPHA = 70;

/** A one row gradient, clear at the strip's inner edge and a worn brown at the page edge. */
function rampTexture(): THREE.DataTexture {
  const data = new Uint8Array(RAMP_STEPS * 4);
  for (let i = 0; i < RAMP_STEPS; i++) {
    const t = i / (RAMP_STEPS - 1);
    data.set([58, 42, 20, Math.round(EDGE_ALPHA * t * t)], i * 4);
  }
  const texture = new THREE.DataTexture(data, RAMP_STEPS, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A faint shading along a page's outer edge, like paper worn by thumbs, where a click turns the
 * page. It is only a picture: it takes no clicks, so the page underneath still hears them.
 */
export function FlipHint({ side, visible }: { side: PageSide; visible: boolean }) {
  const geometry = useMemo(() => flipStripGeometry(side === 'left' ? 'L' : 'R'), [side]);
  const ramp = useMemo(() => rampTexture(), []);
  useEffect(
    () => () => {
      geometry.dispose();
      ramp.dispose();
    },
    [geometry, ramp],
  );
  return (
    <mesh name={`flip-hint-${side}`} geometry={geometry} visible={visible} raycast={() => null}>
      <meshBasicMaterial map={ramp} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
