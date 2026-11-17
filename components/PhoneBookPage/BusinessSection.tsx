'use client';
import { useRef, useState } from 'react';
import type { BusinessResult } from '@/lib/listingSearch';
import { AdvertCard, ROW_BUTTON } from './AdvertCard';
import { ListingDetail } from './ListingDetail';
import { ListingFacts } from './ListingFacts';

// Off-screen until something inside has focus, then it shows as a panel so a sighted keyboard
// user can see what they are on (WCAG 2.4.7). Never display:none, so screen readers still read it.
const PANEL =
  'absolute -left-[10000px] top-0 w-[min(40rem,100vw)] font-serif ' +
  'focus-within:pointer-events-auto focus-within:top-2 focus-within:left-2 focus-within:z-30 ' +
  'focus-within:max-h-[70vh] focus-within:overflow-y-auto focus-within:rounded ' +
  'focus-within:border-2 focus-within:border-stone-900 focus-within:bg-amber-50';

/**
 * The accessible twin of the 3D business page: the same listings as a plain list. Activating a
 * row opens its full details, and closing them puts focus back on that row.
 */
export function BusinessSection({ listings }: { listings: readonly BusinessResult[] }) {
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

  return (
    <div className={PANEL}>
      <ul aria-label="Business listings" className="divide-y divide-stone-400">
        {listings.map((listing) => (
          <li key={listing.id}>
            {listing.is_advert ? (
              <AdvertCard listing={listing} onOpen={(button) => show(listing, button)} />
            ) : (
              <button
                type="button"
                onClick={(event) => show(listing, event.currentTarget)}
                className={ROW_BUTTON}
              >
                <ListingFacts listing={listing} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {open && <ListingDetail listing={open} onClose={close} />}
    </div>
  );
}
