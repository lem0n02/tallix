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
import { Expense, Group, Settlement } from '../types';

// Cloudflare Worker API Base URL (configured in production via VITE_WORKER_URL)
const SYNC_BASE_URL = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');

type SyncStatusListener = (status: SyncStatusInfo) => void;
type DataUpdateListener = () => void;

class SyncEngine {
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
  private heartbeatInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initListeners();
    }
  }

  private initListeners() {
    // Reset any mutations left in 'syncing' status on previous session crash
    resetStuckSyncingMutations().catch(console.warn);

    window.addEventListener('online', () => {
      this.checkReachability().then((reachable) => {
        if (reachable) {
          this.triggerSync();
        }
      });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.state = 'offline';
      this.notifyStatusListeners();
    });

    // Run health ping every 20 seconds to guarantee real connectivity
    this.heartbeatInterval = setInterval(() => {
      this.checkReachability();
    }, 20000);

    // Periodic sync every 30 seconds when online
    this.periodicInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncInProgress && this.currentUserId) {
        this.triggerSync();
      }
    }, 30000);
  }

  public setUserId(userId: string | null) {
    this.currentUserId = userId;
    if (userId) {
      this.updatePendingCount().then(() => {
        if (this.isOnline) {
          this.triggerSync();
        }
      });
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
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false;
      this.state = 'offline';
      this.notifyStatusListeners();
      return false;
    }

    try {
      // Light ping to health endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${SYNC_BASE_URL}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(timeoutId);

      const reachable = res.ok;
      this.isOnline = reachable;
      if (!reachable) {
        this.state = 'offline';
      } else if (this.state === 'offline') {
        this.state = this.pendingCount > 0 ? 'pending' : 'synced';
      }
      this.notifyStatusListeners();
      return reachable;
    } catch {
      this.isOnline = false;
      this.state = 'offline';
      this.notifyStatusListeners();
      return false;
    }
  }

  // Main bidirectional synchronization cycle
  public async triggerSync(): Promise<{ success: boolean; error?: string }> {
    if (this.isSyncInProgress) {
      return { success: false, error: 'Sync already in progress' };
    }

    const reachable = await this.checkReachability();
    if (!reachable) {
      this.state = 'offline';
      this.notifyStatusListeners();
      return { success: false, error: 'Device is offline' };
    }

    this.isSyncInProgress = true;
    this.state = 'syncing';
    this.notifyStatusListeners();

    try {
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

        const pushRes = await fetch(`${SYNC_BASE_URL}/api/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pushPayload),
        });

        if (!pushRes.ok) {
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

      // 2. PULL PHASE: fetch latest server updates
      const lastSyncToken = (await idbGetMetadata<string>('last_sync_timestamp')) || '';
      const pullUrl = `${SYNC_BASE_URL}/api/sync/pull?since=${encodeURIComponent(lastSyncToken)}&userId=${encodeURIComponent(
        this.currentUserId || ''
      )}`;

      const pullRes = await fetch(pullUrl, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (pullRes.ok) {
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

          // Merge settlements
          if (pullData.settlements && pullData.settlements.length > 0) {
            for (const stl of pullData.settlements) {
              await idbPut(STORES.SETTLEMENTS, stl);
              hasLocalUpdates = true;
            }
          }

          if (pullData.deletedSettlementIds && pullData.deletedSettlementIds.length > 0) {
            for (const id of pullData.deletedSettlementIds) {
              await idbDelete(STORES.SETTLEMENTS, id);
              hasLocalUpdates = true;
            }
          }

          // Merge registered users
          if (pullData.registeredUsers && pullData.registeredUsers.length > 0) {
            for (const u of pullData.registeredUsers) {
              await idbPut(STORES.USERS, u);
              hasLocalUpdates = true;
            }
          }

          // Save new sync checkpoint
          if (pullData.serverTimestamp) {
            await idbSetMetadata('last_sync_timestamp', pullData.serverTimestamp);
          }

          if (hasLocalUpdates) {
            this.notifyDataListeners();
          }
        }
      }

      this.pendingCount = await getPendingCount();
      this.lastSyncedAt = new Date();
      this.lastError = null;
      this.state = this.pendingCount > 0 ? 'pending' : 'synced';
      this.notifyStatusListeners();

      return { success: true };
    } catch (err: any) {
      console.warn('[SyncEngine] Sync cycle encountered error:', err);
      this.lastError = err?.message || 'Sync failed';
      this.pendingCount = await getPendingCount();
      this.state = this.isOnline ? 'error' : 'offline';
      this.notifyStatusListeners();
      return { success: false, error: this.lastError };
    } finally {
      this.isSyncInProgress = false;
    }
  }
}

// Global Singleton Instance
export const syncEngine = new SyncEngine();
