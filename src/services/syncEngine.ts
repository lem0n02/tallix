// Core Synchronization Engine for Tallix Offline-First Architecture

import {
  getPendingMutations,
  getPendingCount,
  markMutationsSyncing,
  markMutationsCompleted,
  markMutationFailed,
  resetStuckSyncingMutations,
} from './syncQueue';
import {
  STORES,
  idbGet,
  idbGetAll,
  idbPut,
  idbDelete,
  idbGetMetadata,
  idbSetMetadata,
} from './indexedDB';
import { SyncStatusInfo, SyncState, SyncPushResponse, SyncPullResponse } from './syncTypes';
import { getClientDeviceId } from './idGenerator';
import { buildApiUrl } from './apiConfig';
import { RegisteredUser } from '../types';

const ACTIVE_POLL_INTERVAL_MS = 60000; // 60s active polling while tab is visible

type SyncStatusListener = (status: SyncStatusInfo) => void;
type DataUpdateListener = () => void;

export class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private state: SyncState = 'synced';
  private pendingCount: number = 0;
  private lastSyncedAt: Date | null = null;
  private lastError: string | null = null;
  private isSyncInProgress: boolean = false;
  private currentUserId: string | null = null;

  private statusListeners: Set<SyncStatusListener> = new Set();
  private dataListeners: Set<DataUpdateListener> = new Set();
  private periodicInterval: any = null;
  private retryTimer: any = null;
  private consecutiveFailures: number = 0;
  private isInitialized: boolean = false;
  private reachabilityPromise: Promise<boolean> | null = null;

  private handleOnline: (() => void) | null = null;
  private handleOffline: (() => void) | null = null;
  private handleVisibilityChange: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initListeners();
    }
  }

  public initListeners() {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    // Reset any mutations left in 'syncing' status on previous session crash
    resetStuckSyncingMutations().catch(console.warn);

    this.handleOnline = () => {
      this.clearRetryTimer();
      this.consecutiveFailures = 0;
      this.isOnline = true;
      if (this.state === 'offline') {
        this.state = this.pendingCount > 0 ? 'pending' : 'synced';
        this.notifyStatusListeners();
      }
      // Re-verify against real production API and trigger sync
      this.checkReachability().then((reachable) => {
        if (reachable && this.currentUserId) {
          this.triggerSync();
        }
      });
    };

    this.handleOffline = () => {
      this.isOnline = false;
      this.state = 'offline';
      this.notifyStatusListeners();
      this.scheduleRetry();
    };

    this.handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        // Stop active polling when the tab is in the background
        this.stopPeriodicSync();
        this.clearRetryTimer();
      } else if (document.visibilityState === 'visible') {
        // Resume active polling
        this.startPeriodicSync();
        // When tab becomes visible again: immediate health check and sync
        this.checkReachability().then((reachable) => {
          if (reachable && this.currentUserId) {
            this.triggerSync();
          }
        });
      }
    };

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Start active polling only if document is visible
    this.startPeriodicSync();

    // Startup check: perform an actual production API health check immediately
    this.updatePendingCount().then(() => {
      this.checkReachability().then((reachable) => {
        if (reachable && this.currentUserId) {
          this.triggerSync();
        }
      });
    });
  }

  public startPeriodicSync() {
    this.stopPeriodicSync();

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    this.periodicInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.stopPeriodicSync();
        return;
      }

      // If online and user is active, trigger sync heartbeat
      if (this.isOnline && !this.isSyncInProgress && this.currentUserId) {
        this.triggerSync().catch(console.warn);
      } else if (!this.isOnline || this.state === 'offline' || this.state === 'error') {
        // Self-healing: if currently offline or errored, probe reachability and recover automatically!
        this.checkReachability().then((reachable) => {
          if (reachable && this.currentUserId) {
            this.triggerSync().catch(console.warn);
          }
        });
      }
    }, ACTIVE_POLL_INTERVAL_MS);
  }

  public stopPeriodicSync() {
    if (this.periodicInterval) {
      clearInterval(this.periodicInterval);
      this.periodicInterval = null;
    }
  }

  private clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    // Exponential backoff: 3s, 6s, 12s, max 30s
    const delay = Math.min(30000, 3000 * Math.pow(2, Math.min(this.consecutiveFailures, 3)));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      this.checkReachability().then((reachable) => {
        if (reachable) {
          this.consecutiveFailures = 0;
          if (this.currentUserId) {
            this.triggerSync().catch(console.warn);
          }
        } else {
          // If still unreachable, continue backoff retry
          this.scheduleRetry();
        }
      });
    }, delay);
  }

  public destroy() {
    this.stopPeriodicSync();
    this.clearRetryTimer();

    if (typeof window !== 'undefined') {
      if (this.handleOnline) {
        window.removeEventListener('online', this.handleOnline);
        this.handleOnline = null;
      }
      if (this.handleOffline) {
        window.removeEventListener('offline', this.handleOffline);
        this.handleOffline = null;
      }
    }

    if (typeof document !== 'undefined' && this.handleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.handleVisibilityChange = null;
    }

    this.statusListeners.clear();
    this.dataListeners.clear();
    this.isInitialized = false;
    this.reachabilityPromise = null;
  }

  public getUserId(): string | null {
    return this.currentUserId;
  }

  public resetUserState() {
    this.clearRetryTimer();
    this.currentUserId = null;
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.lastSyncedAt = null;
    this.pendingCount = 0;
    if (this.state !== 'offline') {
      this.state = 'synced';
    }
    this.notifyStatusListeners();
  }

  public setUserId(userId: string | null) {
    const previousUserId = this.currentUserId;
    this.currentUserId = userId;

    if (previousUserId !== userId) {
      this.clearRetryTimer();
      this.consecutiveFailures = 0;
      this.lastError = null;
      this.lastSyncedAt = null;
    }

    if (userId && !userId.startsWith('usr_guest') && userId !== 'guest') {
      this.updatePendingCount().then(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          this.checkReachability().then((reachable) => {
            if (reachable && this.currentUserId === userId) {
              this.triggerSync();
            }
          });
        }
      });
    } else {
      this.pendingCount = 0;
      this.lastSyncedAt = null;
      if (this.state !== 'offline') {
        this.state = 'synced';
      }
      this.notifyStatusListeners();
    }
  }

  public getStatus(): SyncStatusInfo {
    return {
      state: this.state,
      isOnline: this.isOnline,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
    };
  }

  public subscribeStatus(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  public subscribeDataUpdates(listener: DataUpdateListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  private notifyStatusListeners() {
    const status = this.getStatus();
    this.statusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch (err) {
        console.error('[SyncEngine] Error in status listener:', err);
      }
    });
  }

  private notifyDataListeners() {
    this.dataListeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('[SyncEngine] Error in data listener:', err);
      }
    });
  }

  public async updatePendingCount(): Promise<number> {
    try {
      this.pendingCount = await getPendingCount();
      if (this.state !== 'syncing') {
        if (!this.isOnline) {
          this.state = 'offline';
        } else if (this.pendingCount > 0) {
          this.state = 'pending';
        } else {
          this.state = 'synced';
        }
      }
      this.notifyStatusListeners();
      return this.pendingCount;
    } catch {
      return 0;
    }
  }

  public async checkReachability(): Promise<boolean> {
    if (this.reachabilityPromise) {
      return this.reachabilityPromise;
    }

    this.reachabilityPromise = (async () => {
      try {
        // Ping health endpoint with an 8-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const healthUrl = buildApiUrl('/api/health');

        const res = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' },
          cache: 'no-store',
        });
        clearTimeout(timeoutId);

        const reachable = res.ok;
        if (reachable) {
          this.isOnline = true;
          this.consecutiveFailures = 0;
          this.clearRetryTimer();
          // Actual API reachability takes precedence over navigator.onLine
          if (this.state === 'offline' || this.state === 'error') {
            this.state = this.pendingCount > 0 ? 'pending' : 'synced';
          }
        } else {
          this.consecutiveFailures++;
          this.isOnline = false;
          this.state = 'offline';
          this.scheduleRetry();
        }

        this.notifyStatusListeners();
        return reachable;
      } catch {
        // Network timeout, connection refused, or offline
        this.consecutiveFailures++;
        this.isOnline = false;
        this.state = 'offline';
        this.scheduleRetry();
        this.notifyStatusListeners();
        return false;
      } finally {
        this.reachabilityPromise = null;
      }
    })();

    return this.reachabilityPromise;
  }

  // Main bidirectional synchronization cycle
  public async triggerSync(): Promise<{ success: boolean; error?: string }> {
    if (this.isSyncInProgress) {
      return { success: false, error: 'Sync already in progress' };
    }
    this.isSyncInProgress = true;

    try {
      // Guest isolation: never push or pull to remote Cloudflare D1/APIs during guest mode
      if (this.currentUserId && (this.currentUserId.startsWith('usr_guest') || this.currentUserId === 'guest')) {
        return { success: true };
      }

      const reachable = await this.checkReachability();
      if (!reachable) {
        this.state = 'offline';
        this.notifyStatusListeners();
        return { success: false, error: 'Device is offline' };
      }

      if (!this.currentUserId) {
        this.state = this.pendingCount > 0 ? 'pending' : 'synced';
        this.notifyStatusListeners();
        return { success: true };
      }

      this.state = 'syncing';
      this.notifyStatusListeners();

      // 1. PUSH PHASE: upload local mutations
      const pendingMutations = await getPendingMutations();
      if (pendingMutations.length > 0) {
        const mutationIds = pendingMutations.map((m) => m.mutationId);
        await markMutationsSyncing(mutationIds);

        const pushPayload = {
          clientDeviceId: getClientDeviceId(),
          userId: this.currentUserId || 'anonymous',
          mutations: pendingMutations,
        };

        const pushUrl = buildApiUrl('/api/sync/push');
        const pushController = new AbortController();
        const pushTimeout = setTimeout(() => pushController.abort(), 12000);

        const pushHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (this.currentUserId && this.currentUserId !== 'anonymous') {
          pushHeaders['Authorization'] = `Bearer ${this.currentUserId}`;
          pushHeaders['X-User-Id'] = this.currentUserId;
        }

        const pushRes = await fetch(pushUrl, {
          method: 'POST',
          headers: pushHeaders,
          body: JSON.stringify(pushPayload),
          signal: pushController.signal,
        });
        clearTimeout(pushTimeout);

        if (!pushRes.ok) {
          if (pushRes.status === 401 || pushRes.status === 403) {
            this.isOnline = true; // API is reachable, this is an auth session issue
            this.state = 'error';
            this.lastError = `Authentication error (${pushRes.status}). Session verification required.`;
            this.notifyStatusListeners();
            return { success: false, error: this.lastError };
          }
          throw new Error(`Sync push failed with HTTP ${pushRes.status}`);
        }

        const pushData: SyncPushResponse = await pushRes.json();
        if (pushData.success && pushData.processedMutationIds) {
          await markMutationsCompleted(pushData.processedMutationIds);
        }

        if (pushData.failedMutations) {
          for (const failed of pushData.failedMutations) {
            await markMutationFailed(failed.mutationId, failed.error);
          }
        }
      }

      // 2. PULL PHASE: fetch latest server updates with per-user isolated sync token
      const syncMetaKey = this.currentUserId ? `last_sync_timestamp_${this.currentUserId}` : 'last_sync_timestamp';
      const lastSyncToken = (await idbGetMetadata<string>(syncMetaKey)) || '';
      const pullUrl = `${buildApiUrl('/api/sync/pull')}?since=${encodeURIComponent(lastSyncToken)}&userId=${encodeURIComponent(
        this.currentUserId || ''
      )}`;

      const pullController = new AbortController();
      const pullTimeout = setTimeout(() => pullController.abort(), 12000);

      const pullHeaders: Record<string, string> = {
        'Cache-Control': 'no-cache',
      };
      if (this.currentUserId && this.currentUserId !== 'anonymous') {
        pullHeaders['Authorization'] = `Bearer ${this.currentUserId}`;
        pullHeaders['X-User-Id'] = this.currentUserId;
      }

      const pullRes = await fetch(pullUrl, {
        method: 'GET',
        headers: pullHeaders,
        signal: pullController.signal,
      });
      clearTimeout(pullTimeout);

      if (!pullRes.ok) {
        if (pullRes.status === 401 || pullRes.status === 403) {
          this.isOnline = true; // API is reachable, this is an auth session issue
          this.state = 'error';
          this.lastError = `Authentication error (${pullRes.status}). Session verification required.`;
          this.notifyStatusListeners();
          return { success: false, error: this.lastError };
        }
        throw new Error(`Sync pull failed with HTTP ${pullRes.status}`);
      }

      const pullData: SyncPullResponse = await pullRes.json();

      if (pullData.success) {
        let hasLocalUpdates = false;

        // Merge groups
        if (pullData.groups && pullData.groups.length > 0) {
          for (const grp of pullData.groups) {
            await idbPut(STORES.GROUPS, grp);
            hasLocalUpdates = true;
          }
        }

        if (pullData.deletedGroupIds && pullData.deletedGroupIds.length > 0) {
          for (const id of pullData.deletedGroupIds) {
            await idbDelete(STORES.GROUPS, id);
            hasLocalUpdates = true;
          }
        }

        // Merge expenses
        if (pullData.expenses && pullData.expenses.length > 0) {
          for (const exp of pullData.expenses) {
            await idbPut(STORES.EXPENSES, exp);
            hasLocalUpdates = true;
          }
        }

        if (pullData.deletedExpenseIds && pullData.deletedExpenseIds.length > 0) {
          for (const id of pullData.deletedExpenseIds) {
            await idbDelete(STORES.EXPENSES, id);
            hasLocalUpdates = true;
          }
        }

        // Merge settlements with full normalization across camelCase and snake_case properties
        if (pullData.settlements && pullData.settlements.length > 0) {
          for (const stl of pullData.settlements) {
            const origAmount = typeof stl.amount === 'number' ? stl.amount : (stl.originalAmount || 0);
            const paisa = typeof stl.amount_paisa === 'number' ? stl.amount_paisa : Math.round(origAmount * 100);
            const normalizedStl = {
              ...stl,
              groupId: stl.groupId || (stl as any).group_id,
              groupName: stl.groupName || (stl as any).group_name,
              fromUserId: stl.fromUserId || (stl as any).from_user_id,
              fromUserName: stl.fromUserName || (stl as any).from_user_name,
              toUserId: stl.toUserId || (stl as any).to_user_id,
              toUserName: stl.toUserName || (stl as any).to_user_name,
              paymentMethod: stl.paymentMethod || (stl as any).payment_method,
              amount: origAmount,
              originalAmount: origAmount,
              amount_paisa: paisa,
            };
            await idbPut(STORES.SETTLEMENTS, normalizedStl);
            hasLocalUpdates = true;
          }
        }

        if (pullData.deletedSettlementIds && pullData.deletedSettlementIds.length > 0) {
          for (const id of pullData.deletedSettlementIds) {
            await idbDelete(STORES.SETTLEMENTS, id);
            hasLocalUpdates = true;
          }
        }

        // Merge registered users (preserving local password/credentials cache for offline resilience)
        if (pullData.registeredUsers && pullData.registeredUsers.length > 0) {
          for (const u of pullData.registeredUsers) {
            // Strict ID-based lookup: never associate credentials across different user IDs
            let existingUser = await idbGet<RegisteredUser>(STORES.USERS, u.id);
            if (existingUser && existingUser.id !== u.id) {
              existingUser = undefined;
            }

            // CRITICAL REGRESSION & MISMATCH PROTECTION:
            // syncEngine must ONLY preserve credentials if existingUser strictly matches u.id and u.email
            const isExactAccountMatch = Boolean(
              existingUser &&
              existingUser.id === u.id &&
              existingUser.email?.toLowerCase() === u.email?.toLowerCase()
            );

            const preservedPassword =
              isExactAccountMatch && existingUser?.password && existingUser.password.trim() !== ''
                ? existingUser.password
                : (u.password && typeof u.password === 'string' && u.password.trim() !== '')
                ? u.password
                : undefined;

            const preservedPasswordHash =
              isExactAccountMatch && ((existingUser as any)?.password_hash || (existingUser as any)?.passwordHash)
                ? ((existingUser as any)?.password_hash || (existingUser as any)?.passwordHash)
                : ((u as any)?.password_hash || (u as any)?.passwordHash);

            await idbPut(STORES.USERS, {
              ...existingUser,
              ...u,
              password: preservedPassword,
              password_hash: preservedPasswordHash,
            });
            hasLocalUpdates = true;
          }
        }

        if (pullData.deletedUserIds && pullData.deletedUserIds.length > 0) {
          for (const id of pullData.deletedUserIds) {
            await idbDelete(STORES.USERS, id);
            hasLocalUpdates = true;
          }
        }

        // Save new sync checkpoint isolated per user
        if (pullData.serverTimestamp) {
          await idbSetMetadata(syncMetaKey, pullData.serverTimestamp);
        }

        if (hasLocalUpdates) {
          this.notifyDataListeners();
        }
      }

      this.pendingCount = await getPendingCount();
      this.lastSyncedAt = new Date();
      this.lastError = null;
      this.consecutiveFailures = 0;
      this.clearRetryTimer();
      this.isOnline = true;
      this.state = this.pendingCount > 0 ? 'pending' : 'synced';
      this.notifyStatusListeners();

      return { success: true };
    } catch (err: any) {
      console.warn('[SyncEngine] Sync cycle encountered error:', err);
      this.lastError = err?.message || 'Sync failed';
      this.pendingCount = await getPendingCount();

      const isAuthError = this.lastError.includes('401') || this.lastError.includes('403');
      if (isAuthError) {
        this.isOnline = true;
        this.state = 'error';
      } else {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 2) {
          this.isOnline = false;
          this.state = 'offline';
        } else {
          this.state = 'error';
        }
        this.scheduleRetry();
      }
      this.notifyStatusListeners();
      return { success: false, error: this.lastError };
    } finally {
      this.isSyncInProgress = false;
    }
  }
}

// Global Singleton Instance
export const syncEngine = new SyncEngine();
