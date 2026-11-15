/** Candlelit screen shown while the scene loads. Fades out when `visible` turns false. */
export function LoadingVeil({ visible }: { visible: boolean }) {
  return (
    <div
      role={visible ? 'status' : undefined}
      aria-hidden={!visible}
      className={[
        'pointer-events-none absolute inset-0 z-10 flex items-center justify-center',
        'bg-[radial-gradient(ellipse_at_50%_55%,#2a1608_0%,#0b0604_55%,#000_100%)]',
        'transition-opacity duration-700 motion-reduce:duration-200',
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <span className="sr-only">Loading the switchboard</span>
      <p className="max-w-xs px-6 text-center font-serif text-lg italic text-amber-200/80 motion-safe:animate-pulse">
        In 1998, the line went dead. Tonight, someone picked up.
      </p>
    </div>
  );
}
