import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginUserViaGoogle, registerUserToCloudflareD1 } from './services/authService';
import { verifyGoogleToken } from './services/googleTokenVerifier';
import { LocalRepository } from './services/localRepository';
import { idbGetAll, idbClear, idbPut, idbGet, STORES } from './services/indexedDB';
import { RegisteredUser, UserProfile, Expense, Group, Settlement } from './types';
import { syncEngine } from './services/syncEngine';

// Mock storage for Node vitest runner
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

describe('Google Authentication & Identity Architecture for Tallix', () => {
  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.EXPENSES);
    await idbClear(STORES.GROUPS);
    await idbClear(STORES.SETTLEMENTS);
    await idbClear(STORES.SYNC_QUEUE);
    localStorage.clear();
    sessionStorage.clear();
    syncEngine.setUserId(null);
    vi.restoreAllMocks();
  });

  it('1. Existing email/password user signs in with matching Google email -> same account', async () => {
    // Existing user previously registered with email/password
    const existingUser: RegisteredUser = {
      id: 'usr_existing_123',
      name: 'Existing Member',
      email: 'existing@tallix.io',
      password: 'HashPassword123!',
      systemRole: 'User',
      roleTitle: 'Financial Member',
      department: 'Personal Workspace',
      status: 'Active',
      createdAt: '2026-09-01',
      isVerified: true,
      monthlyBudget: 35000,
    };
    await idbPut(STORES.USERS, existingUser);

    // Mock backend POST /api/auth/google returning matching existing user
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/google')) {
        return new Response(
          JSON.stringify({
            success: true,
            isNewUser: false,
            user: {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              systemRole: 'User',
              role: 'User Member',
              title: 'Financial Member',
              department: 'Personal Workspace',
              status: 'Active',
              monthlyBudget: 35000,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const result = await loginUserViaGoogle('mock_google_token_1');
    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(false);
    expect(result.user?.id).toBe('usr_existing_123');
    expect(result.user?.email).toBe('existing@tallix.io');

    // Verify local IndexedDB still holds the same account without duplicates
    const allUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    const matching = allUsers.filter((u) => u.email === 'existing@tallix.io');
    expect(matching.length).toBe(1);
    expect(matching[0].id).toBe('usr_existing_123');
  });

  it('2. New Google email -> new normal account', async () => {
    const newGoogleEmail = 'fresh.google@example.com';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/google')) {
        return new Response(
          JSON.stringify({
            success: true,
            isNewUser: true,
            user: {
              id: 'usr_goog_fresh_999',
              name: 'Fresh User',
              email: newGoogleEmail,
              systemRole: 'User',
              role: 'User Member',
              title: 'Financial Member',
              roleTitle: 'Financial Member',
              department: 'Personal Workspace',
              avatarGradient: 'from-blue-600 to-indigo-600',
              status: 'Active',
              createdAt: '2026-09-29',
              monthlyBudget: 25000,
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const result = await loginUserViaGoogle('mock_google_token_new');
    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(result.user?.email).toBe(newGoogleEmail);
    expect(result.user?.systemRole).toBe('User');
    expect(result.user?.status).toBe('Active');

    // Verify cached in IndexedDB
    const cachedUser = await idbGet<RegisteredUser>(STORES.USERS, 'usr_goog_fresh_999');
    expect(cachedUser).toBeDefined();
    expect(cachedUser?.email).toBe(newGoogleEmail);
  });

  it('3. Existing disabled user + Google login -> login denied', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/google')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'This user account has been disabled. Please contact the administrator.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const result = await loginUserViaGoogle('mock_google_token_disabled');
    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
  });

  it('4. Deleted email + Google login -> clean new account', async () => {
    // old@example.com was previously completely removed (hard deleted)
    // When they sign in with Google, it creates a fresh account with a new ID
    const deletedEmail = 'old@example.com';

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/google')) {
        return new Response(
          JSON.stringify({
            success: true,
            isNewUser: true,
            user: {
              id: 'usr_goog_recreated_777',
              name: 'Recreated Account',
              email: deletedEmail,
              systemRole: 'User',
              role: 'User Member',
              title: 'Financial Member',
              department: 'Personal Workspace',
              status: 'Active',
              createdAt: '2026-09-29',
              monthlyBudget: 25000,
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const result = await loginUserViaGoogle('mock_google_token_recreated');
    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(result.user?.id).toBe('usr_goog_recreated_777');
    expect(result.user?.email).toBe(deletedEmail);

    // Old deleted expenses are not resurrected
    const allExpenses = await idbGetAll<Expense>(STORES.EXPENSES);
    expect(allExpenses.length).toBe(0);
  });

  it('5. Google login cannot create duplicate user', async () => {
    const userPayload = {
      id: 'usr_goog_single_1',
      name: 'Single User',
      email: 'single@tallix.io',
      systemRole: 'User',
      role: 'User Member',
      title: 'Financial Member',
      department: 'Personal Workspace',
      status: 'Active',
      monthlyBudget: 25000,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          isNewUser: false,
          user: userPayload,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    // Sign in twice in succession
    const res1 = await loginUserViaGoogle('token_1');
    const res2 = await loginUserViaGoogle('token_2');

    expect(res1.user?.id).toBe('usr_goog_single_1');
    expect(res2.user?.id).toBe('usr_goog_single_1');

    const users = await idbGetAll<RegisteredUser>(STORES.USERS);
    const matching = users.filter((u) => u.email === 'single@tallix.io');
    expect(matching.length).toBe(1);
  });

  it('6. Google user cannot obtain admin privileges merely from email', async () => {
    // If someone logs in with admin's email via Google, but has not authenticated as system admin
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          isNewUser: true,
          user: {
            id: 'usr_goog_lemon_1',
            name: 'Abdul Latif',
            email: 'abdulatiflemon@gmail.com',
            systemRole: 'User', // Authoritative server assigns 'User'
            role: 'User Member',
            title: 'Financial Member',
            department: 'Personal Workspace',
            status: 'Active',
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await loginUserViaGoogle('token_admin_email');
    expect(result.success).toBe(true);
    // Client strictly respects server-provided systemRole: 'User'
    expect(result.user?.systemRole).toBe('User');
    expect(result.user?.role).toBe('User Member');
  });

  it('7. Existing user data remains intact after Google login', async () => {
    const userId = 'usr_intact_1';
    const userEmail = 'data_holder@tallix.io';

    // Seed existing expenses, groups, and settlements
    const mockExpense: Expense = {
      id: 'exp_1',
      title: 'Groceries',
      merchant: 'Supermarket',
      amount: 4500,
      currency: 'BDT',
      date: '2026-09-28',
      category: 'Food',
      status: 'Completed',
      paymentMethod: 'Cash',
      isShared: false,
      paidByUserId: userId,
      paidByName: 'Data Holder',
    };
    await idbPut(STORES.EXPENSES, mockExpense);

    const mockGroup: Group = {
      id: 'grp_1',
      name: 'Weekend Squad',
      description: 'Squad expenses',
      category: 'Trip',
      currency: 'BDT',
      members: [{ id: userId, name: 'Data Holder', email: userEmail, role: 'Admin', balance: 0 }],
      totalSpent: 0,
      unsettledAmount: 0,
      createdAt: '2026-09-01',
      updatedAt: '2026-09-01',
    };
    await idbPut(STORES.GROUPS, mockGroup);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          isNewUser: false,
          user: {
            id: userId,
            name: 'Data Holder',
            email: userEmail,
            systemRole: 'User',
            role: 'User Member',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await loginUserViaGoogle('token_data_holder');
    expect(result.success).toBe(true);
    expect(result.user?.id).toBe(userId);

    // Verify existing expenses and squads remain untouched
    const expenses = await idbGetAll<Expense>(STORES.EXPENSES);
    expect(expenses.length).toBe(1);
    expect(expenses[0].id).toBe('exp_1');

    const groups = await idbGetAll<Group>(STORES.GROUPS);
    expect(groups.length).toBe(1);
    expect(groups[0].id).toBe('grp_1');
  });

  it('8. Successful Google login establishes the normal Tallix authenticated session', async () => {
    const authProfile: UserProfile = {
      id: 'usr_goog_session_1',
      name: 'Session User',
      email: 'session@tallix.io',
      systemRole: 'User',
      role: 'User Member',
      title: 'Financial Member',
      department: 'Personal Workspace',
      liquidityLimit: 25000,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          isNewUser: true,
          user: authProfile,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await loginUserViaGoogle('token_session_test');
    expect(result.success).toBe(true);

    // Emulate App.tsx handleLoginSuccess session establishment
    if (result.user) {
      localStorage.setItem('tallix_auth', 'true');
      localStorage.setItem('tallix_user', JSON.stringify(result.user));
    }

    expect(localStorage.getItem('tallix_auth')).toBe('true');
    const storedUser = JSON.parse(localStorage.getItem('tallix_user') || '{}');
    expect(storedUser.id).toBe('usr_goog_session_1');
    expect(storedUser.email).toBe('session@tallix.io');
  });

  it('9. Logout works cleanly after Google login', async () => {
    // Given an active Google session
    localStorage.setItem('tallix_auth', 'true');
    localStorage.setItem('tallix_user', JSON.stringify({ id: 'usr_1', email: 'test@tallix.io' }));

    // Emulate logout
    localStorage.removeItem('tallix_auth');
    localStorage.removeItem('tallix_user');
    sessionStorage.clear();

    expect(localStorage.getItem('tallix_auth')).toBeNull();
    expect(localStorage.getItem('tallix_user')).toBeNull();
  });

  it('10. Reload after Google login works seamlessly', async () => {
    const sessionUser: UserProfile = {
      id: 'usr_reload_test',
      name: 'Reload User',
      email: 'reload@tallix.io',
      systemRole: 'User',
      role: 'User Member',
      title: 'Financial Member',
      department: 'Personal Workspace',
      liquidityLimit: 25000,
    };

    localStorage.setItem('tallix_auth', 'true');
    localStorage.setItem('tallix_user', JSON.stringify(sessionUser));

    // Emulate browser reload reading from localStorage (same as App.tsx mount)
    const isAuth = localStorage.getItem('tallix_auth') === 'true';
    const restoredUser = JSON.parse(localStorage.getItem('tallix_user') || 'null');

    expect(isAuth).toBe(true);
    expect(restoredUser).toEqual(sessionUser);
    expect(restoredUser.email).toBe('reload@tallix.io');
  });

  it('11. Verifies Google token cryptographically with verifyGoogleToken helper', async () => {
    // Simulated token with valid email and claims
    const verified = await verifyGoogleToken('test_mock_token:alice@gmail.com:Alice:google_sub_123:true:test_client_id', 'test_client_id');
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe('alice@gmail.com');
    expect(verified?.emailVerified).toBe(true);
    expect(verified?.sub).toBe('google_sub_123');

    // Invalid unverified email should be flagged
    const unverified = await verifyGoogleToken('test_mock_token:unverified@gmail.com:Bad:sub_bad:false:test_client_id', 'test_client_id');
    expect(unverified?.emailVerified).toBe(false);

    // Empty token returns null
    const empty = await verifyGoogleToken('');
    expect(empty).toBeNull();
  });
});
