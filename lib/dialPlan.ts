import { EMERGENCY_NUMBERS } from './operators';

/** The ghost operators' numbers. `lib/operators.ts` defines who answers each one. */
export const OPERATOR_NUMBERS = ['1023', '1026', '666', '1313'] as const;

/** Numbers no listing may use, start with, or be the start of. */
export const RESERVED_NUMBERS: string[] = [...OPERATOR_NUMBERS, ...EMERGENCY_NUMBERS];

/**
 * True if `digits` and a reserved number could be confused while dialling: one starts with the
 * other. The call is placed after a two-second pause, so a listing that began with 112 would reach
 * the emergency notice if the caller paused, and a listing that 1023 began with would never ring.
 */
export function conflictsWithReserved(digits: string): boolean {
  return RESERVED_NUMBERS.some((r) => digits.startsWith(r) || r.startsWith(digits));
}

/**
 * A listing's short dial number: five digits, starting 2 to 9 (so it can never begin like an
 * operator or emergency number starting with 1), and clear of every reserved number.
 */
export function isShortDialNumber(digits: string): boolean {
  return /^[2-9]\d{4}$/.test(digits) && !conflictsWithReserved(digits);
}
