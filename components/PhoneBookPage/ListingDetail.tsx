import { formatDialNumber } from '@/lib/exchange';
import type { BusinessResult } from '@/lib/listingSearch';
import { DetailDialog } from './DetailDialog';

/** The full entry for one business, in a modal dialog. */
export function ListingDetail({
  listing,
  onClose,
  onDial,
}: {
  listing: BusinessResult;
  onClose: () => void;
  /** Dials the listing's short number. The dialog closes first so the phone is in view. */
  onDial?: ((digits: string) => void) | undefined;
}) {
  return (
    <DetailDialog
      title={listing.name}
      rows={[
        { term: 'Category', detail: listing.category },
        { term: 'Address', detail: `${listing.address}, ${listing.suburb}` },
        { term: 'Phone', detail: listing.phone },
        { term: 'Short number', detail: formatDialNumber(listing.dial_number) },
        {
          term: 'Hours',
          detail: listing.is_24hr ? `${listing.hours} (open 24 hours)` : listing.hours,
        },
        { term: 'About', detail: listing.description },
      ]}
      dial={onDial && { dialNumber: listing.dial_number, name: listing.name, onDial }}
      onClose={onClose}
    />
  );
}
