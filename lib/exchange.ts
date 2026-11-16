/**
 * Invented telephone exchanges of The Dead Pages. An old directory printed a number with the first
 * letters of its exchange, so 61001 on the Holloway exchange reads "HO 6-1001". The letters are
 * only printed, never dialled: the short number is the five digits.
 */
export const EXCHANGES: Record<string, { code: string; name: string }> = {
  '2': { code: 'AS', name: 'Ashgrove' },
  '3': { code: 'DU', name: 'Duskvale' },
  '4': { code: 'GL', name: 'Gloaming' },
  '5': { code: 'KN', name: 'Knell' },
  '6': { code: 'HO', name: 'Holloway' },
  '7': { code: 'MO', name: 'Mourne' },
  '8': { code: 'RA', name: 'Ravenhill' },
  '9': { code: 'WY', name: 'Wychwood' },
};

/** The exchange a short number belongs to, or null if it is not a short number. */
export function exchangeOf(digits: string): { code: string; name: string } | null {
  return /^[2-9]\d{4}$/.test(digits) ? (EXCHANGES[digits[0] as string] ?? null) : null;
}

/** "61001" prints as "HO 6-1001". Anything else is returned as it is. */
export function formatDialNumber(digits: string): string {
  const exchange = exchangeOf(digits);
  return exchange ? `${exchange.code} ${digits[0]}-${digits.slice(1)}` : digits;
}
