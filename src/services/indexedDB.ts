// IndexedDB persistence engine for Tallix Offline-First Architecture

const DB_NAME = 'tallix_offline_db';
const DB_VERSION = 1;

export const STORES = {
  EXPENSES: 'expenses',
  GROUPS: 'groups',
  SETTLEMENTS: 'settlements',
  USERS: 'registeredUsers',
  AUDIT_LOGS: 'auditLogs',
  GUEST_VISITS: 'guestVisits',
  SYNC_QUEUE: 'syncQueue',
  SYNC_METADATA: 'syncMetadata',
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const idb = (typeof globalThis !== 'undefined' && globalThis.indexedDB)
      ? globalThis.indexedDB
      : (typeof window !== 'undefined' ? window.indexedDB : null);

    if (!idb) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Expenses Store
      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const expenseStore = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        expenseStore.createIndex('groupId', 'groupId', { unique: false });
        expenseStore.createIndex('paidByUserId', 'paidByUserId', { unique: false });
        expenseStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        expenseStore.createIndex('isShared', 'isShared', { unique: false });
        expenseStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 2. Groups Store
      if (!db.objectStoreNames.contains(STORES.GROUPS)) {
        const groupStore = db.createObjectStore(STORES.GROUPS, { keyPath: 'id' });
        groupStore.createIndex('inviteCode', 'inviteCode', { unique: false });
        groupStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        groupStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 3. Settlements Store
      if (!db.objectStoreNames.contains(STORES.SETTLEMENTS)) {
        const settlementStore = db.createObjectStore(STORES.SETTLEMENTS, { keyPath: 'id' });
        settlementStore.createIndex('groupId', 'groupId', { unique: false });
        settlementStore.createIndex('fromUserId', 'fromUserId', { unique: false });
        settlementStore.createIndex('toUserId', 'toUserId', { unique: false });
        settlementStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        settlementStore.createIndex('deletedAt', 'deletedAt', { unique: false });
      }

      // 4. Registered Users Store
      if (!db.objectStoreNames.contains(STORES.USERS)) {
        const userStore = db.createObjectStore(STORES.USERS, { keyPath: 'id' });
        userStore.createIndex('email', 'email', { unique: false });
      }

      // 5. Audit Logs Store
      if (!db.objectStoreNames.contains(STORES.AUDIT_LOGS)) {
        const logStore = db.createObjectStore(STORES.AUDIT_LOGS, { keyPath: 'id' });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // 6. Guest Visits Store
      if (!db.objectStoreNames.contains(STORES.GUEST_VISITS)) {
        db.createObjectStore(STORES.GUEST_VISITS, { keyPath: 'id' });
      }

      // 7. Sync Queue Store (Mutations waiting for or in progress of sync)
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'mutationId' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        queueStore.createIndex('entityType', 'entityType', { unique: false });
        queueStore.createIndex('entityId', 'entityId', { unique: false });
      }

      // 8. Sync Metadata Store (key-value properties)
      if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
        db.createObjectStore(STORES.SYNC_METADATA, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] Database failed to open:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };

    request.onblocked = () => {
      console.warn('[IndexedDB] Database upgrade blocked by another open tab');
    };
  });

  return dbPromise;
}

// Generic Store CRUD helpers
export async function idbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
  const db = await getDatabase();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await getDatabase();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut<T>(storeName: StoreName, item: T): Promise<void> {
  const db = await getDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutMany<T>(storeName: StoreName, items: T[]): Promise<void> {
  if (!items || items.length === 0) return;
  const db = await getDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    items.forEach((item) => store.put(item));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await getDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbClear(storeName: StoreName): Promise<void> {
  const db = await getDatabase();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetMetadata<T>(key: string): Promise<T | null> {
  const result = await idbGet<{ key: string; value: T }>(STORES.SYNC_METADATA, key);
  return result ? result.value : null;
}

export async function idbSetMetadata<T>(key: string, value: T): Promise<void> {
  await idbPut(STORES.SYNC_METADATA, { key, value, updatedAt: new Date().toISOString() });
}
