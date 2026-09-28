import { describe, it, expect, vi } from 'vitest';
import { Expense, Settlement, UserProfile, Group } from './types';
import { buildMonthlyReportData, generateMonthlyPdfDoc, getAvailableReportMonths } from './utils/pdfReportGenerator';
import { calculateGroupMembersWithBalances, enrichGroupsWithBalances } from './utils/balanceEngine';
import { filterExpensesByMonth, getCurrentMonthKey } from './utils/monthFilter';
import { compareHistoryItemsDesc, buildUnifiedHistory } from './utils/historyEngine';

describe('Tallix Monthly Accounting, PDF System & Month Transition Architecture', () => {
  const userLemon: UserProfile = {
    id: 'usr_lemon',
    name: 'Lemon',
    email: 'abdulatiflemon@gmail.com',
    role: 'Staff Engineer',
    systemRole: 'Admin',
    department: 'Management',
    avatarGradient: 'from-emerald-600 to-teal-600',
    liquidityLimit: 50000,
    currentLiquidity: 20000,
    monthlyBurnRate: 10000,
  };

  const squadAlpha: Group = {
    id: 'grp_alpha',
    name: 'Alpha Squad',
    description: 'Shared Expenses Squad',
    category: 'Trip',
    avatarGradient: 'from-blue-600 to-indigo-600',
    inviteCode: 'ALPHA2026',
    currency: 'BDT',
    createdAt: '2026-09-01T00:00:00.000Z',
    totalSpent: 0,
    unsettledAmount: 0,
    members: [
      { id: 'usr_lemon', name: 'Lemon', email: 'abdulatiflemon@gmail.com', role: 'Admin', balance: 0 },
      { id: 'usr_jack', name: 'Jack', email: 'jack@example.com', role: 'Member', balance: 0 },
    ],
  };

  // September Transactions
  const septPersonalExpense: Expense = {
    id: 'exp_sept_personal',
    title: 'Personal Lunch',
    merchant: 'Cafe Bistro',
    amount: 500,
    originalAmount: 500,
    amount_paisa: 50000,
    currency: 'BDT',
    paidByUserId: 'usr_lemon',
    paidByName: 'Lemon',
    date: '2026-09-15',
    category: 'Food',
    paymentMethod: 'bkash',
    isShared: false,
    status: 'Settled',
  };

  const septSharedExpense: Expense = {
    id: 'exp_sept_shared',
    title: 'Squad Groceries',
    merchant: 'Supermarket',
    amount: 1000,
    originalAmount: 1000,
    amount_paisa: 100000,
    currency: 'BDT',
    paidByUserId: 'usr_lemon',
    paidByName: 'Lemon',
    date: '2026-09-20',
    category: 'Groceries',
    paymentMethod: 'Cash',
    isShared: true,
    groupId: 'grp_alpha',
    status: 'Settled',
  };

  // September Accepted Settlement (Lemon settled up with Jack ৳300)
  const septSettlement: Settlement = {
    id: 'stl_sept_1',
    groupId: 'grp_alpha',
    groupName: 'Alpha Squad',
    settlementType: 'SETTLE_UP',
    fromUserId: 'usr_lemon',
    fromUserName: 'Lemon',
    toUserId: 'usr_jack',
    toUserName: 'Jack',
    amount: 300,
    originalAmount: 300,
    amount_paisa: 30000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Accepted',
    createdAt: '2026-09-25T14:00:00.000Z',
  };

  describe('PART 8 & 9 — Monthly History PDF Generation & Isolation', () => {
    it('buildMonthlyReportData accurately calculates monthly totals and isolates settlements from expenses', () => {
      const data = buildMonthlyReportData(
        '2026-09',
        userLemon,
        [septPersonalExpense, septSharedExpense],
        [septSettlement]
      );

      expect(data.monthKey).toBe('2026-09');
      expect(data.monthDisplay).toBe('September 2026');

      // Personal = 500, Shared = 1000 => Total Expenses = 1500
      expect(data.expenses.personalTotal).toBe(500);
      expect(data.expenses.sharedTotal).toBe(1000);
      expect(data.expenses.totalAmount).toBe(1500);

      // CRITICAL RULE: Settlement amounts must NOT be added into expense totals!
      expect(data.settlements.totalActivity).toBe(300);
      expect(data.settlements.settleUpTotal).toBe(300);
      expect(data.settlements.settleDownTotal).toBe(0);

      // Verify strict separation
      expect(data.expenses.totalAmount).not.toBe(1800); // Must NOT be 1500 + 300
      expect(data.expenses.totalAmount).toBe(1500);
    });

    it('generateMonthlyPdfDoc creates a valid PDF document with all required sections', () => {
      const data = buildMonthlyReportData(
        '2026-09',
        userLemon,
        [septPersonalExpense, septSharedExpense],
        [septSettlement]
      );

      const doc = generateMonthlyPdfDoc(data);
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

      const outputBlob = doc.output('blob');
      expect(outputBlob).toBeInstanceOf(Blob);
      expect(outputBlob.size).toBeGreaterThan(500);
    });

    it('getAvailableReportMonths lists historical months in descending chronological order', () => {
      const octExpense: Expense = {
        ...septPersonalExpense,
        id: 'exp_oct_1',
        date: '2026-10-02',
      };

      const months = getAvailableReportMonths([septPersonalExpense, octExpense], [septSettlement]);
      expect(months).toContain('2026-10');
      expect(months).toContain('2026-09');
      // Descending order: 2026-10 before 2026-09
      const octIdx = months.indexOf('2026-10');
      const septIdx = months.indexOf('2026-09');
      expect(octIdx).toBeLessThan(septIdx);
    });
  });

  describe('PART 17 — IMPORTANT MONTH TRANSITION TEST', () => {
    it('simulates September 30 state followed by October 1 transition', () => {
      // ----------------------------------------------------
      // STEP 1: September 30
      // ----------------------------------------------------
      // On Sept 30:
      // User has September expenses (Personal 500 + Shared 1000 = 1500)
      // Squad balances: Lemon paid 1000 for squad of 2 (Lemon share 500, Jack share 500)
      // Plus Lemon settled up 300 to Jack => Lemon balance = +500 + 300 = +800
      const allExpenses = [septPersonalExpense, septSharedExpense];
      const allSettlements = [septSettlement];

      // September Monthly View:
      const septFilteredExpenses = filterExpensesByMonth(allExpenses, '2026-09');
      expect(septFilteredExpenses.length).toBe(2);

      const septPersonalAmount = septFilteredExpenses
        .filter((e) => !e.isShared)
        .reduce((sum, e) => sum + e.amount, 0);
      expect(septPersonalAmount).toBe(500);

      const septSharedAmount = septFilteredExpenses
        .filter((e) => e.isShared)
        .reduce((sum, e) => sum + e.amount, 0);
      expect(septSharedAmount).toBe(1000);

      // Balance Engine calculation (cumulative)
      const squadsWithBalancesSept = enrichGroupsWithBalances([squadAlpha], allExpenses, allSettlements);
      const lemonMemberSept = squadsWithBalancesSept[0].members.find((m) => m.id === 'usr_lemon')!;
      expect(lemonMemberSept.balance).toBe(800); // 1000 paid - 500 share + 300 settlement

      // Amount Owed To Me = 800, Amount I Owe = 0
      const owedToMeSept = lemonMemberSept.balance > 0 ? lemonMemberSept.balance : 0;
      const iOweSept = lemonMemberSept.balance < 0 ? Math.abs(lemonMemberSept.balance) : 0;
      expect(owedToMeSept).toBe(800);
      expect(iOweSept).toBe(0);

      // September history contains September records
      const septHistory = buildUnifiedHistory(septFilteredExpenses, allSettlements.filter((s) => s.createdAt.startsWith('2026-09')));
      expect(septHistory.length).toBe(3);

      // ----------------------------------------------------
      // STEP 2: Transition to October 1
      // ----------------------------------------------------
      // When October 1 begins:
      // Dashboard monthly expense filter switches to '2026-10'
      const octFilteredExpensesBeforeActivity = filterExpensesByMonth(allExpenses, '2026-10');

      // 1. Dashboard monthly expense totals start at ZERO:
      expect(octFilteredExpensesBeforeActivity.length).toBe(0);
      const octPersonalAmount = octFilteredExpensesBeforeActivity
        .filter((e) => !e.isShared)
        .reduce((sum, e) => sum + e.amount, 0);
      const octSharedAmount = octFilteredExpensesBeforeActivity
        .filter((e) => e.isShared)
        .reduce((sum, e) => sum + e.amount, 0);
      expect(octPersonalAmount).toBe(0);
      expect(octSharedAmount).toBe(0);

      // 2. Settlement balance is UNCHANGED / CARRIED FORWARD across months:
      const squadsWithBalancesOct = enrichGroupsWithBalances([squadAlpha], allExpenses, allSettlements);
      const lemonMemberOct = squadsWithBalancesOct[0].members.find((m) => m.id === 'usr_lemon')!;
      expect(lemonMemberOct.balance).toBe(800); // Carried forward exactly!
      const owedToMeOct = lemonMemberOct.balance > 0 ? lemonMemberOct.balance : 0;
      const iOweOct = lemonMemberOct.balance < 0 ? Math.abs(lemonMemberOct.balance) : 0;
      expect(owedToMeOct).toBe(800);
      expect(iOweOct).toBe(0);

      // 3. September history remains STILL AVAILABLE:
      const fullHistory = buildUnifiedHistory(allExpenses, allSettlements);
      expect(fullHistory.some((h) => h.id === 'exp_sept_personal')).toBe(true);
      expect(fullHistory.some((h) => h.id === 'exp_sept_shared')).toBe(true);
      expect(fullHistory.some((h) => h.id === 'stl_sept_1')).toBe(true);

      // 4. September PDF remains STILL AVAILABLE and reproducible:
      const septPdfData = buildMonthlyReportData('2026-09', userLemon, allExpenses, allSettlements);
      expect(septPdfData.expenses.totalAmount).toBe(1500);
      expect(septPdfData.settlements.totalActivity).toBe(300);
      const septDoc = generateMonthlyPdfDoc(septPdfData);
      expect(septDoc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

      // ----------------------------------------------------
      // STEP 3: October new expense arrives
      // ----------------------------------------------------
      const octNewExpense: Expense = {
        id: 'exp_oct_internet',
        title: 'High Speed WiFi',
        merchant: 'ISP Provider',
        amount: 800,
        originalAmount: 800,
        amount_paisa: 80000,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        date: '2026-10-01',
        category: 'Utilities',
        paymentMethod: 'bkash',
        isShared: false,
        status: 'Settled',
      };

      const updatedAllExpenses = [...allExpenses, octNewExpense];

      // October monthly totals reflect the new October expense:
      const octFilteredExpensesAfter = filterExpensesByMonth(updatedAllExpenses, '2026-10');
      expect(octFilteredExpensesAfter.length).toBe(1);
      expect(octFilteredExpensesAfter[0].id).toBe('exp_oct_internet');
      expect(octFilteredExpensesAfter[0].amount).toBe(800);

      // September monthly totals remain isolated at 1500:
      const septFilteredExpensesAfter = filterExpensesByMonth(updatedAllExpenses, '2026-09');
      expect(septFilteredExpensesAfter.length).toBe(2);

      // 5. October new history appears ABOVE older September history in global latest-first:
      const globalHistory = buildUnifiedHistory(updatedAllExpenses, allSettlements);
      expect(globalHistory[0].id).toBe('exp_oct_internet'); // October item is at the top!
      expect(globalHistory.map((h) => h.id)).toEqual([
        'exp_oct_internet', // 2026-10-01
        'stl_sept_1',       // 2026-09-25
        'exp_sept_shared',  // 2026-09-20
        'exp_sept_personal',// 2026-09-15
      ]);
    });
  });
});
