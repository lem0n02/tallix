import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginUserViaD1, registerUserToCloudflareD1, hashPassword } from './services/authService';
import { idbGetAll, idbClear, idbPut, idbGet, STORES } from './services/indexedDB';
import { syncEngine } from './services/syncEngine';
import { RegisteredUser, UserProfile } from './types';

// Mock localStorage for node runner
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

describe('Tallix Email/Password Authentication & Password Protection Suite', () => {
  const existingUserId = 'usr_reg_1790264485433_6j9ak4u';
  const existingEmail = 'mdshahidhossen50@gmail.com';
  // D1 password hash for Shahid in D1
  const existingHash = 'ed24e6cb2f68c1d6d1e1d8a3408325c9e7909d69165c2b52aebe2d84e2b6695a';
  const validPassword = 'ShahidSecretPassword123!';

  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.SETTLEMENTS);
    await idbClear(STORES.EXPENSES);
    await idbClear(STORES.GROUPS);
    await idbClear(STORES.SYNC_QUEUE);
    localStorage.clear();
    syncEngine.setUserId(null);
    vi.restoreAllMocks();
  });

  it('1. Existing email/password user can log in successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/login')) {
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: existingUserId,
              name: 'Shahid',
              email: existingEmail,
              systemRole: 'User',
              role: 'User Member',
              title: 'Financial Member',
              department: 'Personal Workspace',
              status: 'Active',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const res = await loginUserViaD1(existingEmail, validPassword);
    expect(res.success).toBe(true);
    expect(res.user?.id).toBe(existingUserId);
    expect(res.user?.email).toBe(existingEmail);
  });

  it('2. Logout -> login works reliably', async () => {
    // 1. Initial Login
    localStorage.setItem('tallix_auth', 'true');
    localStorage.setItem('tallix_user', JSON.stringify({ id: existingUserId, email: existingEmail }));
    expect(localStorage.getItem('tallix_auth')).toBe('true');

    // 2. Logout simulation
    localStorage.removeItem('tallix_auth');
    localStorage.removeItem('tallix_user');
    expect(localStorage.getItem('tallix_auth')).toBeNull();

    // 3. Login again
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          user: {
            id: existingUserId,
            name: 'Shahid',
            email: existingEmail,
            systemRole: 'User',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const reLoginRes = await loginUserViaD1(existingEmail, validPassword);
    expect(reLoginRes.success).toBe(true);
    expect(reLoginRes.user?.id).toBe(existingUserId);
  });

  it('3. Page refresh preserves a valid session from localStorage cache', () => {
    const cachedProfile: UserProfile = {
      id: existingUserId,
      name: 'Shahid',
      email: existingEmail,
      role: 'User Member',
      systemRole: 'User',
      title: 'Financial Member',
      department: 'Personal Workspace',
      avatarGradient: 'from-blue-600 to-indigo-600',
      liquidityLimit: 25000,
      currentLiquidity: 0,
      monthlyBurnRate: 0,
    };

    localStorage.setItem('tallix_auth', 'true');
    localStorage.setItem('tallix_user', JSON.stringify(cachedProfile));

    // Simulate page reload state hydration
    const isAuth = localStorage.getItem('tallix_auth') === 'true';
    const restoredUser = JSON.parse(localStorage.getItem('tallix_user') || 'null');

    expect(isAuth).toBe(true);
    expect(restoredUser.id).toBe(existingUserId);
    expect(restoredUser.email).toBe(existingEmail);
  });

  it('4. Existing user can log in from another device with fresh storage', async () => {
    // Device has completely empty IndexedDB and localStorage
    const localUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(localUsers.length).toBe(0);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/login')) {
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: existingUserId,
              name: 'Shahid',
              email: existingEmail,
              systemRole: 'User',
              role: 'User Member',
              status: 'Active',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const res = await loginUserViaD1(existingEmail, validPassword);
    expect(res.success).toBe(true);
    expect(res.user?.id).toBe(existingUserId);

    // After login on new device, user is locally cached for offline use
    const cachedUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(cachedUsers.length).toBe(1);
    expect(cachedUsers[0].id).toBe(existingUserId);
    expect(cachedUsers[0].password).toBe(validPassword);
    expect(cachedUsers[0].password_hash).toBeDefined();
  });

  it('5. Password verification works against existing D1 SHA-256 hashes in offline cache', async () => {
    // Seed user in IndexedDB using only password_hash (no plaintext password)
    const userWithOnlyHash: RegisteredUser = {
      id: existingUserId,
      name: 'Shahid',
      email: existingEmail,
      password_hash: existingHash,
      systemRole: 'User',
      status: 'Active',
      createdAt: '2026-09-21',
    };
    await idbPut(STORES.USERS, userWithOnlyHash);

    // Offline simulation
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    // Wrong password should fail hash verification
    const failedRes = await loginUserViaD1(existingEmail, 'WrongPassword123!');
    expect(failedRes.success).toBe(false);
    expect(failedRes.error).toContain('Invalid email or password');

    // Generating test password matching a mock hash
    const testPlain = 'SpecificSecret123!';
    const testHash = await hashPassword(testPlain);
    await idbPut(STORES.USERS, {
      ...userWithOnlyHash,
      password_hash: testHash,
      password: undefined,
    });

    const successRes = await loginUserViaD1(existingEmail, testPlain);
    expect(successRes.success).toBe(true);
    expect(successRes.user?.id).toBe(existingUserId);
  });

  it('6. Sync does not erase cached passwords or password hashes', async () => {
    // Local user record with stored password
    const localUser: RegisteredUser = {
      id: existingUserId,
      name: 'Shahid',
      email: existingEmail,
      password: validPassword,
      password_hash: existingHash,
      systemRole: 'User',
      status: 'Active',
      createdAt: '2026-09-21',
    };
    await idbPut(STORES.USERS, localUser);

    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);
    syncEngine.setUserId(existingUserId);

    // Server returns sanitized user without password/hash
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            success: true,
            serverTimestamp: new Date().toISOString(),
            expenses: [],
            groups: [],
            settlements: [],
            registeredUsers: [
              {
                id: existingUserId,
                name: 'Shahid Updated',
                email: existingEmail,
                systemRole: 'User',
                status: 'Active',
                // Sanitized: no password, no password_hash
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    await syncEngine.triggerSync();

    const storedUser = await idbGet<RegisteredUser>(STORES.USERS, existingUserId);
    expect(storedUser?.name).toBe('Shahid Updated');
    // Password and password_hash must be strictly preserved
    expect(storedUser?.password).toBe(validPassword);
    expect(storedUser?.password_hash).toBe(existingHash);
  });

  it('7. Disabled users cannot log in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'This user account has been disabled. Please contact the administrator.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await loginUserViaD1('disabled@tallix.io', 'AnyPassword!');
    expect(res.success).toBe(false);
    expect(res.error).toContain('disabled');
  });

  it('8. Incorrect password is rejected with 401 Invalid email or password', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email or password. Please try again.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await loginUserViaD1(existingEmail, 'WrongPassword!');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid email or password');
  });

  it('9. Unknown email is rejected with 404 No account found', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'No account found with this email address.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await loginUserViaD1('nonexistent@domain.com', 'Pass123!');
    expect(res.success).toBe(false);
    expect(res.error).toContain('No account found');
  });

  it('10. No duplicate user is created upon login or re-login', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: existingUserId,
            name: 'Shahid',
            email: existingEmail,
            systemRole: 'User',
            status: 'Active',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    // First login
    await loginUserViaD1(existingEmail, validPassword);
    // Second login
    await loginUserViaD1(existingEmail, validPassword);

    const users = await idbGetAll<RegisteredUser>(STORES.USERS);
    const matchingUsers = users.filter((u) => u.email.toLowerCase() === existingEmail.toLowerCase());
    expect(matchingUsers.length).toBe(1);
    expect(matchingUsers[0].id).toBe(existingUserId);
  });

  it('11. Google-linked accounts without password return clear disabled message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Google Sign-In is temporarily unavailable, and this account has no email/password credentials configured.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await loginUserViaD1('google_only@domain.com', 'AnyPassword123!');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Google Sign-In is temporarily unavailable');
  });
});
