import { formatDialNumber } from '@/lib/exchange';

/** 44 by 44 CSS pixels is the smallest touch target WCAG 2.5.5 asks for. */
const LARGE = ' min-h-[44px] min-w-[44px] px-5 text-lg';
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
  size = 'normal',
}: {
  dialNumber: string;
  name: string;
  onDial: (digits: string) => void;
  /** The sheet for small screens uses large buttons. */
  size?: 'normal' | 'large';
}) {
  return (
    <button
      type="button"
      aria-label={`Dial ${name}, ${formatDialNumber(dialNumber)}`}
      onClick={() => onDial(dialNumber)}
      className={size === 'large' ? BUTTON + LARGE : BUTTON}
    >
      Dial
    </button>
  );
}
