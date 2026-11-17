import { useEffect, useId, useRef } from 'react';
import { formatDialNumber } from '@/lib/exchange';
import type { BusinessResult } from '@/lib/listingSearch';

/** The full entry for one listing, in a modal dialog. The browser handles Escape and the focus trap. */
export function ListingDetail({
  listing,
  onClose,
}: {
  listing: BusinessResult;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(26rem,92vw)] rounded border-2 border-stone-900 bg-amber-50 p-5 font-serif text-stone-900 backdrop:bg-black/70"
    >
      <h2 id={titleId} className="text-xl font-bold">
        {listing.name}
      </h2>
      <dl className="mt-3 space-y-1">
        <Row term="Category" detail={listing.category} />
        <Row term="Address" detail={`${listing.address}, ${listing.suburb}`} />
        <Row term="Phone" detail={listing.phone} />
        <Row term="Short number" detail={formatDialNumber(listing.dial_number)} />
        <Row
          term="Hours"
          detail={listing.is_24hr ? `${listing.hours} (open 24 hours)` : listing.hours}
        />
        <Row term="About" detail={listing.description} />
      </dl>
      <button
        ref={closeRef}
        type="button"
        onClick={() => dialogRef.current?.close()}
        className="mt-4 rounded border border-stone-900 px-4 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
      >
        Close
      </button>
    </dialog>
  );
}

function Row({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="text-sm font-bold text-stone-700">{term}</dt>
      <dd>{detail}</dd>
    </div>
  );
}
