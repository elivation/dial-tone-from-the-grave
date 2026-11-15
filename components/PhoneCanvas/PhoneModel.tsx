'use client';

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { applyCardTexture } from './cardTexture';
import { preparePhone } from './preparePhone';
import { createGooPainter, type GooPainter } from './gooPainter';
import type { PreparedPhone } from './preparePhone';
import { GooPainterContext, PhoneContext } from './useDialGeometry';

export const PHONE_MODEL_URL = '/models/we500.glb';

/**
 * One painter per prepared phone. React may run a memo twice in development, and painting twice
 * would double every smear, so the painter is kept here rather than made again. It lives as long
 * as the phone: the scene stays up for the life of the page, and a reload starts clean.
 */
const painters = new WeakMap<PreparedPhone, GooPainter>();
function painterFor(phone: PreparedPhone): GooPainter {
  let painter = painters.get(phone);
  if (!painter) {
    painter = createGooPainter(phone);
    painters.set(phone, painter);
  }
  return painter;
}

/** The rotary phone. Children can read the dial with useDialGeometry(). */
export function PhoneModel({ children }: { children?: ReactNode }) {
  // The model uses meshopt compression. drei sets that decoder up by default, and Draco is not needed.
  const gltf = useGLTF(PHONE_MODEL_URL, false);
  const phone = useMemo(() => preparePhone(gltf.scene), [gltf.scene]);
  const painter = useMemo(() => painterFor(phone), [phone]);

  useLayoutEffect(() => {
    if (phone.card) applyCardTexture(phone.card, phone.dial);
  }, [phone]);

  return (
    <PhoneContext.Provider value={phone}>
      <GooPainterContext.Provider value={painter}>
        <primitive object={phone.object} />
        {children}
      </GooPainterContext.Provider>
    </PhoneContext.Provider>
  );
}
