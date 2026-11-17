import { useId } from 'react';
import type { BusinessResult } from '@/lib/listingSearch';
import { ListingFacts } from './ListingFacts';

export const ROW_BUTTON =
  'block w-full rounded px-3 py-2 text-left text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900';

/** A paid advert, boxed like the small ads in a printed directory. */
export const AdvertCard = ({
  listing,
  onOpen,
}: {
  listing: BusinessResult;
  onOpen: (button: HTMLButtonElement) => void;
}) => {
  const id = useId();
  return (
    <button
      type="button"
      aria-labelledby={`${id}-label ${id}-name`}
      onClick={(event) => onOpen(event.currentTarget)}
      className={`${ROW_BUTTON} border-2 border-double border-stone-900 bg-amber-100`}
    >
      <span id={`${id}-label`} className="block text-xs font-bold tracking-widest uppercase">
        Advert
      </span>
      <ListingFacts listing={listing} nameId={`${id}-name`} />
    </button>
  );
};
