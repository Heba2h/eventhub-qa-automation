import type { Decimal } from '@api/models';

// ---------------------------------------------------------------------------------------------
// Booking rules
// ---------------------------------------------------------------------------------------------

/**
 * Booking reference: docs say "EVT-XXXXXX"; the live API returns "<first letter of event title>-XXXXXX"
 * (e.g. "Q-Y0RTZR"). The pattern accepts both so it validates shape without encoding either
 * side of an unresolved product question (README, findings D-04).
 */
export const BOOKING_REF_PATTERN = /^[A-Z0-9]+-[A-Z0-9]{6}$/;

export const MAX_TICKETS_PER_BOOKING = 10;

// ---------------------------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------------------------

/** Normalises API decimals (documented as numbers, returned as strings) to numbers. */
export function toAmount(value: Decimal): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) throw new Error(`Not a numeric amount: ${JSON.stringify(value)}`);
  return amount;
}

/** Business rule from AC2, computed in integer cents to avoid floating point drift. */
export function expectedTotal(unitPrice: Decimal, quantity: number): number {
  return Math.round(toAmount(unitPrice) * 100 * quantity) / 100;
}

/** Parses a displayed currency string such as "$1,234.50" into 1234.5. */
export function parseDisplayedAmount(text: string): number {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  const amount = Number(cleaned);
  if (!cleaned || !Number.isFinite(amount)) throw new Error(`Cannot parse amount from "${text}"`);
  return amount;
}

// ---------------------------------------------------------------------------------------------
// Known issues
// ---------------------------------------------------------------------------------------------

/**
 * Defects found while exploring the application (full write-up in README.md, "Findings").
 * Tests that reproduce a defect are tagged @known-bug and marked `test.fail()`, so:
 *  - the suite stays green while the defect is open, and
 *  - the run turns red ("expected to fail, but passed") the moment it gets fixed,
 *    prompting the team to remove the marker and keep the test as a regression guard.
 */
export const KNOWN_ISSUES = {
  'BUG-01': 'API accepts bookings for events whose date is in the past',
  'BUG-02': 'UI rounds ticket prices and totals to whole dollars ($12.50 shown as $13)',
} as const;

export type KnownIssueId = keyof typeof KNOWN_ISSUES;

export function knownIssue(id: KnownIssueId) {
  return { type: 'issue', description: `${id}: ${KNOWN_ISSUES[id]}` };
}
