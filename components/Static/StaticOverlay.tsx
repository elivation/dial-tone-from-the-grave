'use client';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

/**
 * TV static over the whole screen, for a wrong number. It is decoration only: hidden from
 * assistive technology, and it lets every click and key press through to the phone underneath.
 *
 * Flashing (WCAG 2.3.1): the noise alternates between 10% and 22% opacity twice a second, under
 * the limit of three flashes a second, and at that opacity it never gets bright. With reduced
 * motion there is no alternation at all, only a 200 ms fade to a steady veil.
 */
export function StaticOverlay({ visible }: { visible: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      className={[
        'static-overlay pointer-events-none fixed inset-0 z-30',
        reducedMotion ? 'static-overlay-fade' : 'static-overlay-animated',
      ].join(' ')}
    />
  );
}
