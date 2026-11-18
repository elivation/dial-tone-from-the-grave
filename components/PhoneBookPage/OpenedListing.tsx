import type { Listing } from '@/lib/sse';
import { ListingDetail } from './ListingDetail';
import { ResidentDetail } from './ResidentDetail';

/** The entry a click on the 3D page opened: the business or resident dialog, with its Dial button. */
export function OpenedListing({
  listing,
  onClose,
  onDial,
}: {
  listing: Listing;
  onClose: () => void;
  onDial?: ((digits: string) => void) | undefined;
}) {
  return 'surname' in listing ? (
    <ResidentDetail resident={listing} onClose={onClose} onDial={onDial} />
  ) : (
    <ListingDetail listing={listing} onClose={onClose} onDial={onDial} />
  );
}
