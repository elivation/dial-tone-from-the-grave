'use client';

import { createContext, useContext } from 'react';
import type { DialGeometry } from './dialGeometry';
import type { PreparedPhone } from './preparePhone';

export const PhoneContext = createContext<PreparedPhone | null>(null);

/** The prepared phone: its object, finger wheel, card and goo. Only works under PhoneModel. */
export function usePreparedPhone(): PreparedPhone {
  const phone = useContext(PhoneContext);
  if (!phone) throw new Error('usePreparedPhone must be used inside PhoneModel.');
  return phone;
}

/**
 * Centre, normal and in-plane axes of the dial, measured from the finger wheel.
 * Rotate the wheel about `normal` through `centre`. Do not use the wheel's own z axis, the model is tilted.
 */
export function useDialGeometry(): DialGeometry {
  return usePreparedPhone().dial;
}
