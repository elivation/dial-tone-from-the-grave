'use client';

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { applyCardTexture } from './cardTexture';
import { preparePhone } from './preparePhone';
import { PhoneContext } from './useDialGeometry';

export const PHONE_MODEL_URL = '/models/we500.glb';

/** The rotary phone. Children can read the dial with useDialGeometry(). */
export function PhoneModel({ children }: { children?: ReactNode }) {
  // The model uses meshopt compression. drei sets that decoder up by default, and Draco is not needed.
  const gltf = useGLTF(PHONE_MODEL_URL, false);
  const phone = useMemo(() => preparePhone(gltf.scene), [gltf.scene]);

  useLayoutEffect(() => {
    if (phone.card) applyCardTexture(phone.card, phone.dial);
  }, [phone]);

  return (
    <PhoneContext.Provider value={phone}>
      <primitive object={phone.object} />
      {children}
    </PhoneContext.Provider>
  );
}
