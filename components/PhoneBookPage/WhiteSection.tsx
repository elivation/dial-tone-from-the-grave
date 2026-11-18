import { formatDialNumber } from '@/lib/exchange';
import type { ResidentResult } from '@/lib/listingSearch';
import { DialButton } from './DialButton';
import { NoListings } from './NoListings';
import { PANEL } from './panel';

/**
 * The accessible twin of the 3D white pages: the same residents as a plain list, in the printed
 * order (SURNAME Initial, address, suburb, phone). Each row can have a Dial button, so the panel
 * shows on screen while one has focus and stays off-screen otherwise. Screen readers always reach
 * it, because it is never display:none.
 *
 * The surname is capitalised with CSS, not by rewriting the text. Some screen readers spell out
 * all-caps words letter by letter, so the DOM keeps the name as stored and they say it normally.
 * Sighted users still see SURNAME.
 */
export function WhiteSection({
  residents,
  onDial,
}: {
  residents: readonly ResidentResult[];
  /** Dials a resident's short number on the phone. Without it the rows have no Dial button. */
  onDial?: ((digits: string) => void) | undefined;
}) {
  if (residents.length === 0) return <NoListings />;
  return (
    <div className={PANEL}>
      <ul aria-label="Resident listings" className="divide-y divide-stone-400">
        {residents.map((resident) => (
          <li key={resident.id} className="px-3 py-2 text-stone-900">
            <p className="text-base font-bold">
              <span className="uppercase">{resident.surname}</span> {resident.initials}
            </p>
            <p>{resident.address}</p>
            <p>{resident.suburb}</p>
            <p>
              {resident.phone}{' '}
              <span className="text-stone-700">({formatDialNumber(resident.dial_number)})</span>
            </p>
            {onDial && (
              <DialButton
                dialNumber={resident.dial_number}
                name={`${resident.surname} ${resident.initials}`}
                onDial={onDial}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
