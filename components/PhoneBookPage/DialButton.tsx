import { formatDialNumber } from '@/lib/exchange';

const BUTTON =
  'pointer-events-auto rounded border border-stone-900 px-3 py-1 font-serif text-stone-900 hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900';

/**
 * Rings a listing from the book. It hands the five digit short number to the phone, which dials
 * it digit by digit like a caller would. The exchange letters in the printed number are for
 * reading only and are never dialled.
 */
export function DialButton({
  dialNumber,
  name,
  onDial,
}: {
  dialNumber: string;
  name: string;
  onDial: (digits: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Dial ${name}, ${formatDialNumber(dialNumber)}`}
      onClick={() => onDial(dialNumber)}
      className={BUTTON}
    >
      Dial
    </button>
  );
}
