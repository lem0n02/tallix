// Authoritative Authentication & Cloudflare D1 User Registry Service for Tallix
import { RegisteredUser, UserProfile } from '../types';
import { buildApiUrl, getAdminAuthHeaders } from './apiConfig';
import { LocalRepository } from './localRepository';
import { idbPut, idbGet, STORES } from './indexedDB';

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

export interface LoginResult {
  success: boolean;
  user?: UserProfile;
  registeredUser?: RegisteredUser;
  error?: string;
  isOffline?: boolean;
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
 * Authoritative user login against Cloudflare D1 with SHA-256 verification and offline cache fallback.
 * Allows any device (mobile, laptop, tablet) to authenticate securely.
 * On success, caches the user profile locally in IndexedDB for subsequent offline access.
 */
export async function loginUserViaD1(email: string, password: string): Promise<LoginResult> {
  const cleanEmail = email.trim().toLowerCase();

  // If device is explicitly offline, check local cache
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    const localUsers = await LocalRepository.getAllRegisteredUsers();
    const localUser = localUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (!localUser) {
      return {
        success: false,
        error: 'You are currently offline, and no local account was found on this device. Connect to the internet to sign in.',
        isOffline: true,
      };
    }
    if (localUser.status === 'Disabled') {
      return {
        success: false,
        error: 'This user account has been disabled. Please contact the administrator.',
      };
    }
    if (localUser.password && localUser.password !== password) {
      return {
        success: false,
        error: 'Invalid email or password. Please try again.',
      };
    }
    const profile: UserProfile = {
      id: localUser.id,
      name: localUser.name,
      email: localUser.email,
      role: localUser.systemRole === 'Admin' ? (localUser.roleTitle || 'Super Administrator') : 'User Member',
      systemRole: localUser.systemRole,
      title: localUser.roleTitle || (localUser.systemRole === 'Admin' ? 'Super Administrator' : 'Financial Member'),
      department: localUser.department || (localUser.systemRole === 'Admin' ? 'Management' : 'Personal Workspace'),
      avatarGradient: localUser.avatarGradient || 'from-emerald-500 to-teal-500',
      liquidityLimit: 120000,
      currentLiquidity: 0,
      monthlyBurnRate: 0,
    };
    return { success: true, user: profile, registeredUser: localUser, isOffline: true };
  }

  const endpointUrl = buildApiUrl('/api/auth/login');
  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: cleanEmail, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || (response.status === 404 ? 'No account found with this email address.' : 'Invalid email or password. Please try again.'),
      };
    }

    const authUser = data.user;
    const userBudget = authUser.monthlyBudget !== undefined ? Number(authUser.monthlyBudget) : (authUser.liquidityLimit !== undefined ? Number(authUser.liquidityLimit) : 25000);
    const userProfile: UserProfile = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      role: authUser.role || 'User Member',
      systemRole: authUser.systemRole || 'User',
      title: authUser.title || authUser.roleTitle || 'Financial Member',
      department: authUser.department || 'Personal Workspace',
      avatarGradient: authUser.avatarGradient || 'from-emerald-500 to-teal-500',
      avatarUrl: authUser.avatarUrl || undefined,
      monthlyBudget: userBudget,
      liquidityLimit: userBudget,
      currentLiquidity: authUser.currentLiquidity || 0,
      monthlyBurnRate: authUser.monthlyBurnRate || 0,
    };

    // Cache the authoritative user locally in IndexedDB
    const registeredUserRecord: RegisteredUser = {
      id: authUser.id,
      name: authUser.name,
      email: authUser.email,
      password: password, // preserved in local device cache for offline credentials validation
      systemRole: authUser.systemRole || 'User',
      roleTitle: authUser.roleTitle || authUser.title || 'Financial Member',
      department: authUser.department || 'Personal Workspace',
      avatarGradient: authUser.avatarGradient || 'from-emerald-500 to-teal-500',
      avatarUrl: authUser.avatarUrl || undefined,
      monthlyBudget: userBudget,
      liquidityLimit: userBudget,
      createdAt: authUser.createdAt || new Date().toISOString().split('T')[0],
      status: authUser.status || 'Active',
      isVerified: true,
      updatedAt: authUser.updatedAt || new Date().toISOString(),
    };

    try {
      await idbPut(STORES.USERS, registeredUserRecord);
    } catch (cacheErr) {
      console.warn('[AuthService] Could not cache login record locally:', cacheErr);
    }

    return {
      success: true,
      user: userProfile,
      registeredUser: registeredUserRecord,
    };
  } catch (networkErr: any) {
    console.warn('[AuthService] Network error during login, attempting local cache fallback:', networkErr);

    // Fall back to local IndexedDB repository if server is unreachable
    const localUsers = await LocalRepository.getAllRegisteredUsers();
    const localUser = localUsers.find(u => u.email.toLowerCase() === cleanEmail);
    if (localUser) {
      if (localUser.status === 'Disabled') {
        return {
          success: false,
          error: 'This user account has been disabled. Please contact the administrator.',
        };
      }
      if (localUser.password && localUser.password !== password) {
        return {
          success: false,
          error: 'Invalid email or password. Please try again.',
        };
      }
      const localBudget = localUser.monthlyBudget !== undefined ? localUser.monthlyBudget : (localUser.liquidityLimit !== undefined ? localUser.liquidityLimit : 25000);
      const profile: UserProfile = {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        role: localUser.systemRole === 'Admin' ? (localUser.roleTitle || 'Super Administrator') : 'User Member',
        systemRole: localUser.systemRole,
        title: localUser.roleTitle || (localUser.systemRole === 'Admin' ? 'Super Administrator' : 'Financial Member'),
        department: localUser.department || (localUser.systemRole === 'Admin' ? 'Management' : 'Personal Workspace'),
        avatarGradient: localUser.avatarGradient || 'from-emerald-500 to-teal-500',
        avatarUrl: localUser.avatarUrl || undefined,
        monthlyBudget: localBudget,
        liquidityLimit: localBudget,
        currentLiquidity: 0,
        monthlyBurnRate: 0,
      };
      return { success: true, user: profile, registeredUser: localUser, isOffline: true };
    }

    return {
      success: false,
      error: 'Unable to connect to the authentication server. Please check your network connection and try again.',
      isOffline: true,
    };
  }
}

export interface UpdateProfileInput {
  userId: string;
  email?: string;
  avatarUrl?: string | null;
  monthlyBudget?: number;
  liquidityLimit?: number;
}

export interface UpdateProfileResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
  isOffline?: boolean;
}

/**
 * Updates the user's Profile Picture (avatarUrl) and/or Monthly Budget.
 * Cloudflare D1 is the authoritative source.
 * Updates local IndexedDB and mutation queue for offline resilience.
 */
export async function updateUserProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const budget = input.monthlyBudget !== undefined ? input.monthlyBudget : input.liquidityLimit;
  const endpointUrl = buildApiUrl('/api/auth/profile');

  try {
    const response = await fetch(endpointUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${input.userId}`,
        'X-User-Id': input.userId,
        ...(input.email ? { 'X-User-Email': input.email } : {}),
      },
      body: JSON.stringify({
        userId: input.userId,
        email: input.email,
        avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : undefined,
        monthlyBudget: budget,
        liquidityLimit: budget,
      }),
    });

    const data = await response.json();
    if (response.ok && data.success && data.user) {
      const serverUser = data.user;
      const finalBudget = serverUser.monthlyBudget !== undefined ? Number(serverUser.monthlyBudget) : (budget ?? 25000);
      const userProfile: UserProfile = {
        id: serverUser.id,
        name: serverUser.name,
        email: serverUser.email,
        role: serverUser.role || 'User Member',
        systemRole: serverUser.systemRole || 'User',
        title: serverUser.title || serverUser.roleTitle || 'Financial Member',
        department: serverUser.department || 'Personal Workspace',
        avatarGradient: serverUser.avatarGradient || 'from-emerald-500 to-teal-500',
        avatarUrl: serverUser.avatarUrl || undefined,
        monthlyBudget: finalBudget,
        liquidityLimit: finalBudget,
        currentLiquidity: serverUser.currentLiquidity || 0,
        monthlyBurnRate: serverUser.monthlyBurnRate || 0,
      };

      // Update local IndexedDB cache with fresh authoritative data
      try {
        const existing = await idbGet<RegisteredUser>(STORES.USERS, input.userId);
        const updatedRecord: RegisteredUser = {
          ...(existing || {
            id: serverUser.id,
            name: serverUser.name,
            email: serverUser.email,
            systemRole: serverUser.systemRole || 'User',
            createdAt: serverUser.createdAt || new Date().toISOString(),
            status: 'Active',
          }),
          avatarUrl: serverUser.avatarUrl || undefined,
          monthlyBudget: finalBudget,
          liquidityLimit: finalBudget,
          updatedAt: serverUser.updatedAt || new Date().toISOString(),
        };
        await idbPut(STORES.USERS, updatedRecord);
      } catch (cacheErr) {
        console.warn('[AuthService] Could not update local user cache:', cacheErr);
      }

      return {
        success: true,
        user: userProfile,
      };
    } else {
      return {
        success: false,
        error: data.error || 'Failed to update profile on server.',
      };
    }
  } catch (networkErr: any) {
    console.warn('[AuthService] Network error during profile update, queueing offline mutation:', networkErr);

    // Offline fallback: Update local repository & queue mutation for background sync engine
    try {
      const existing = await idbGet<RegisteredUser>(STORES.USERS, input.userId);
      const now = new Date().toISOString();
      const validBudget = budget !== undefined && !isNaN(Number(budget)) ? Number(budget) : (existing?.monthlyBudget ?? 25000);
      const updatedRecord: RegisteredUser = {
        ...(existing || {
          id: input.userId,
          name: 'User',
          email: input.email || '',
          systemRole: 'User',
          createdAt: now,
          status: 'Active',
        }),
        avatarUrl: input.avatarUrl !== undefined ? (input.avatarUrl || undefined) : existing?.avatarUrl,
        monthlyBudget: validBudget,
        liquidityLimit: validBudget,
        updatedAt: now,
      };

      await LocalRepository.updateRegisteredUser(updatedRecord);

      const userProfile: UserProfile = {
        id: updatedRecord.id,
        name: updatedRecord.name,
        email: updatedRecord.email,
        role: updatedRecord.systemRole === 'Admin' ? 'Super Administrator' : 'User Member',
        systemRole: updatedRecord.systemRole,
        title: updatedRecord.roleTitle || 'Financial Member',
        department: updatedRecord.department || 'Personal Workspace',
        avatarGradient: updatedRecord.avatarGradient || 'from-emerald-500 to-teal-500',
        avatarUrl: updatedRecord.avatarUrl || undefined,
        monthlyBudget: validBudget,
        liquidityLimit: validBudget,
        currentLiquidity: 0,
        monthlyBurnRate: 0,
      };

      return {
        success: true,
        user: userProfile,
        isOffline: true,
      };
    } catch (offlineErr: any) {
      return {
        success: false,
        error: offlineErr?.message || 'Failed to apply offline profile update.',
      };
    }
  }
}

/**
 * Fetches fresh user profile directly from Cloudflare D1.
 * Used during session resumption / multi-device synchronization.
 */
export async function fetchUserProfileFromD1(userId: string, email?: string): Promise<UserProfile | null> {
  const query = new URLSearchParams();
  if (userId) query.set('userId', userId);
  if (email) query.set('email', email);

  const endpointUrl = buildApiUrl(`/api/auth/profile?${query.toString()}`);
  try {
    const res = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userId}`,
        'X-User-Id': userId,
        ...(email ? { 'X-User-Email': email } : {}),
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        const u = data.user;
        const budget = u.monthlyBudget !== undefined ? Number(u.monthlyBudget) : (u.liquidityLimit !== undefined ? Number(u.liquidityLimit) : 25000);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role || 'User Member',
          systemRole: u.systemRole || 'User',
          title: u.title || u.roleTitle || 'Financial Member',
          department: u.department || 'Personal Workspace',
          avatarGradient: u.avatarGradient || 'from-emerald-500 to-teal-500',
          avatarUrl: u.avatarUrl || undefined,
          monthlyBudget: budget,
          liquidityLimit: budget,
          currentLiquidity: u.currentLiquidity || 0,
          monthlyBurnRate: u.monthlyBurnRate || 0,
        };
      }
    }
  } catch (err) {
    console.warn('[AuthService] fetchUserProfileFromD1 failed:', err);
  }
  return null;
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

/**
 * Requests server-side generation and email delivery of a 6-digit registration verification code.
 * Safe: The response NEVER contains the OTP.
 */
export async function sendVerificationCode(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const endpointUrl = buildApiUrl('/api/auth/send-verification');

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: cleanEmail }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || (response.status === 409
          ? 'This email is already registered. Please sign in instead.'
          : response.status === 429
          ? data.error || 'Please wait before requesting another code.'
          : 'Failed to send verification code. Please try again.'),
      };
    }

    return {
      success: true,
      message: data.message || 'Verification code sent to your email.',
    };
  } catch (err: any) {
    console.error('[AuthService] sendVerificationCode error:', err);
    return {
      success: false,
      error: err?.message || 'Network error while sending verification code. Please check your connection.',
    };
  }
}

/**
 * Validates the user-entered 6-digit verification code with the server/Worker.
 */
export async function verifyOtpCode(email: string, code: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();
  const endpointUrl = buildApiUrl('/api/auth/verify-code');

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Invalid verification code. Please check the code and try again.',
      };
    }

    return {
      success: true,
      message: data.message || 'Email verified successfully.',
    };
  } catch (err: any) {
    console.error('[AuthService] verifyOtpCode error:', err);
    return {
      success: false,
      error: err?.message || 'Network error while verifying code. Please try again.',
    };
  }
}

