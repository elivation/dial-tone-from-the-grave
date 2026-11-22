/** Sizes of the stills in public/poster, written by scripts/makePoster.mjs from the live scene. */
export const POSTER_SIZES = {
  landscape: { width: 1600, height: 1000 },
  portrait: { width: 780, height: 1688 },
} as const;

export const POSTER_ALT =
  'A black rotary phone on a dark wooden desk, its coiled cord beside a lit candle and a small spider, with the rest of the room in darkness.';

/**
 * A still of the 3D desk. It is what the page shows until the first tap, so the main thread has no
 * three.js to run while the page loads. It fades out once the scene has drawn its first frame, and
 * not at all (it is simply gone) when the visitor asks for less motion.
 */
export function ScenePoster({ hidden }: { hidden: boolean }) {
  const { landscape, portrait } = POSTER_SIZES;
  return (
    <div
      aria-hidden={hidden || undefined}
      className={[
        'pointer-events-none absolute inset-0 z-[5] transition-[opacity,visibility] duration-500',
        'motion-reduce:transition-none',
        hidden ? 'invisible opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <picture>
        <source
          media="(orientation: portrait)"
          type="image/avif"
          srcSet="/poster/desk-portrait.avif"
          width={portrait.width}
          height={portrait.height}
        />
        <source
          media="(orientation: portrait)"
          type="image/webp"
          srcSet="/poster/desk-portrait.webp"
          width={portrait.width}
          height={portrait.height}
        />
        <source
          type="image/avif"
          srcSet="/poster/desk-landscape.avif"
          width={landscape.width}
          height={landscape.height}
        />
        {/* A plain img inside picture: next/image cannot swap crops by orientation, and these files are
            already sized and encoded once, so the image optimiser would only add a second pass. */}
        <img
          src="/poster/desk-landscape.webp"
          alt={POSTER_ALT}
          width={landscape.width}
          height={landscape.height}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
    </div>
  );
}
