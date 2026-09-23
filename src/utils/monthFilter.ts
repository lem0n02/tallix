import { Expense } from '../types';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Returns the current year-month logical key formatted as YYYY-MM (e.g., "2026-09").
 */
export const getCurrentMonthKey = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Extracts the YYYY-MM logical month key from an expense date string.
 * Handles ISO strings, YYYY-MM-DD dates, and standard date strings.
 */
export const getExpenseMonthKey = (dateStr?: string): string | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  // Fast path for YYYY-MM prefix if valid
  if (/^\d{4}-(0[1-9]|1[0-2])/.test(trimmed)) {
    return trimmed.substring(0, 7);
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  return null;
};

/**
 * Formats a logical month key ("2026-09" or "ALL") into human-friendly display text:
 * "September 2026", "August 2026", or "All Time".
 */
export const formatMonthDisplay = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') {
    return 'All Time';
  }

  const parts = monthKey.split('-');
  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (!isNaN(year) && monthIdx >= 0 && monthIdx < 12) {
      return `${MONTH_NAMES[monthIdx]} ${year}`;
    }
  }

  return monthKey;
};

/**
 * Returns an array of available month keys sorted in descending chronological order.
 * Always includes the current month.
 */
export const getAvailableMonthKeys = (
  expenses: Expense[] = [],
  currentMonthKey: string = getCurrentMonthKey()
): string[] => {
  const monthSet = new Set<string>();

  // Always include the current month
  monthSet.add(currentMonthKey);

  // Collect historical months from transaction data
  for (const exp of expenses) {
    const key = getExpenseMonthKey(exp.date);
    if (key) {
      monthSet.add(key);
    }
  }

  // Sort descending: e.g. "2026-09", "2026-08", "2026-07"
  return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
};

/**
 * Filters an expense array by the selected logical month key.
 * If "ALL" is selected, returns all expenses without filtering.
 */
export const filterExpensesByMonth = (
  expenses: Expense[] = [],
  selectedMonth: string
): Expense[] => {
  if (!selectedMonth || selectedMonth === 'ALL') {
    return expenses;
  }

  return expenses.filter((exp) => getExpenseMonthKey(exp.date) === selectedMonth);
};
