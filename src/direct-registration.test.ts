import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerUserToCloudflareD1, loginUserViaD1 } from './services/authService';
import { syncEngine } from './services/syncEngine';
import { LocalRepository } from './services/localRepository';
import { idbGetAll, idbClear, STORES } from './services/indexedDB';
import { RegisteredUser } from './types';

describe('Direct Registration & Authentication Architecture (No Email Verification)', () => {
  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.SYNC_QUEUE);
    syncEngine.setUserId(null);
    vi.restoreAllMocks();
  });

  it('1 & 2. New normal user registration creates account directly in D1', async () => {
    const mockUser: RegisteredUser = {
      id: 'usr_new_direct_1',
      name: 'Alice Springs',
      email: 'alice@example.com',
      password: 'StrongPassword123!',
      systemRole: 'User',
      roleTitle: 'Financial Member',
      status: 'Active',
      createdAt: '2026-09-27',
      isVerified: true,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          user: mockUser,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await registerUserToCloudflareD1({
      name: 'Alice Springs',
      email: 'alice@example.com',
      password: 'StrongPassword123!',
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe('alice@example.com');
    expect(result.user.status).toBe('Active');
    expect(result.user.isVerified).toBe(true);

    // Verify endpoint called was directly /api/auth/register
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0].toString();
    expect(calledUrl).toContain('/api/auth/register');

    // Verify cached in IndexedDB
    const cachedUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(cachedUsers.some((u) => u.email === 'alice@example.com')).toBe(true);
  });

  it('3. No email/OTP request occurs during registration', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          user: {
            id: 'usr_test_no_otp',
            name: 'Bob Ross',
            email: 'bob@paint.com',
            status: 'Active',
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await registerUserToCloudflareD1({
      name: 'Bob Ross',
      email: 'bob@paint.com',
      password: 'HappyLittleTrees123!',
    });

    // Verify none of the calls were to OTP or verification endpoints
    const calledUrls = fetchSpy.mock.calls.map((c) => c[0].toString());
    expect(calledUrls.some((u) => u.includes('send-verification'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('verify-code'))).toBe(false);
    expect(calledUrls.some((u) => u.includes('register'))).toBe(true);
  });

  it('4. User can immediately log in after registration', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          user: {
            id: 'usr_reg_user',
            name: 'Immediate User',
            email: 'immediate@tallix.io',
            systemRole: 'User',
            status: 'Active',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const loginResult = await loginUserViaD1('immediate@tallix.io', 'ImmediatePass123!');
    expect(loginResult.success).toBe(true);
    expect(loginResult.user?.email).toBe('immediate@tallix.io');
    expect(loginResult.registeredUser?.status).toBe('Active');
  });

  it('5. Normal user can sync after login', async () => {
    syncEngine.setUserId('usr_reg_user');
    expect(syncEngine.getUserId()).toBe('usr_reg_user');

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/health')) {
        return new Response(JSON.stringify({ status: 'operational', databaseConnected: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            expenses: [],
            groups: [],
            settlements: [],
            users: [],
            serverTimestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 200 });
    });

    const syncResult = await syncEngine.triggerSync();
    expect(syncResult.success).toBe(true);
    expect(syncEngine.getStatus().isOnline).toBe(true);
  });

  it('6. Admin login still works', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          user: {
            id: 'usr_admin_master',
            name: 'Master Admin',
            email: 'abdulatiflemon@gmail.com',
            systemRole: 'Admin',
            status: 'Active',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await loginUserViaD1('abdulatiflemon@gmail.com', 'AdminPass123!');
    expect(result.success).toBe(true);
    expect(result.user?.systemRole).toBe('Admin');
  });

  it('7. Existing users can still log in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          user: {
            id: 'usr_existing_1',
            name: 'Existing Member',
            email: 'existing@tallix.io',
            systemRole: 'User',
            status: 'Active',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await loginUserViaD1('existing@tallix.io', 'ExistingPassword123!');
    expect(result.success).toBe(true);
    expect(result.user?.id).toBe('usr_existing_1');
  });

  it('8. Disabled users remain blocked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Your account has been deactivated. Please contact an administrator.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await loginUserViaD1('banned@tallix.io', 'AnyPassword123!');
    expect(result.success).toBe(false);
    expect(result.error).toContain('deactivated');
  });

  it('9. Password validation returns error when incorrect', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid email or password. Please try again.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await loginUserViaD1('alice@example.com', 'WrongPassword!');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid email or password. Please try again.');
  });

  it('10. Duplicate email still correctly shows account already exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: 'This email is already registered. Please sign in instead.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(
      registerUserToCloudflareD1({
        name: 'Duplicate User',
        email: 'alice@example.com',
        password: 'AnotherPassword123!',
      })
    ).rejects.toThrow('This email is already registered. Please sign in instead.');
  });
});
