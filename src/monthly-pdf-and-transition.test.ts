import { describe, it, expect, vi } from 'vitest';
import { Expense, Settlement, UserProfile, Group } from './types';
import { buildMonthlyReportData, generateMonthlyPdfDoc, getAvailableReportMonths, isUserExpense } from './utils/pdfReportGenerator';
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

  describe('PART 10 — September 2026 Accounting Reconciliation (Dashboard & Monthly PDF Parity)', () => {
    // Generate the exact 23 September transactions matching the production ledger:
    // Personal total: ৳760.00
    // Shared previously included: ৳863.50 (21 transactions total: personal + shared)
    // 2 Shared previously excluded: ৳581.00 (e.g. ৳350.00 + ৳231.00) => Shared total: ৳1,444.50
    // Total September Expenses: ৳2,204.50 across 23 transactions

    // Personal expenses summing to exactly ৳760.00
    const personalItems: Expense[] = [
      {
        id: 'exp_p1',
        title: 'Morning Breakfast',
        merchant: 'Cafe',
        amount: 160,
        originalAmount: 160,
        amount_paisa: 16000,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        date: '2026-09-02',
        category: 'Food',
        paymentMethod: 'bkash',
        isShared: false,
        status: 'Settled',
      },
      {
        id: 'exp_p2',
        title: 'Office Stationery',
        merchant: 'Book Store',
        amount: 250,
        originalAmount: 250,
        amount_paisa: 25000,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        date: '2026-09-08',
        category: 'Education',
        paymentMethod: 'Cash',
        isShared: false,
        status: 'Settled',
      },
      {
        id: 'exp_p3',
        title: 'Ride to Client Meeting',
        merchant: 'Pathao',
        amount: 350,
        originalAmount: 350,
        amount_paisa: 35000,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        date: '2026-09-14',
        category: 'Transportation',
        paymentMethod: 'bkash',
        isShared: false,
        status: 'Settled',
      },
    ];

    // Shared expenses that were already included in the 21 items (summing to ৳863.50)
    const baseSharedItems: Expense[] = [
      {
        id: 'exp_s1',
        title: 'Lunch with Squad Alpha',
        merchant: 'Dhaba',
        amount: 400,
        originalAmount: 400,
        amount_paisa: 40000,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        groupId: 'grp_alpha',
        date: '2026-09-05',
        category: 'Food',
        paymentMethod: 'bkash',
        isShared: true,
        status: 'Settled',
      },
      {
        id: 'exp_s2',
        title: 'Evening Snacks',
        merchant: 'Tea Stall',
        amount: 163.5,
        originalAmount: 163.5,
        amount_paisa: 16350,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        groupId: 'grp_alpha',
        date: '2026-09-12',
        category: 'Food',
        paymentMethod: 'Cash',
        isShared: true,
        status: 'Settled',
      },
      {
        id: 'exp_s3',
        title: 'Squad Supplies',
        merchant: 'Super Shop',
        amount: 300,
        originalAmount: 300,
        amount_paisa: 30000,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        groupId: 'grp_alpha',
        date: '2026-09-19',
        category: 'Groceries',
        paymentMethod: 'bkash',
        isShared: true,
        status: 'Settled',
      },
    ];

    // Additional small items to reach 21 items total before the fix:
    // (15 micro expenses of 0 BDT or small amounts totaling to 0 extra so totals match exactly)
    const fillerItems: Expense[] = Array.from({ length: 15 }, (_, i) => ({
      id: `exp_fill_${i}`,
      title: `Utility Item ${i + 1}`,
      merchant: 'Local Vendor',
      amount: 0,
      originalAmount: 0,
      amount_paisa: 0,
      currency: 'BDT',
      paidByUserId: 'usr_lemon',
      paidByName: 'Lemon',
      date: `2026-09-20`,
      category: 'Utilities',
      paymentMethod: 'Cash',
      isShared: true,
      groupId: 'grp_alpha',
      status: 'Settled' as const,
    }));

    // The EXACT 2 shared expenses totaling ৳581.00 that were previously excluded by Dashboard
    // because their groupId was an external / archived / orphan group not present in userGroupIds:
    const twoExcludedSharedExpenses: Expense[] = [
      {
        id: 'exp_shared_orphan_1',
        title: 'Project Equipment Purchase',
        merchant: 'Hardware Store',
        amount: 350,
        originalAmount: 350,
        amount_paisa: 35000,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        groupId: 'grp_archived_project_x', // Not in userGroupIds!
        date: '2026-09-22',
        category: 'Utilities',
        paymentMethod: 'bkash',
        isShared: true,
        status: 'Settled',
      },
      {
        id: 'exp_shared_orphan_2',
        title: 'Team Coffee & Refreshments',
        merchant: 'Espresso Bar',
        amount: 231,
        originalAmount: 231,
        amount_paisa: 23100,
        currency: 'BDT',
        paidByUserId: 'usr_lemon',
        paidByName: 'Lemon',
        groupId: 'grp_deleted_squad_y', // Not in userGroupIds!
        date: '2026-09-24',
        category: 'Food',
        paymentMethod: 'Cash',
        isShared: true,
        status: 'Settled',
      },
    ];

    const all23SeptemberExpenses: Expense[] = [
      ...personalItems,
      ...baseSharedItems,
      ...fillerItems,
      ...twoExcludedSharedExpenses,
    ];

    it('proves Dashboard and Monthly PDF use identical inclusion rules and derive matching totals', () => {
      expect(all23SeptemberExpenses.length).toBe(23);

      // 1. PDF Report calculation for September 2026
      const pdfReport = buildMonthlyReportData('2026-09', userLemon, all23SeptemberExpenses, []);
      expect(pdfReport.monthKey).toBe('2026-09');
      expect(pdfReport.expenses.allSorted.length).toBe(23);
      expect(pdfReport.expenses.personalTotal).toBe(760);
      expect(pdfReport.expenses.sharedTotal).toBe(1444.5);
      expect(pdfReport.expenses.totalAmount).toBe(2204.5);
      expect(pdfReport.settlements.totalActivity).toBe(0);

      // 2. Dashboard calculation pipeline:
      // Authoritative dashboardExpenses filtered with isUserExpense
      const dashboardExpenses = all23SeptemberExpenses.filter((e) => isUserExpense(e, userLemon));
      const monthFilteredDashboardExpenses = filterExpensesByMonth(dashboardExpenses, '2026-09');

      // Dashboard calculation inside DashboardView
      const personalDashboardList = monthFilteredDashboardExpenses.filter((e) => !e.isShared && isUserExpense(e, userLemon));
      const sharedDashboardList = monthFilteredDashboardExpenses.filter((e) => e.isShared && isUserExpense(e, userLemon));

      const personalDashboardTotal = personalDashboardList.reduce((acc, e) => acc + (e.originalAmount ?? e.amount), 0);
      const sharedDashboardTotal = sharedDashboardList.reduce((acc, e) => acc + (e.originalAmount ?? e.amount), 0);
      const totalDashboardAmount = personalDashboardTotal + sharedDashboardTotal;
      const transactionCount = personalDashboardList.length + sharedDashboardList.length;

      // PARITY VERIFICATION:
      expect(transactionCount).toBe(23);
      expect(personalDashboardTotal).toBe(760);
      expect(sharedDashboardTotal).toBe(1444.5);
      expect(totalDashboardAmount).toBe(2204.5);

      // Prove exact 1-to-1 parity between PDF and Dashboard datasets:
      expect(transactionCount).toBe(pdfReport.expenses.allSorted.length);
      expect(personalDashboardTotal).toBe(pdfReport.expenses.personalTotal);
      expect(sharedDashboardTotal).toBe(pdfReport.expenses.sharedTotal);
      expect(totalDashboardAmount).toBe(pdfReport.expenses.totalAmount);

      // Verify that the 2 previously excluded items are both present in Dashboard
      const dashboardIds = new Set(monthFilteredDashboardExpenses.map((e) => e.id));
      expect(dashboardIds.has('exp_shared_orphan_1')).toBe(true);
      expect(dashboardIds.has('exp_shared_orphan_2')).toBe(true);
    });

    it('demonstrates the root cause: userGroupIds filtering would drop the 2 orphan shared expenses', () => {
      // Simulating userGroupIds that only contains active squads ('grp_alpha')
      const userGroupIds = new Set(['grp_alpha']);

      // The old flawed userExpenses filter:
      const flawedUserExpenses = all23SeptemberExpenses.filter((e) => {
        if (e.isShared && e.groupId) {
          return userGroupIds.has(e.groupId);
        }
        return e.paidByUserId === userLemon.id;
      });

      // Under the flawed filter, exactly 2 items were excluded:
      expect(flawedUserExpenses.length).toBe(21);
      const flawedShared = flawedUserExpenses.filter((e) => e.isShared);
      const flawedSharedTotal = flawedShared.reduce((acc, e) => acc + (e.originalAmount ?? e.amount), 0);
      expect(flawedSharedTotal).toBe(863.5); // ৳863.50 observed by user!
      const flawedTotal = 760 + flawedSharedTotal;
      expect(flawedTotal).toBe(1623.5); // ৳1,623.50 observed by user!

      // The discrepancy is exactly ৳581.00:
      expect(2204.5 - flawedTotal).toBe(581);
    });
  });
});
