import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerUserToCloudflareD1, fetchAdminUsersFromD1 } from './services/authService';
import { buildApiUrl, getAdminAuthHeaders } from './services/apiConfig';
import { LocalRepository } from './services/localRepository';
import { idbGetAll, idbClear, STORES } from './services/indexedDB';
import { RegisteredUser } from './types';
import { SyncMutation } from './services/syncTypes';

describe('Authoritative User Registration & Admin D1 Architecture', () => {
  beforeEach(async () => {
    await idbClear(STORES.USERS);
    await idbClear(STORES.SYNC_QUEUE);
    vi.restoreAllMocks();
  });

  it('builds valid API URLs with or without custom worker URL', () => {
    const url = buildApiUrl('/api/auth/register');
    expect(url).toContain('/api/auth/register');
  });

  it('generates administrative authentication headers', () => {
    const headers = getAdminAuthHeaders();
    expect(headers['Authorization']).toContain('Bearer');
    expect(headers['X-Admin-Email']).toBe('abdulatiflemon@gmail.com');
  });

  it('registers user through API and updates local IndexedDB cache', async () => {
    const mockUser = {
      id: 'usr_test_123',
      name: 'Sarah Connor',
      email: 'sarah@skynet.com',
      systemRole: 'User' as const,
      roleTitle: 'Financial Member',
      status: 'Active' as const,
    };

    // Mock fetch for /api/auth/register
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          user: mockUser,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await registerUserToCloudflareD1({
      name: 'Sarah Connor',
      email: 'sarah@skynet.com',
      password: 'SecurePassword123!',
    });

    expect(result.success).toBe(true);
    expect(result.isOffline).toBe(false);

    // Verify local IndexedDB cache was updated
    const cachedUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(cachedUsers.length).toBe(1);
    expect(cachedUsers[0].email).toBe('sarah@skynet.com');
  });

  it('propagates duplicate email rejection from server without corrupting cache', async () => {
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
        name: 'Sarah Connor',
        email: 'sarah@skynet.com',
        password: 'SecurePassword123!',
      })
    ).rejects.toThrow('This email is already registered. Please sign in instead.');

    // Verify nothing got saved to cache
    const cachedUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(cachedUsers.length).toBe(0);
  });

  it('falls back gracefully to offline queueing when network is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await registerUserToCloudflareD1({
      name: 'Offline User',
      email: 'offline@domain.com',
      password: 'OfflinePassword123',
    });

    expect(result.success).toBe(true);
    expect(result.isOffline).toBe(true);

    // Verify saved locally in IndexedDB and mutation queued
    const cachedUsers = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(cachedUsers.length).toBe(1);
    expect(cachedUsers[0].email).toBe('offline@domain.com');

    const queuedMutations = await idbGetAll<SyncMutation>(STORES.SYNC_QUEUE);
    expect(queuedMutations.length).toBe(1);
    expect(queuedMutations[0].entityType).toBe('registeredUser');
  });

  it('admin fetch retrieves users and caches them locally', async () => {
    const mockAdminUsers = [
      {
        id: 'usr_admin_1',
        name: 'Super Admin',
        email: 'abdulatiflemon@gmail.com',
        systemRole: 'Admin' as const,
        status: 'Active' as const,
        createdAt: '2026-01-01',
      },
      {
        id: 'usr_reg_2',
        name: 'Alex Rivera',
        email: 'alex@tallix.io',
        systemRole: 'User' as const,
        status: 'Active' as const,
        createdAt: '2026-02-01',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          users: mockAdminUsers,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const users = await fetchAdminUsersFromD1();
    expect(users.length).toBe(2);
    expect(users[0].email).toBe('abdulatiflemon@gmail.com');

    // Verify IndexedDB was populated
    const cached = await idbGetAll<RegisteredUser>(STORES.USERS);
    expect(cached.length).toBe(2);
  });
});
