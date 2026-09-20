// Sync engine types and interfaces for Tallix

export type MutationOperation = 'CREATE' | 'UPDATE' | 'DELETE';
export type MutationEntityType = 'expense' | 'group' | 'settlement' | 'registeredUser' | 'auditLog';
export type MutationStatus = 'pending' | 'syncing' | 'failed' | 'completed';

export interface SyncMutation {
  mutationId: string;
  entityType: MutationEntityType;
  entityId: string;
  operation: MutationOperation;
  payload: any;
  userId: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  status: MutationStatus;
  lastError?: string;
  clientDeviceId: string;
  baseVersion?: number;
}

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export interface SyncStatusInfo {
  state: SyncState;
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
}

export interface SyncPushRequest {
  clientDeviceId: string;
  userId: string;
  mutations: SyncMutation[];
}

export interface SyncPushResponse {
  success: boolean;
  processedMutationIds: string[];
  failedMutations?: { mutationId: string; error: string }[];
  serverTimestamp: string;
}

export interface SyncPullResponse {
  success: boolean;
  serverTimestamp: string;
  expenses: any[];
  groups: any[];
  settlements: any[];
  registeredUsers?: any[];
  deletedExpenseIds?: string[];
  deletedGroupIds?: string[];
  deletedSettlementIds?: string[];
}
