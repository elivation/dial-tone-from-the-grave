'use client';
import { useRef, useState } from 'react';
import type { BusinessResult } from '@/lib/listingSearch';
import { AdvertCard, ROW_BUTTON } from './AdvertCard';
import { ListingDetail } from './ListingDetail';
import { ListingFacts } from './ListingFacts';
import { NoListings } from './NoListings';
import { NO_CALLS } from './CalledLabel';
import { PANEL } from './panel';

/**
 * The accessible twin of the 3D business page: the same listings as a plain list. Activating a
 * row opens its full details, and closing them puts focus back on that row.
 */
export function BusinessSection({
  listings,
  onDial,
  calledIds = NO_CALLS,
}: {
  listings: readonly BusinessResult[];
  /** Listings the caller has dialled. They are labelled "called". */
  calledIds?: readonly string[];
  onDial?: ((digits: string) => void) | undefined;
}) {
  const [open, setOpen] = useState<BusinessResult | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  const show = (listing: BusinessResult, button: HTMLButtonElement) => {
    opener.current = button;
    setOpen(listing);
  };
  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };

  if (listings.length === 0) return <NoListings />;
  return (
    <div className={PANEL}>
      <ul aria-label="Business listings" className="divide-y divide-stone-400">
        {listings.map((listing) => (
          <li key={listing.id}>
            {listing.is_advert ? (
              <AdvertCard
                listing={listing}
                called={calledIds.includes(listing.id)}
                onOpen={(button) => show(listing, button)}
              />
            ) : (
              <button
                type="button"
                onClick={(event) => show(listing, event.currentTarget)}
                className={ROW_BUTTON}
              >
                <ListingFacts listing={listing} called={calledIds.includes(listing.id)} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {open && <ListingDetail listing={open} onClose={close} onDial={onDial} />}
    </div>
  );
}
