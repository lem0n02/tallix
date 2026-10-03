import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { hashPassword, loginUserViaD1 } from './services/authService';
import { idbClear, idbPut, idbGet, STORES } from './services/indexedDB';
import { syncEngine } from './services/syncEngine';
import { RegisteredUser } from './types';

describe('Legacy Password Hash Forensic & Compatibility Verification', () => {
  const controlledPassword = 'ControlledAuditPassword2026!';
  let expectedHash: string;

  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.SYNC_QUEUE);
    syncEngine.setUserId(null);
    vi.restoreAllMocks();
    expectedHash = crypto.createHash('sha256').update(controlledPassword, 'utf8').digest('hex');
  });

  it('1. Reproduces exact hash matching original registration algorithm', async () => {
    const webCryptoResult = await hashPassword(controlledPassword);
    const nodeCryptoResult = crypto.createHash('sha256').update(controlledPassword, 'utf8').digest('hex');

    expect(webCryptoResult).toBe(nodeCryptoResult);
    expect(webCryptoResult).toHaveLength(64);
    expect(webCryptoResult).toBe(expectedHash);
  });

  it('2. Verifies backward compatibility for mobile trailing whitespace on login', async () => {
    const mockUserRecord: RegisteredUser = {
      id: 'usr_forensic_test_1',
      name: 'Forensic User',
      email: 'forensic@tallix.internal',
      password_hash: expectedHash,
      systemRole: 'User',
      status: 'Active',
      createdAt: '2026-09-20',
    };
    await idbPut(STORES.USERS, mockUserRecord);

    // Simulate network offline to test local verification logic with trailing space
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

    // Exact password
    const exactRes = await loginUserViaD1('forensic@tallix.internal', controlledPassword);
    expect(exactRes.success).toBe(true);

    // Password with mobile accidental trailing space
    const trailingSpaceRes = await loginUserViaD1('forensic@tallix.internal', `${controlledPassword} `);
    expect(trailingSpaceRes.success).toBe(true);

    // Completely wrong password must still fail
    const wrongRes = await loginUserViaD1('forensic@tallix.internal', 'CompletelyWrongPass123!');
    expect(wrongRes.success).toBe(false);
  });

  it('3. Confirms user profiles returned by login never expose password_hash', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          user: {
            id: 'usr_forensic_clean',
            name: 'Audit User',
            email: 'audit@tallix.internal',
            systemRole: 'User',
            status: 'Active',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const loginRes = await loginUserViaD1('audit@tallix.internal', controlledPassword);
    expect(loginRes.success).toBe(true);
    expect((loginRes.user as any)?.password).toBeUndefined();
    expect((loginRes.user as any)?.password_hash).toBeUndefined();
    expect((loginRes.user as any)?.passwordHash).toBeUndefined();
  });

  it('4. Confirms syncEngine never replaces existing credentials with undefined', async () => {
    const initialUser: RegisteredUser = {
      id: 'usr_preserve_creds',
      name: 'Preserved User',
      email: 'preserved@tallix.internal',
      password: controlledPassword,
      password_hash: expectedHash,
      systemRole: 'User',
      status: 'Active',
      createdAt: '2026-09-20',
    };
    await idbPut(STORES.USERS, initialUser);

    vi.spyOn(syncEngine, 'checkReachability').mockResolvedValue(true);
    syncEngine.setUserId('usr_preserve_creds');

    // Remote pull returns sanitized user without password or password_hash
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
      const url = input.toString();
      if (url.includes('/api/sync/pull')) {
        return new Response(
          JSON.stringify({
            success: true,
            registeredUsers: [
              {
                id: 'usr_preserve_creds',
                name: 'Preserved User Updated Name',
                email: 'preserved@tallix.internal',
                systemRole: 'User',
                status: 'Active',
                // password and password_hash omitted
              },
            ],
            expenses: [],
            groups: [],
            settlements: [],
            serverTimestamp: '2026-10-02T19:35:00.000Z',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    if (url.includes('/api/health')) {
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  });

  const syncResult = await syncEngine.triggerSync();
  if (!syncResult.success) {
    console.error('triggerSync error:', syncResult.error);
  }

    const storedUser = await idbGet<RegisteredUser>(STORES.USERS, 'usr_preserve_creds');
    expect(storedUser?.name).toBe('Preserved User Updated Name');
    expect(storedUser?.password).toBe(controlledPassword);
    expect(storedUser?.password_hash).toBe(expectedHash);
  });
});
