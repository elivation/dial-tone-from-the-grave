import { PANEL } from './panel';
import { NO_LISTINGS_MESSAGE } from './sections';
/** What a section of the book says when the search found nothing for it. */
export function NoListings() {
  return (
    <div className={PANEL}>
      <p className="px-3 py-2 text-stone-900">{NO_LISTINGS_MESSAGE}</p>
    </div>
  );
}
