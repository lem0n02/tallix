import { Expense, Settlement } from '../types';

export type UnifiedHistoryItem =
  | {
      kind: 'expense';
      id: string;
      createdAt: string;
      date: string;
      expense: Expense;
    }
  | {
      kind: 'settlement';
      id: string;
      createdAt: string;
      date: string;
      settlement: Settlement;
    };

/**
 * Deterministic descending comparator (Newest first).
 * Primary: createdAt (or date) in descending chronological order.
 * Secondary: unique ID tie-breaker to prevent unstable sort renders.
 */
export function compareHistoryItemsDesc<
  T extends { id: string; createdAt?: string; date?: string; timestamp?: string }
>(a: T, b: T): number {
  const timeA = new Date(a.createdAt || a.date || a.timestamp || 0).getTime();
  const timeB = new Date(b.createdAt || b.date || b.timestamp || 0).getTime();
  if (timeB !== timeA) {
    return timeB - timeA;
  }
  return (b.id || '').localeCompare(a.id || '');
}

/**
 * Builds an interleaved, strictly newest-first unified history list.
 */
export function buildUnifiedHistory(
  expenses: Expense[],
  settlements: Settlement[]
): UnifiedHistoryItem[] {
  const list: UnifiedHistoryItem[] = [];

  expenses.forEach((exp) => {
    list.push({
      kind: 'expense',
      id: exp.id,
      createdAt: exp.createdAt || (exp.date ? `${exp.date}T00:00:00.000Z` : new Date().toISOString()),
      date: exp.date,
      expense: exp,
    });
  });

  settlements.forEach((stl) => {
    list.push({
      kind: 'settlement',
      id: stl.id,
      createdAt: stl.createdAt || new Date().toISOString(),
      date: stl.createdAt ? stl.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
      settlement: stl,
    });
  });

  return list.sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.id.localeCompare(a.id);
  });
}

/**
 * Human-friendly relative or calendar time formatter
 * e.g. "Just now", "5 minutes ago", "Today 1:30 PM", "Yesterday", or "Sep 27, 2026"
 */
export function formatRelativeTime(
  dateInput: string | Date | undefined,
  fallbackFormatFn?: (d: string) => string
): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 0) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (diffSec < 60) {
    return 'Just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const isToday = new Date().toDateString() === date.toDateString();
    if (isToday) {
      return `Today ${timeStr}`;
    }
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `Yesterday ${timeStr}`;
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  if (fallbackFormatFn) {
    return fallbackFormatFn(date.toISOString());
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}
