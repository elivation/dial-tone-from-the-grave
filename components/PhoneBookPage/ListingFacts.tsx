import { formatDialNumber } from '@/lib/exchange';
import type { BusinessResult } from '@/lib/listingSearch';
import { CalledLabel } from './CalledLabel';

/** Name, suburb, numbers, hours and description in the order the printed page reads. */
export function ListingFacts({
  listing,
  nameId,
  called = false,
}: {
  listing: BusinessResult;
  nameId?: string;
  /** The caller has dialled this listing. */
  called?: boolean;
}) {
  return (
    <>
      <strong id={nameId} className="block text-base font-bold">
        {listing.name}
      </strong>
      <span className="block">{listing.suburb}</span>
      <span className="block">
        {listing.phone}{' '}
        <span className="text-stone-700">({formatDialNumber(listing.dial_number)})</span>
      </span>
      <span className="block">{listing.hours}</span>
      <span className="block text-stone-700">{listing.description}</span>
      {called && <CalledLabel />}
    </>
  );
}
