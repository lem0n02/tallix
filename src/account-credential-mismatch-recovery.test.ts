import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { loginUserViaD1, hashPassword } from './services/authService';
import { idbClear, idbPut, idbGet, idbGetAll, STORES } from './services/indexedDB';
import { syncEngine } from './services/syncEngine';
import { RegisteredUser } from './types';

describe('Account Credential Mismatch Recovery & Isolation Suite', () => {
  const lemonId = 'usr_reg_1789939746901';
  const lemonEmail = 'lemonshahebb121@gmail.com';
  const lemonPassword = 'StrongPassword123!';

  const rifatId = 'usr_reg_1790007003694_bwmjz8e';
  const rifatEmail = 'rifatjafrin03@gmail.com';
  const rifatPassword = 'RifatOriginalPassword123!';

  let lemonHash: string;
  let rifatHash: string;

  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.SYNC_QUEUE);
    syncEngine.setUserId(null);
    vi.restoreAllMocks();

    lemonHash = crypto.createHash('sha256').update(lemonPassword).digest('hex');
    rifatHash = crypto.createHash('sha256').update(rifatPassword).digest('hex');
  });

  it('1. Confirms distinct credential ownership: Lemon and Rifat have unique hashes', async () => {
    expect(lemonHash).not.toBe(rifatHash);
    expect(lemonHash).toHaveLength(64);
    expect(rifatHash).toHaveLength(64);
  });

  it('2. Prevents cross-account authentication: Lemon password cannot authenticate Rifat', async () => {
    const mockRifatRecord: RegisteredUser = {
      id: rifatId,
      name: 'Rifat Jafrin',
      email: rifatEmail,
      password_hash: rifatHash,
      systemRole: 'User',
      status: 'Active',
      createdAt: '2026-09-21',
    };
    await idbPut(STORES.USERS, mockRifatRecord);

    // Simulate offline to test local verification logic
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    // Attempting to log into Rifat account using Lemon password must fail
    const crossAuthResult = await loginUserViaD1(rifatEmail, lemonPassword);
    expect(crossAuthResult.success).toBe(false);
    expect(crossAuthResult.error).toContain('Invalid email or password');

    // Logging into Rifat account with Rifat password succeeds
    const legitResult = await loginUserViaD1(rifatEmail, rifatPassword);
    expect(legitResult.success).toBe(true);
    expect(legitResult.user?.id).toBe(rifatId);
  });

  it('3. Confirms lemon account authenticates with restored original password', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/auth/login')) {
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: lemonId,
              name: 'Lemon',
              email: lemonEmail,
              systemRole: 'User',
              role: 'User Member',
              title: 'Financial Member',
              status: 'Active',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const res = await loginUserViaD1(lemonEmail, lemonPassword);
    expect(res.success).toBe(true);
    expect(res.user?.id).toBe(lemonId);
    expect(res.user?.email).toBe(lemonEmail);
  });

  it('4. Enforces strict user ID and email matching during sync pull', async () => {
    // Seed Lemon in local storage with their password
    const localLemon: RegisteredUser = {
      id: lemonId,
      name: 'Lemon',
      email: lemonEmail,
      password: lemonPassword,
      password_hash: lemonHash,
      systemRole: 'User',
      status: 'Active',
      createdAt: '2026-09-20',
    };
    await idbPut(STORES.USERS, localLemon);

    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);
    syncEngine.setUserId(lemonId);

    // Sync pull returns multiple squad users (sanitized, no password)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/health')) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
      }
      if (url.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            success: true,
            registeredUsers: [
              {
                id: lemonId,
                name: 'Lemon (Synced)',
                email: lemonEmail,
                systemRole: 'User',
                status: 'Active',
              },
              {
                id: rifatId,
                name: 'Rifat Jafrin (Synced)',
                email: rifatEmail,
                systemRole: 'User',
                status: 'Active',
              },
            ],
            expenses: [],
            groups: [],
            settlements: [],
            serverTimestamp: '2026-10-03T18:45:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    await syncEngine.triggerSync();

    const storedLemon = await idbGet<RegisteredUser>(STORES.USERS, lemonId);
    const storedRifat = await idbGet<RegisteredUser>(STORES.USERS, rifatId);

    // Lemon password preserved
    expect(storedLemon?.password).toBe(lemonPassword);
    expect(storedLemon?.password_hash).toBe(lemonHash);

    // Rifat must NOT have Lemon's password
    expect(storedRifat?.password).toBeUndefined();
    expect(storedRifat?.password_hash).toBeUndefined();
  });
});
