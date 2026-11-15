'use client';

import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Candle bloom and filmic tones. The vignette and grain are CSS overlays (see globals.css).
 * AgX matched the reference's colour far better than ACES, which turned the desk too orange.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.2}
        radius={0.4}
        mipmapBlur
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
