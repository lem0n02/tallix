import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentMonthKey,
  getExpenseMonthKey,
  formatMonthDisplay,
  getAvailableMonthKeys,
  filterExpensesByMonth,
} from './utils/monthFilter';
import { Expense, Group, UserProfile, Settlement } from './types';
import { sumExactAmounts, toPaisa, fromPaisa } from './utils/money';
import { isMemberMatch } from './utils/balanceEngine';

describe('Month Filter System Comprehensive Suite', () => {
  // Test user
  const mockUser: UserProfile = {
    id: 'usr_lemon',
    name: 'Lemon',
    email: 'lemon@example.com',
    role: 'Admin',
    systemRole: 'User',
    title: 'Lead Architect',
    department: 'Engineering',
    avatarGradient: 'from-blue-500 to-emerald-400',
    liquidityLimit: 50000,
    currentLiquidity: 35000,
    monthlyBurnRate: 15000,
  };

  // Test squad
  const mockSquad: Group = {
    id: 'grp_squad_1',
    name: 'Weekend Squad',
    description: 'Shared trip and dinners',
    category: 'Travel',
    totalSpent: 0,
    unsettledAmount: 0,
    avatarGradient: 'from-blue-600 to-indigo-600',
    createdAt: '2026-05-01',
    inviteCode: 'SQUAD1',
    members: [
      { id: 'usr_lemon', name: 'Lemon', email: 'lemon@example.com', role: 'Admin', balance: 500 },
      { id: 'usr_bob', name: 'Bob', email: 'bob@example.com', role: 'Member', balance: -500 },
    ],
    currency: 'BDT',
  };

  // 5 Months of real transaction data (May 2026, June 2026, July 2026, August 2026, September 2026)
  const multiMonthExpenses: Expense[] = [
    // --- September 2026 (Current) ---
    {
      id: 'tx_sep_1',
      title: 'Groceries September',
      merchant: 'Shwapno',
      amount: 4500,
      currency: 'BDT',
      date: '2026-09-18',
      category: '🛒 Groceries',
      status: 'Settled',
      paymentMethod: 'bkash',
      isShared: false,
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
    },
    {
      id: 'tx_sep_2',
      title: 'Squad Dinner September',
      merchant: 'Star Kabab',
      amount: 3000,
      currency: 'BDT',
      date: '2026-09-10',
      category: '🍛 Food',
      status: 'Settled',
      paymentMethod: 'bkash',
      isShared: true,
      groupId: 'grp_squad_1',
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
    },
    {
      id: 'tx_sep_3_bob',
      title: 'Squad Fuel (Paid by Bob)',
      merchant: 'Padma Oil',
      amount: 2000,
      currency: 'BDT',
      date: '2026-09-05',
      category: '🚍 Transportation',
      status: 'Settled',
      paymentMethod: 'Cash',
      isShared: true,
      groupId: 'grp_squad_1',
      paidByUserId: 'usr_bob',
      paidByName: 'Bob',
    },

    // --- August 2026 ---
    {
      id: 'tx_aug_1',
      title: 'Personal Utilities August',
      merchant: 'DESCO',
      amount: 2200,
      currency: 'BDT',
      date: '2026-08-25',
      category: '💡 Utilities',
      status: 'Settled',
      paymentMethod: 'bkash',
      isShared: false,
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
    },
    {
      id: 'tx_aug_2',
      title: 'Squad Groceries August',
      merchant: 'Meena Bazar',
      amount: 5500,
      currency: 'BDT',
      date: '2026-08-14',
      category: '🛒 Groceries',
      status: 'Settled',
      paymentMethod: 'Cash',
      isShared: true,
      groupId: 'grp_squad_1',
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
    },

    // --- July 2026 ---
    {
      id: 'tx_jul_1',
      title: 'July Internet Bill',
      merchant: 'Carnival',
      amount: 1500,
      currency: 'BDT',
      date: '2026-07-02',
      category: '🌐 Internet',
      status: 'Settled',
      paymentMethod: 'bkash',
      isShared: false,
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
    },
    {
      id: 'tx_jul_2',
      title: 'Squad Resort Booking July',
      merchant: 'Mermaid Beach Resort',
      amount: 12000,
      currency: 'BDT',
      date: '2026-07-20',
      category: '🎉 Entertainment',
      status: 'Settled',
      paymentMethod: 'bkash',
      isShared: true,
      groupId: 'grp_squad_1',
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
    },

    // --- June 2026 ---
    {
      id: 'tx_jun_1',
      title: 'June Gym Membership',
      merchant: 'Fitverse',
      amount: 3000,
      currency: 'BDT',
      date: '2026-06-01',
      category: '🩺 Health',
      status: 'Settled',
      paymentMethod: 'Cash',
      isShared: false,
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
    },

    // --- May 2026 ---
    {
      id: 'tx_may_1',
      title: 'May Software Subscription',
      merchant: 'JetBrains',
      amount: 1800,
      currency: 'BDT',
      date: '2026-05-15',
      category: '📱 Mobile & Subscriptions',
      status: 'Settled',
      paymentMethod: 'bkash',
      isShared: false,
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
    },
  ];

  describe('1. Logical Month Key and Display Generation', () => {
    it('correctly extracts YYYY-MM from diverse date formats', () => {
      expect(getExpenseMonthKey('2026-09-18')).toBe('2026-09');
      expect(getExpenseMonthKey('2026-08-14T10:30:00.000Z')).toBe('2026-08');
      expect(getExpenseMonthKey('2025-09-01')).toBe('2025-09'); // Distinct from 2026-09
      expect(getExpenseMonthKey(undefined)).toBeNull();
      expect(getExpenseMonthKey('')).toBeNull();
    });

    it('formats month display names human-readably with All Time support', () => {
      expect(formatMonthDisplay('2026-09')).toBe('September 2026');
      expect(formatMonthDisplay('2026-08')).toBe('August 2026');
      expect(formatMonthDisplay('2026-07')).toBe('July 2026');
      expect(formatMonthDisplay('2026-06')).toBe('June 2026');
      expect(formatMonthDisplay('2026-05')).toBe('May 2026');
      expect(formatMonthDisplay('ALL')).toBe('All Time');
    });

    it('dynamically collects available months in chronological descending order', () => {
      const available = getAvailableMonthKeys(multiMonthExpenses, '2026-09');
      expect(available).toContain('2026-09');
      expect(available).toContain('2026-08');
      expect(available).toContain('2026-07');
      expect(available).toContain('2026-06');
      expect(available).toContain('2026-05');

      // Verify strict descending order
      expect(available[0]).toBe('2026-09');
      expect(available[1]).toBe('2026-08');
      expect(available[2]).toBe('2026-07');
      expect(available[3]).toBe('2026-06');
      expect(available[4]).toBe('2026-05');
    });

    it('always includes current month even if no transactions exist for it', () => {
      const emptyExpenses: Expense[] = [];
      const available = getAvailableMonthKeys(emptyExpenses, '2026-09');
      expect(available).toEqual(['2026-09']);
    });
  });

  describe('2. Multi-Month Expense Calculations Verification', () => {
    // Helper replicating Dashboard total expense computation
    const computeDashboardTotal = (expList: Expense[], user: UserProfile) => {
      const userMember = { id: user.id, name: user.name, email: user.email };
      const isPaidOrOwnedByCurrentUser = (exp: Expense) =>
        isMemberMatch(userMember, exp.paidByUserId, exp.paidByName) ||
        exp.paidByUserId === user.id ||
        exp.createdBy === user.id;

      // Personal expenses
      const personalList = expList.filter((e) => !e.isShared && isPaidOrOwnedByCurrentUser(e));
      const personalAmt = sumExactAmounts(personalList.map((e) => e.amount));

      // Shared expenses paid by current user
      const sharedList = expList.filter((e) => e.isShared && isPaidOrOwnedByCurrentUser(e));
      const sharedAmt = sumExactAmounts(sharedList.map((e) => e.amount));

      return {
        personalAmt,
        sharedAmt,
        totalAmt: fromPaisa(toPaisa(personalAmt) + toPaisa(sharedAmt)),
        count: personalList.length + sharedList.length,
      };
    };

    it('1. September selected -> computes ONLY September calculations', () => {
      const sepExpenses = filterExpensesByMonth(multiMonthExpenses, '2026-09');
      expect(sepExpenses.length).toBe(3);

      const metrics = computeDashboardTotal(sepExpenses, mockUser);
      // Personal: 4500 (tx_sep_1)
      expect(metrics.personalAmt).toBe(4500);
      // Shared paid by me: 3000 (tx_sep_2) (tx_sep_3_bob was paid by Bob so not in my expenses)
      expect(metrics.sharedAmt).toBe(3000);
      // Total: 4500 + 3000 = 7500
      expect(metrics.totalAmt).toBe(7500);
      expect(metrics.count).toBe(2);
    });

    it('2. August selected -> computes ONLY August calculations', () => {
      const augExpenses = filterExpensesByMonth(multiMonthExpenses, '2026-08');
      expect(augExpenses.length).toBe(2);

      const metrics = computeDashboardTotal(augExpenses, mockUser);
      // Personal: 2200 (tx_aug_1)
      expect(metrics.personalAmt).toBe(2200);
      // Shared paid by me: 5500 (tx_aug_2)
      expect(metrics.sharedAmt).toBe(5500);
      // Total: 2200 + 5500 = 7700
      expect(metrics.totalAmt).toBe(7700);
      expect(metrics.count).toBe(2);
    });

    it('3. July selected -> computes ONLY July calculations', () => {
      const julExpenses = filterExpensesByMonth(multiMonthExpenses, '2026-07');
      expect(julExpenses.length).toBe(2);

      const metrics = computeDashboardTotal(julExpenses, mockUser);
      // Personal: 1500 (tx_jul_1)
      expect(metrics.personalAmt).toBe(1500);
      // Shared paid by me: 12000 (tx_jul_2)
      expect(metrics.sharedAmt).toBe(12000);
      // Total: 1500 + 12000 = 13500
      expect(metrics.totalAmt).toBe(13500);
      expect(metrics.count).toBe(2);
    });

    it('4. All Time selected -> computes ALL historical calculations', () => {
      const allExpenses = filterExpensesByMonth(multiMonthExpenses, 'ALL');
      expect(allExpenses.length).toBe(multiMonthExpenses.length);

      const metrics = computeDashboardTotal(allExpenses, mockUser);
      // Total personal: 4500 (Sep) + 2200 (Aug) + 1500 (Jul) + 3000 (Jun) + 1800 (May) = 13000
      expect(metrics.personalAmt).toBe(13000);
      // Total shared paid by me: 3000 (Sep) + 5500 (Aug) + 12000 (Jul) = 20500
      expect(metrics.sharedAmt).toBe(20500);
      // Total expenses: 13000 + 20500 = 33500
      expect(metrics.totalAmt).toBe(33500);
      expect(metrics.count).toBe(8);
    });

    it('5. Switching months does not mutate or modify existing transactions', () => {
      const originalCopy = JSON.parse(JSON.stringify(multiMonthExpenses));

      // Filter August
      filterExpensesByMonth(multiMonthExpenses, '2026-08');
      // Filter September
      filterExpensesByMonth(multiMonthExpenses, '2026-09');
      // Filter ALL
      filterExpensesByMonth(multiMonthExpenses, 'ALL');

      // Original array and all objects remain untouched
      expect(multiMonthExpenses).toEqual(originalCopy);
    });

    it('6. Empty month returns 0 expenses and 0 totals without fake transactions', () => {
      const emptyMonthExpenses = filterExpensesByMonth(multiMonthExpenses, '2026-01');
      expect(emptyMonthExpenses).toEqual([]);

      const metrics = computeDashboardTotal(emptyMonthExpenses, mockUser);
      expect(metrics.totalAmt).toBe(0);
      expect(metrics.personalAmt).toBe(0);
      expect(metrics.sharedAmt).toBe(0);
      expect(metrics.count).toBe(0);
    });
  });

  describe('3. Personal & Squad View Time Filtering Consistency', () => {
    it('7. Personal Expenses list reflects the selected month correctly', () => {
      // User personal expenses in September
      const sepPersonal = filterExpensesByMonth(
        multiMonthExpenses.filter((e) => !e.isShared),
        '2026-09'
      );
      expect(sepPersonal.length).toBe(1);
      expect(sepPersonal[0].title).toBe('Groceries September');

      // User personal expenses in August
      const augPersonal = filterExpensesByMonth(
        multiMonthExpenses.filter((e) => !e.isShared),
        '2026-08'
      );
      expect(augPersonal.length).toBe(1);
      expect(augPersonal[0].title).toBe('Personal Utilities August');

      // All Time personal
      const allPersonal = filterExpensesByMonth(
        multiMonthExpenses.filter((e) => !e.isShared),
        'ALL'
      );
      expect(allPersonal.length).toBe(5);
    });

    it('8. Squad views respect time filter without altering member visibility or ownership rules', () => {
      // In September: 2 squad transactions (1 paid by Lemon, 1 paid by Bob)
      const sepSquadExpenses = filterExpensesByMonth(
        multiMonthExpenses.filter((e) => e.isShared && e.groupId === 'grp_squad_1'),
        '2026-09'
      );
      expect(sepSquadExpenses.length).toBe(2);
      // Both Lemon and Bob transactions exist in the squad view for September
      expect(sepSquadExpenses.some((e) => e.paidByUserId === 'usr_lemon')).toBe(true);
      expect(sepSquadExpenses.some((e) => e.paidByUserId === 'usr_bob')).toBe(true);

      // In July: 1 squad transaction
      const julSquadExpenses = filterExpensesByMonth(
        multiMonthExpenses.filter((e) => e.isShared && e.groupId === 'grp_squad_1'),
        '2026-07'
      );
      expect(julSquadExpenses.length).toBe(1);
      expect(julSquadExpenses[0].title).toBe('Squad Resort Booking July');
    });

    it('9. Offline & Sync: Newly synced transactions dynamically expand available months', () => {
      let currentExpenses = [...multiMonthExpenses];
      const initialMonths = getAvailableMonthKeys(currentExpenses, '2026-09');
      expect(initialMonths).not.toContain('2026-04');

      // Simulate incoming sync from D1 with a transaction in April 2026
      const newSyncedTx: Expense = {
        id: 'tx_apr_1',
        title: 'April Conference Ticket',
        merchant: 'Tech Summit',
        amount: 5000,
        currency: 'BDT',
        date: '2026-04-12',
        category: '🎓 Education',
        status: 'Settled',
        paymentMethod: 'bkash',
        isShared: false,
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
      };

      currentExpenses = [newSyncedTx, ...currentExpenses];
      const updatedMonths = getAvailableMonthKeys(currentExpenses, '2026-09');

      expect(updatedMonths).toContain('2026-04');
      const aprFiltered = filterExpensesByMonth(currentExpenses, '2026-04');
      expect(aprFiltered.length).toBe(1);
      expect(aprFiltered[0].id).toBe('tx_apr_1');
    });
  });
});
