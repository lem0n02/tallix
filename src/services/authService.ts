// Authoritative Authentication & Cloudflare D1 User Registry Service for Tallix
import { RegisteredUser } from '../types';
import { buildApiUrl, getAdminAuthHeaders } from './apiConfig';
import { LocalRepository } from './localRepository';
import { idbPut, STORES } from './indexedDB';

export interface RegisterUserInput {
  id?: string;
  name: string;
  email: string;
  password?: string;
  systemRole?: 'Admin' | 'User';
  roleTitle?: string;
  department?: string;
  avatarGradient?: string;
  status?: 'Active' | 'Disabled';
}

export interface RegisterUserResult {
  success: boolean;
  user: RegisteredUser;
  isOffline?: boolean;
  message?: string;
}

/**
 * Registers a new user into Cloudflare D1 with local IndexedDB caching and offline fallback.
 * Follows the flow:
 * Validate locally -> Call Cloudflare Worker /api/auth/register -> Persist in D1 -> Update local cache -> Continue login
 */
export async function registerUserToCloudflareD1(input: RegisterUserInput): Promise<RegisterUserResult> {
  const cleanEmail = input.email.trim().toLowerCase();
  const userId = input.id || `usr_reg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  const userRecord: RegisteredUser = {
    id: userId,
    name: input.name.trim(),
    email: cleanEmail,
    password: input.password,
    systemRole: input.systemRole || 'User',
    roleTitle: input.roleTitle || 'Financial Member',
    department: input.department || 'Personal Workspace',
    avatarGradient: input.avatarGradient || 'from-blue-600 to-indigo-600',
    createdAt: now.split('T')[0],
    updatedAt: now,
    status: input.status || 'Active',
    isVerified: true,
  };

  // If client is intentionally or detectably offline, safely queue mutation
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    console.info('[AuthService] Device is offline. Enqueueing user registration for Cloudflare sync.');
    await LocalRepository.saveRegisteredUser(userRecord);
    return {
      success: true,
      user: userRecord,
      isOffline: true,
      message: 'Account created offline. Will sync with Cloudflare D1 when connection returns.',
    };
  }

  const endpointUrl = buildApiUrl('/api/auth/register');

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: userId,
        name: input.name.trim(),
        email: cleanEmail,
        password: input.password,
        systemRole: input.systemRole || 'User',
        roleTitle: input.roleTitle || 'Financial Member',
        department: input.department || 'Personal Workspace',
        avatarGradient: input.avatarGradient || 'from-blue-600 to-indigo-600',
        status: input.status || 'Active',
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      const errorMessage = data.error || (response.status === 409
        ? 'This email is already registered. Please sign in instead.'
        : `Registration failed (${response.status})`);
      throw new Error(errorMessage);
    }

    // Success in Cloudflare D1!
    // Cache the registered user in local IndexedDB so the session and local features have immediate access
    await idbPut(STORES.USERS, userRecord);

    return {
      success: true,
      user: {
        ...userRecord,
        ...(data.user || {}),
      },
      isOffline: false,
    };
  } catch (err: any) {
    // If it's an explicit validation/duplicate error from the server, propagate it to the UI
    if (err.message && !err.message.includes('fetch') && !err.message.includes('network') && !err.message.includes('Failed to fetch')) {
      throw err;
    }

    // If it was a network connectivity failure, fallback safely to offline-first queueing
    console.warn('[AuthService] Network unreachable during registration. Preserving offline registration mutation.', err);
    await LocalRepository.saveRegisteredUser(userRecord);
    return {
      success: true,
      user: userRecord,
      isOffline: true,
      message: 'Connection issue. Registration queued locally and will sync to Cloudflare D1 automatically.',
    };
  }
}

/**
 * Authoritative retrieval of registered users from Cloudflare D1 through the Worker API.
 * Never exposes passwords or authentication secrets.
 * Updates local IndexedDB cache with the authoritative records.
 */
export async function fetchAdminUsersFromD1(): Promise<RegisteredUser[]> {
  const endpointUrl = buildApiUrl('/api/admin/users');
  const headers = getAdminAuthHeaders();

  try {
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.users)) {
        // Cache fetched users in IndexedDB
        for (const u of data.users) {
          try {
            await idbPut(STORES.USERS, u);
          } catch {
            // Ignore cache put issues
          }
        }
        return data.users;
      }
    }
  } catch (err) {
    console.warn('[AuthService] Could not reach Cloudflare D1 Admin API, falling back to local cache.', err);
  }

  // Offline or network fallback: return local IndexedDB cache
  return LocalRepository.getAllRegisteredUsers();
}

/**
 * Development & Verification helper to inspect D1 user counts.
 */
export async function verifyD1UserDatabase(): Promise<{ totalUsers: number; source: string; timestamp: string }> {
  const endpointUrl = buildApiUrl('/api/admin/db-verify');
  const headers = getAdminAuthHeaders();

  try {
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers,
    });
    if (response.ok) {
      const data = await response.json();
      return {
        totalUsers: data.totalUsers ?? 0,
        source: data.database || 'Cloudflare D1',
        timestamp: data.timestamp || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('[AuthService] DB verification check unreachable:', err);
  }

  const localUsers = await LocalRepository.getAllRegisteredUsers();
  return {
    totalUsers: localUsers.length,
    source: 'Local IndexedDB Cache (offline)',
    timestamp: new Date().toISOString(),
  };
}
