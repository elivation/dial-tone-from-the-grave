import { formatDialNumber } from '@/lib/exchange';
import type { ResidentResult } from '@/lib/listingSearch';
import { PANEL } from './panel';

/**
 * The accessible twin of the 3D white pages: the same residents as a plain list, in the printed
 * order (SURNAME Initial, address, suburb, phone). Rows are read-only for now, so there is
 * nothing to focus and the panel stays off-screen for sighted users. Screen readers still reach
 * it, because it is never display:none.
 *
 * The surname is capitalised with CSS, not by rewriting the text. Some screen readers spell out
 * all-caps words letter by letter, so the DOM keeps the name as stored and they say it normally.
 * Sighted users still see SURNAME.
 */
export function WhiteSection({ residents }: { residents: readonly ResidentResult[] }) {
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
          </li>
        ))}
      </ul>
    </div>
  );
}
