/**
 * Money Precision Utility for Tallix Financial Engine
 * 
 * Strict separation of:
 * 1. ORIGINAL USER-ENTERED AMOUNT (stored as exact number and in integer minor units / paisa)
 * 2. CALCULATED AMOUNT (computed separately using integer arithmetic, never mutating original transaction amounts)
 * 
 * Guarantees zero floating-point drift (e.g. 120 remains 120.00, 130 remains 130.00, 44 remains 44.00, 57 remains 57.00).
 */

/**
 * Converts any currency amount to exact integer minor units (paisa/cents).
 * Uses string parsing to eliminate IEEE-754 binary floating-point multiplication bugs
 * (e.g., 1.14 * 100 === 113.99999999999999 in JS).
 */
export function toPaisa(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).trim();
  if (!str) return 0;

  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  // Split on decimal point
  const parts = cleanStr.split('.');
  const wholePart = parts[0].replace(/\D/g, '') || '0';
  const fracPart = (parts.length > 1 ? parts[1].replace(/\D/g, '') + '00' : '00').slice(0, 2);

  const whole = parseInt(wholePart, 10) || 0;
  const frac = parseInt(fracPart, 10) || 0;

  const total = whole * 100 + frac;
  return isNegative ? -total : total;
}

/**
 * Converts integer paisa back to a numeric float value.
 */
export function fromPaisa(paisa: number): number {
  if (isNaN(paisa) || !isFinite(paisa)) return 0;
  const isNeg = paisa < 0;
  const abs = Math.abs(Math.round(paisa));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const result = whole + frac / 100;
  return isNeg ? -result : result;
}

/**
 * Parses and returns the exact decimal representation of money with at most 2 decimal places.
 * Guarantees exact representation: 120 -> 120, 130 -> 130, 44 -> 44, 57 -> 57, 12.34 -> 12.34.
 */
export function parseExactMoney(val: number | string | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  return fromPaisa(toPaisa(val));
}

/**
 * Formats a monetary value to a standard two-decimal string, e.g. "120.00", "1,250.50".
 */
export function formatExactMoney(val: number | string | null | undefined): string {
  const paisa = toPaisa(val);
  const isNeg = paisa < 0;
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const wholeFormatted = whole.toLocaleString('en-US');
  return `${isNeg ? '-' : ''}${wholeFormatted}.${frac}`;
}

/**
 * Splits an amount equally among a given count of members in integer paisa,
 * distributing remainder minor units (cents) deterministically one by one.
 * 
 * Sum of returned split amounts is mathematically GUARANTEED to equal totalAmount in paisa!
 */
export function splitExactAmount(totalAmount: number | string, count: number): number[] {
  if (count <= 0) return [];
  const totalPaisa = toPaisa(totalAmount);
  const isNeg = totalPaisa < 0;
  const absPaisa = Math.abs(totalPaisa);

  const baseShare = Math.floor(absPaisa / count);
  let remainder = absPaisa - (baseShare * count);

  const splits: number[] = [];
  for (let i = 0; i < count; i++) {
    let share = baseShare;
    if (remainder > 0) {
      share += 1;
      remainder -= 1;
    }
    splits.push(isNeg ? -fromPaisa(share) : fromPaisa(share));
  }
  return splits;
}

/**
 * Sums an array of amounts using integer paisa to prevent accumulator drift.
 */
export function sumExactAmounts(amounts: (number | string | null | undefined)[]): number {
  let totalPaisa = 0;
  for (const amt of amounts) {
    totalPaisa += toPaisa(amt);
  }
  return fromPaisa(totalPaisa);
}

/**
 * Subtracts b from a using integer paisa.
 */
export function subtractExactAmounts(
  a: number | string | null | undefined,
  b: number | string | null | undefined
): number {
  return fromPaisa(toPaisa(a) - toPaisa(b));
}
