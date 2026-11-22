/**
 * The in-character line shown over the poster while the 3D scene loads. It has no backdrop of its
 * own, because the poster is already the picture. It fades out when `visible` turns false, and
 * with reduced motion it neither fades nor pulses.
 */
export function LoadingVeil({ visible }: { visible: boolean }) {
  return (
    <div
      role={visible ? 'status' : undefined}
      aria-hidden={!visible}
      className={[
        'pointer-events-none absolute inset-x-0 bottom-36 z-10 flex justify-center px-6',
        'transition-opacity duration-500 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <p className="rounded bg-black/60 px-4 py-2 text-center font-serif text-lg italic text-amber-200/90 motion-safe:animate-pulse">
        Connecting you to the exchange...
      </p>
    </div>
  );
}
