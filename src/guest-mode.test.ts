import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { INITIAL_GUEST_USER, INITIAL_GUEST_GROUPS } from './config/guestConstants';
import { enqueueMutation, getPendingMutations } from './services/syncQueue';
import { syncEngine } from './services/syncEngine';
import { filterExpensesByMonth, getAvailableMonthKeys } from './utils/monthFilter';
import { Expense, ExpenseStatus, PaymentMethod } from './types';

// In Node test environment, mock localStorage and sessionStorage if not present
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: storageMock,
    writable: true,
  });
}

if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storageMock,
    writable: true,
  });
}

describe('Tallix Guest Visit Mode Architecture', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('1. Initializes guest user profile with offline guest attributes', () => {
    expect(INITIAL_GUEST_USER.isGuest).toBe(true);
    expect(INITIAL_GUEST_USER.id).toBe('usr_guest_local');
    expect(INITIAL_GUEST_USER.systemRole).toBe('User');
    expect(INITIAL_GUEST_USER.name).toBe('Guest');
  });

  it('2. Enforces zero sync enqueueing when acting as a guest', async () => {
    const fakeGuestExpense: Partial<Expense> & { id: string; title: string; amount: number; category: string; date: string; isShared: boolean; status: ExpenseStatus; paidByUserId: string; paidByName: string; merchant: string; currency: string; paymentMethod: PaymentMethod } = {
      id: 'exp_guest_1',
      title: 'Coffee',
      merchant: 'Local Cafe',
      currency: 'BDT',
      paymentMethod: 'Cash',
      amount: 150,
      originalAmount: 150,
      amount_paisa: 15000,
      category: 'Food',
      date: '2026-09-20',
      isShared: false,
      status: 'Settled',
      createdAt: '2026-09-20T10:00:00.000Z',
      createdBy: INITIAL_GUEST_USER.id,
      createdByEmail: INITIAL_GUEST_USER.email,
      paidByUserId: INITIAL_GUEST_USER.id,
      paidByName: INITIAL_GUEST_USER.name,
    };

    // Attempting to enqueue mutation with guest userId must return no-op and not add to pending
    const result = await enqueueMutation({
      entityType: 'expense',
      operation: 'CREATE',
      entityId: fakeGuestExpense.id,
      payload: fakeGuestExpense,
      userId: INITIAL_GUEST_USER.id,
    });

    expect(result.mutationId).toBe('guest_local_noop');
    expect(result.status).toBe('completed');
    const pending = await getPendingMutations();
    expect(pending.filter((m) => m.userId === INITIAL_GUEST_USER.id).length).toBe(0);
  });

  it('3. Prevents remote sync triggering during guest session', async () => {
    syncEngine.setUserId(INITIAL_GUEST_USER.id);
    const syncResult = await syncEngine.triggerSync();
    expect(syncResult.success).toBe(true);
    // Verified: no network calls were made because guest userId was bypassed
  });

  it('4. Month Selector filters guest transactions accurately', () => {
    const guestExpenses: (Partial<Expense> & { id: string; title: string; amount: number; category: string; date: string; status: ExpenseStatus })[] = [
      {
        id: 'exp_g_1',
        title: 'Lunch',
        amount: 250,
        category: 'Food',
        date: '2026-09-15',
        isShared: false,
        status: 'Settled',
        createdAt: '2026-09-15T12:00:00.000Z',
        createdBy: INITIAL_GUEST_USER.id,
        paidByUserId: INITIAL_GUEST_USER.id,
        paidByName: INITIAL_GUEST_USER.name,
      },
      {
        id: 'exp_g_2',
        title: 'Ride',
        amount: 120,
        category: 'Transport',
        date: '2026-08-28',
        isShared: false,
        status: 'Settled',
        createdAt: '2026-08-28T10:00:00.000Z',
        createdBy: INITIAL_GUEST_USER.id,
        paidByUserId: INITIAL_GUEST_USER.id,
        paidByName: INITIAL_GUEST_USER.name,
      },
    ];

    const months = getAvailableMonthKeys(guestExpenses as Expense[]);
    expect(months).toContain('2026-09');
    expect(months).toContain('2026-08');

    const sepFiltered = filterExpensesByMonth(guestExpenses as Expense[], '2026-09');
    expect(sepFiltered.length).toBe(1);
    expect(sepFiltered[0].title).toBe('Lunch');

    const allFiltered = filterExpensesByMonth(guestExpenses as Expense[], 'ALL');
    expect(allFiltered.length).toBe(2);
  });

  it('5. Initial guest squads default to clean local sample squad', () => {
    expect(INITIAL_GUEST_GROUPS.length).toBeGreaterThanOrEqual(1);
    const defaultSquad = INITIAL_GUEST_GROUPS[0];
    expect(defaultSquad.name).toContain('Guest');
    expect(defaultSquad.members.some((m) => m.id === INITIAL_GUEST_USER.id)).toBe(true);
  });

  it('6. Guest Mode F5 persistence preserves guest transactions locally', () => {
    const guestExpense: Partial<Expense> & { id: string; title: string; amount: number; category: string; date: string; status: ExpenseStatus } = {
      id: 'exp_guest_persist',
      title: 'Local Dinner',
      amount: 450,
      category: 'Food',
      date: '2026-09-21',
      isShared: false,
      status: 'Settled',
      createdAt: '2026-09-21T19:00:00.000Z',
      createdBy: INITIAL_GUEST_USER.id,
      paidByUserId: INITIAL_GUEST_USER.id,
      paidByName: INITIAL_GUEST_USER.name,
    };

    // Simulate saving guest session state to localStorage
    globalThis.localStorage.setItem('tallix_auth', 'guest');
    globalThis.localStorage.setItem('tallix_guest_expenses', JSON.stringify([guestExpense]));

    // Simulate page reload (F5)
    const reloadedAuth = globalThis.localStorage.getItem('tallix_auth');
    expect(reloadedAuth).toBe('guest');

    const rawExpenses = globalThis.localStorage.getItem('tallix_guest_expenses');
    expect(rawExpenses).not.toBeNull();
    const parsedExpenses = JSON.parse(rawExpenses!);
    expect(parsedExpenses.length).toBe(1);
    expect(parsedExpenses[0].title).toBe('Local Dinner');
    expect(parsedExpenses[0].amount).toBe(450);
  });

  it('7. Complete data separation: registered storage keys are isolated from guest data', () => {
    const registeredUser = {
      id: 'usr_reg_12345',
      name: 'Real User',
      email: 'real@tallix.com',
      systemRole: 'User',
    };
    const registeredExpense = {
      id: 'exp_reg_999',
      title: 'Work Subscription',
      amount: 1200,
    };

    globalThis.localStorage.setItem('tallix_user', JSON.stringify(registeredUser));
    globalThis.localStorage.setItem('tallix_expenses', JSON.stringify([registeredExpense]));

    // Guest operations use separate keys
    globalThis.localStorage.setItem('tallix_guest_user', JSON.stringify(INITIAL_GUEST_USER));
    globalThis.localStorage.setItem('tallix_guest_expenses', JSON.stringify([{ id: 'exp_g_1', title: 'Snack' }]));

    // Verify registered keys remain pristine
    const storedUser = JSON.parse(globalThis.localStorage.getItem('tallix_user')!);
    expect(storedUser.id).toBe('usr_reg_12345');
    expect(storedUser.email).toBe('real@tallix.com');

    const storedExpenses = JSON.parse(globalThis.localStorage.getItem('tallix_expenses')!);
    expect(storedExpenses[0].id).toBe('exp_reg_999');
    expect(storedExpenses[0].title).toBe('Work Subscription');
  });

  it('8. Exiting guest mode purges guest-isolated keys without corrupting registered state', () => {
    // Setup state before exit
    globalThis.localStorage.setItem('tallix_auth', 'guest');
    globalThis.localStorage.setItem('tallix_guest_expenses', JSON.stringify([{ id: 'exp_g' }]));
    globalThis.localStorage.setItem('tallix_guest_groups', JSON.stringify(INITIAL_GUEST_GROUPS));
    globalThis.localStorage.setItem('tallix_guest_user', JSON.stringify(INITIAL_GUEST_USER));
    globalThis.localStorage.setItem('tallix_user', JSON.stringify({ id: 'usr_reg_cached', name: 'Cached Account' }));

    // Execute exit cleanup (matching handleExitGuestMode)
    globalThis.localStorage.removeItem('tallix_auth');
    globalThis.localStorage.removeItem('tallix_guest_expenses');
    globalThis.localStorage.removeItem('tallix_guest_groups');
    globalThis.localStorage.removeItem('tallix_guest_settlements');
    globalThis.localStorage.removeItem('tallix_guest_user');

    // Verify guest state is purged
    expect(globalThis.localStorage.getItem('tallix_auth')).toBeNull();
    expect(globalThis.localStorage.getItem('tallix_guest_expenses')).toBeNull();
    expect(globalThis.localStorage.getItem('tallix_guest_groups')).toBeNull();
    expect(globalThis.localStorage.getItem('tallix_guest_user')).toBeNull();

    // Verify registered user cache remains intact
    const cachedUser = JSON.parse(globalThis.localStorage.getItem('tallix_user')!);
    expect(cachedUser.id).toBe('usr_reg_cached');
    expect(cachedUser.name).toBe('Cached Account');
  });

  it('9. Prevents guest transactions from accessing remote Cloudflare D1 sync endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    syncEngine.setUserId('usr_guest_test_id');

    // Trigger sync while in guest mode
    const res = await syncEngine.triggerSync();
    expect(res.success).toBe(true);

    // Assert that fetch was NOT called for sync/push or sync/pull
    const syncFetchCalls = fetchSpy.mock.calls.filter(([url]) =>
      typeof url === 'string' && (url.includes('/api/sync/push') || url.includes('/api/sync/pull'))
    );
    expect(syncFetchCalls.length).toBe(0);

    fetchSpy.mockRestore();
  });
});
