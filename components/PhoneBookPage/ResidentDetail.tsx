import { formatDialNumber } from '@/lib/exchange';
import type { ResidentResult } from '@/lib/listingSearch';
import { DetailDialog } from './DetailDialog';

/** The full entry for one resident of the white pages, in a modal dialog. */
export function ResidentDetail({
  resident,
  onClose,
  onDial,
}: {
  resident: ResidentResult;
  onClose: () => void;
  onDial?: ((digits: string) => void) | undefined;
}) {
  const name = `${resident.surname} ${resident.initials}`;
  return (
    <DetailDialog
      title={name}
      rows={[
        { term: 'Address', detail: `${resident.address}, ${resident.suburb}` },
        { term: 'Phone', detail: resident.phone },
        { term: 'Short number', detail: formatDialNumber(resident.dial_number) },
      ]}
      dial={onDial && { dialNumber: resident.dial_number, name, onDial }}
      onClose={onClose}
    />
  );
}
