// Persistent IndexedDB Sync Queue with intelligent collapse and retry semantics

import { STORES, idbGetAll, idbPut, idbDelete, idbGet } from './indexedDB';
import { SyncMutation, MutationOperation, MutationEntityType } from './syncTypes';
import { generateEntityId, getClientDeviceId } from './idGenerator';

export async function enqueueMutation(params: {
  entityType: MutationEntityType;
  entityId: string;
  operation: MutationOperation;
  payload: any;
  userId: string;
  groupId?: string;
  baseVersion?: number;
}): Promise<SyncMutation> {
  const now = new Date().toISOString();
  const clientDeviceId = getClientDeviceId();

  // Inspect existing pending mutations for the same entity to collapse where safe
  const allMutations = await idbGetAll<SyncMutation>(STORES.SYNC_QUEUE);
  const existingForEntity = allMutations.filter(
    (m) => m.entityId === params.entityId && (m.status === 'pending' || m.status === 'failed')
  );

  // If previous mutation was a local CREATE that has not yet synced to server:
  const localCreate = existingForEntity.find((m) => m.operation === 'CREATE');

  if (localCreate) {
    if (params.operation === 'UPDATE') {
      // Collapse: merge updated payload into the pending CREATE mutation
      const mergedMutation: SyncMutation = {
        ...localCreate,
        payload: { ...localCreate.payload, ...params.payload, updatedAt: now },
        updatedAt: now,
      };
      await idbPut(STORES.SYNC_QUEUE, mergedMutation);
      return mergedMutation;
    }

    if (params.operation === 'DELETE') {
      // Collapse: since entity was created offline and deleted offline before reaching server,
      // we can remove all pending mutations for this entity without ever sending to server!
      for (const m of existingForEntity) {
        await idbDelete(STORES.SYNC_QUEUE, m.mutationId);
      }
      return {
        mutationId: generateEntityId('mut'),
        entityType: params.entityType,
        entityId: params.entityId,
        operation: 'DELETE',
        payload: null,
        userId: params.userId,
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        status: 'completed',
        clientDeviceId,
      };
    }
  }

  // Otherwise, create a new atomic mutation
  const mutation: SyncMutation = {
    mutationId: generateEntityId('mut'),
    entityType: params.entityType,
    entityId: params.entityId,
    operation: params.operation,
    payload: params.payload,
    userId: params.userId,
    groupId: params.groupId,
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    status: 'pending',
    clientDeviceId,
    baseVersion: params.baseVersion || 1,
  };

  await idbPut(STORES.SYNC_QUEUE, mutation);
  return mutation;
}

export async function getPendingMutations(): Promise<SyncMutation[]> {
  const all = await idbGetAll<SyncMutation>(STORES.SYNC_QUEUE);
  return all
    .filter((m) => m.status === 'pending' || m.status === 'failed' || m.status === 'syncing')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingMutations();
  return pending.length;
}

export async function markMutationsSyncing(mutationIds: string[]): Promise<void> {
  for (const id of mutationIds) {
    const item = await idbGet<SyncMutation>(STORES.SYNC_QUEUE, id);
    if (item) {
      item.status = 'syncing';
      item.updatedAt = new Date().toISOString();
      await idbPut(STORES.SYNC_QUEUE, item);
    }
  }
}

export async function markMutationsCompleted(mutationIds: string[]): Promise<void> {
  for (const id of mutationIds) {
    await idbDelete(STORES.SYNC_QUEUE, id);
  }
}

export async function markMutationFailed(mutationId: string, error: string): Promise<void> {
  const item = await idbGet<SyncMutation>(STORES.SYNC_QUEUE, mutationId);
  if (item) {
    item.status = 'failed';
    item.retryCount = (item.retryCount || 0) + 1;
    item.lastError = error;
    item.updatedAt = new Date().toISOString();
    await idbPut(STORES.SYNC_QUEUE, item);
  }
}

export async function resetStuckSyncingMutations(): Promise<void> {
  // If app refreshed or crashed while syncing was in progress, reset to 'pending'
  const all = await idbGetAll<SyncMutation>(STORES.SYNC_QUEUE);
  for (const m of all) {
    if (m.status === 'syncing') {
      m.status = 'pending';
      await idbPut(STORES.SYNC_QUEUE, m);
    }
  }
}
