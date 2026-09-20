// Collision-resistant ID generator for offline-first records and mutations

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateEntityId(prefix: 'exp' | 'grp' | 'stl' | 'usr' | 'log' | 'mut' | 'gst'): string {
  const timestamp = Date.now();
  const randomPart = generateUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}_${timestamp}_${randomPart}`;
}

export function getClientDeviceId(): string {
  const KEY = 'tallix_device_id';
  if (typeof window === 'undefined') return 'server_device';
  let deviceId = localStorage.getItem(KEY);
  if (!deviceId) {
    deviceId = `dev_${generateUUID().replace(/-/g, '').slice(0, 16)}`;
    localStorage.setItem(KEY, deviceId);
  }
  return deviceId;
}
