import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginUserViaD1, loginUserViaGoogle, registerUserToCloudflareD1 } from './services/authService';
import { LocalRepository } from './services/localRepository';
import { idbGetAll, idbPut, idbClear, idbGet, STORES } from './services/indexedDB';
import { syncEngine } from './services/syncEngine';
import { RegisteredUser, UserProfile, Settlement, Expense, Group } from './types';

// Mock browser storage for Node vitest runner
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => {
      store[k] = v.toString();
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
  });
}
if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: mockStorage,
    writable: true,
  });
}

describe('Authentication & Settlement Resilience Regression Suite', () => {
  const existingUserId = 'usr_reg_1789939746901';
  const existingEmail = 'lemonshahebb121@gmail.com';
  const existingPassword = 'StrongPassword123!';
  const existingGroupId = 'grp_1790006522192_bf12470d33bf';

  const mockExistingUser: RegisteredUser = {
    id: existingUserId,
    name: 'Lemon',
    email: existingEmail,
    password: existingPassword,
    systemRole: 'User',
    roleTitle: 'Financial Member',
    department: 'Personal Workspace',
    avatarGradient: 'from-blue-600 to-indigo-600',
    createdAt: '2026-09-20',
    status: 'Active',
    isVerified: true,
  };

  const mockSettlement1: Settlement = {
    id: 'stl_1790504687839',
    groupId: existingGroupId,
    groupName: 'Khaddo',
    fromUserId: existingUserId,
    fromUserName: 'Lemon (You)',
    toUserId: 'usr_reg_1790264485433_6j9ak4u',
    toUserName: 'Shahid',
    amount: 100,
    amount_paisa: 10000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Accepted',
    note: 'bKash Settle Up for Khaddo',
    createdAt: '2026-09-27T10:24:47.840Z',
    updatedAt: '2026-09-27T10:24:47.840Z',
  };

  const mockSettlement2: Settlement = {
    id: 'stl_1790743471116',
    groupId: existingGroupId,
    groupName: 'Khaddo',
    fromUserId: 'usr_reg_1790264690739_27sig4i',
    fromUserName: 'Jack sparrow',
    toUserId: existingUserId,
    toUserName: 'Lemon (You)',
    amount: 160,
    amount_paisa: 16000,
    currency: 'BDT',
    paymentMethod: 'bKash',
    status: 'Pending',
    note: 'bKash Settle Down for Khaddo',
    createdAt: '2026-09-30T04:44:31.116Z',
    updatedAt: '2026-09-30T04:44:31.116Z',
  };

  const mockExpense: Expense = {
    id: 'exp_khaddo_1',
    groupId: existingGroupId,
    groupName: 'Khaddo',
    title: 'Dinner at Sultan Dine',
    merchant: 'Sultan Dine',
    amount: 1200,
    amount_paisa: 120000,
    currency: 'BDT',
    category: 'Food',
    date: '2026-09-27',
    paidByUserId: existingUserId,
    paidByName: 'Lemon (You)',
    paymentMethod: 'bkash',
    status: 'Settled',
    isShared: true,
    createdBy: existingUserId,
    createdAt: '2026-09-27T10:00:00Z',
    updatedAt: '2026-09-27T10:00:00Z',
  };

  const mockGroup: Group = {
    id: existingGroupId,
    name: 'Khaddo',
    description: 'Food squad',
    category: 'Food',
    currency: 'BDT',
    inviteCode: 'KHADDO26',
    avatarGradient: 'from-amber-500 to-orange-500',
    members: [
      { id: existingUserId, name: 'Lemon (You)', email: existingEmail, role: 'Admin', balance: 0 },
      { id: 'usr_reg_1790264485433_6j9ak4u', name: 'Shahid', email: 'mdshahidhossen50@gmail.com', role: 'Member', balance: 0 },
      { id: 'usr_reg_1790264690739_27sig4i', name: 'Jack sparrow', email: 'xanonymous221b@gmail.com', role: 'Member', balance: 0 },
    ],
    totalSpent: 1200,
    unsettledAmount: 0,
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
  };

  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.EXPENSES);
    await idbClear(STORES.GROUPS);
    await idbClear(STORES.SETTLEMENTS);
    await idbClear(STORES.SYNC_QUEUE);
    mockStorage.clear();
    syncEngine.resetUserState();
    vi.restoreAllMocks();
  });

  it('1 & 2 & 3 & 4: Email/password login -> Logout -> Email/password login again preserves canonical user ID', async () => {
    // Seed initial user and data in local IndexedDB
    await idbPut(STORES.USERS, mockExistingUser);
    await idbPut(STORES.SETTLEMENTS, mockSettlement1);
    await idbPut(STORES.SETTLEMENTS, mockSettlement2);
    await idbPut(STORES.EXPENSES, mockExpense);
    await idbPut(STORES.GROUPS, mockGroup);

    // Mock successful backend /api/auth/login response
    const mockAuthResponse = {
      success: true,
      user: {
        id: existingUserId,
        name: 'Lemon',
        email: existingEmail,
        systemRole: 'User',
        role: 'User Member',
        title: 'Financial Member',
        roleTitle: 'Financial Member',
        department: 'Personal Workspace',
        avatarGradient: 'from-blue-600 to-indigo-600',
        status: 'Active',
        createdAt: '2026-09-20',
        monthlyBudget: 25000,
      },
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/login')) {
        return new Response(JSON.stringify(mockAuthResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    // 1. First Email/password login
    const login1 = await loginUserViaD1(existingEmail, existingPassword);
    expect(login1.success).toBe(true);
    expect(login1.user?.id).toBe(existingUserId);
    expect(login1.user?.email).toBe(existingEmail);

    // Simulate session establishment in app
    mockStorage.setItem('tallix_auth', 'true');
    mockStorage.setItem('tallix_user', JSON.stringify(login1.user));

    // 2. Logout: Clears auth session but preserves financial records and cached credentials
    mockStorage.removeItem('tallix_auth');
    mockStorage.removeItem('tallix_user');
    syncEngine.resetUserState();
    expect(mockStorage.getItem('tallix_auth')).toBeNull();
    expect(mockStorage.getItem('tallix_user')).toBeNull();

    // 3. Second Email/password login with the SAME credentials
    const login2 = await loginUserViaD1(existingEmail, existingPassword);
    expect(login2.success).toBe(true);
    expect(login2.user?.id).toBe(existingUserId);
    expect(login2.user?.email).toBe(existingEmail);

    // 4. Same user ID before and after logout
    expect(login2.user?.id).toBe(login1.user?.id);
  });

  it('5 & 6: Existing settlements remain visible and are not duplicated after login/logout cycle', async () => {
    // Seed initial settlements
    await idbPut(STORES.SETTLEMENTS, mockSettlement1);
    await idbPut(STORES.SETTLEMENTS, mockSettlement2);

    // Verify initial load
    const initialSettlements = await LocalRepository.getAllSettlements();
    expect(initialSettlements.length).toBe(2);
    expect(initialSettlements.map((s) => s.id)).toEqual(['stl_1790504687839', 'stl_1790743471116']);

    // Perform logout simulation
    syncEngine.resetUserState();
    mockStorage.removeItem('tallix_auth');

    // Verify settlements remain in IndexedDB after logout
    const postLogoutSettlements = await LocalRepository.getAllSettlements();
    expect(postLogoutSettlements.length).toBe(2);
    expect(postLogoutSettlements.find((s) => s.id === 'stl_1790504687839')?.amount).toBe(100);
    expect(postLogoutSettlements.find((s) => s.id === 'stl_1790743471116')?.amount).toBe(160);

    // Re-initialize local repository (as happens on app mount)
    await LocalRepository.initialize({
      expenses: [],
      groups: [],
      settlements: [mockSettlement1, mockSettlement2],
      registeredUsers: [],
      auditLogs: [],
      guestVisits: [],
    });

    // Ensure NO duplicates were created
    const finalSettlements = await LocalRepository.getAllSettlements();
    expect(finalSettlements.length).toBe(2);
    const uniqueIds = new Set(finalSettlements.map((s) => s.id));
    expect(uniqueIds.size).toBe(2);
  });

  it('7 & 8: Existing Google account maps to existing Tallix user without creating duplicate user', async () => {
    // Seed existing email/password account
    await idbPut(STORES.USERS, mockExistingUser);

    // Mock backend POST /api/auth/google returning matching existing user (not a new user)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/google')) {
        return new Response(
          JSON.stringify({
            success: true,
            isNewUser: false,
            user: {
              id: existingUserId, // Canonical existing ID preserved
              name: 'Lemon',
              email: existingEmail,
              systemRole: 'User',
              role: 'User Member',
              title: 'Financial Member',
              roleTitle: 'Financial Member',
              department: 'Personal Workspace',
              avatarGradient: 'from-blue-600 to-indigo-600',
              status: 'Active',
              createdAt: '2026-09-20',
              monthlyBudget: 25000,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const googleResult = await loginUserViaGoogle('mock_google_id_token_for_lemon');
    expect(googleResult.success).toBe(true);
    expect(googleResult.isNewUser).toBe(false);

    // 7. Existing Google account maps to existing Tallix user
    expect(googleResult.user?.id).toBe(existingUserId);
    expect(googleResult.user?.email).toBe(existingEmail);

    // 8. Google login does not create duplicate user in local repository
    const allUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    const lemonUsers = allUsers.filter((u) => u.email.toLowerCase() === existingEmail.toLowerCase());
    expect(lemonUsers.length).toBe(1);
    expect(lemonUsers[0].id).toBe(existingUserId);

    // Verify cached password was preserved for subsequent password logins
    expect(lemonUsers[0].password).toBe(existingPassword);
  });

  it('9: Logout does not delete financial data (expenses, settlements, groups)', async () => {
    await idbPut(STORES.EXPENSES, mockExpense);
    await idbPut(STORES.SETTLEMENTS, mockSettlement1);
    await idbPut(STORES.GROUPS, mockGroup);

    // Simulate logout action
    syncEngine.resetUserState();
    mockStorage.removeItem('tallix_auth');
    mockStorage.removeItem('tallix_user');

    // Check that financial data in IndexedDB is 100% untouched
    const expenses = await LocalRepository.getAllExpenses();
    const settlements = await LocalRepository.getAllSettlements();
    const groups = await LocalRepository.getAllGroups();

    expect(expenses.length).toBe(1);
    expect(expenses[0].id).toBe(mockExpense.id);
    expect(expenses[0].amount).toBe(1200);

    expect(settlements.length).toBe(1);
    expect(settlements[0].id).toBe(mockSettlement1.id);
    expect(settlements[0].amount).toBe(100);

    expect(groups.length).toBe(1);
    expect(groups[0].id).toBe(mockGroup.id);
  });

  it('10: Sync does not remove existing settlements or erase cached credentials', async () => {
    // Seed user with password and an existing settlement
    await idbPut(STORES.USERS, mockExistingUser);
    await idbPut(STORES.SETTLEMENTS, mockSettlement1);

    // Mock sync pull endpoint returning updated data without deleting existing settlements
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/health')) {
        return new Response(JSON.stringify({ status: 'operational' }), { status: 200 });
      }
      if (url.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            success: true,
            serverTimestamp: new Date().toISOString(),
            expenses: [mockExpense],
            groups: [mockGroup],
            settlements: [mockSettlement1, mockSettlement2],
            registeredUsers: [
              // Server returns user profile WITHOUT password for security
              {
                id: existingUserId,
                name: 'Lemon',
                email: existingEmail,
                systemRole: 'User',
                status: 'Active',
              },
            ],
            deletedExpenseIds: [],
            deletedGroupIds: [],
            deletedSettlementIds: [],
            deletedUserIds: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    syncEngine.setUserId(existingUserId);
    const syncRes = await syncEngine.triggerSync();
    expect(syncRes.success).toBe(true);

    // Verify settlements were NOT removed by sync
    const settlements = await LocalRepository.getAllSettlements();
    expect(settlements.length).toBe(2);
    expect(settlements.some((s) => s.id === mockSettlement1.id)).toBe(true);
    expect(settlements.some((s) => s.id === mockSettlement2.id)).toBe(true);

    // Verify user password in local cache was NOT erased by sync pull
    const userInDb = await idbGet<RegisteredUser>(STORES.USERS, existingUserId);
    expect(userInDb?.password).toBe(existingPassword);
  });
});
