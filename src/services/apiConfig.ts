// Centralized Worker and Backend API Configuration for Tallix
import { FIXED_ADMIN_EMAIL, FIXED_ADMIN_PASSWORD } from '../config/fixedAdminAuth';

/**
 * Returns the configured Cloudflare Worker API URL.
 * In production builds, this reads import.meta.env.VITE_WORKER_URL.
 * If empty or running on the same host (such as deployed Cloudflare Worker with Assets),
 * returns an empty base string so requests route to same-origin /api/*.
 */
export const PRODUCTION_WORKER_URL = 'https://tallix-worker.dailybok.workers.dev';

export const getWorkerApiUrl = (): string => {
  const envUrl = (import.meta.env.VITE_WORKER_URL || '').trim().replace(/\/$/, '');
  if (envUrl) return envUrl;

  // When running directly on the deployed Cloudflare Worker with Assets,
  // relative path '/api/*' is fastest and same-origin.
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname.includes('workers.dev')) {
      return '';
    }
    // Running in preview environments, development, or external origins:
    // Route to authoritative Cloudflare Worker so D1 database is used.
    return PRODUCTION_WORKER_URL;
  }
  return PRODUCTION_WORKER_URL;
};

/**
 * Constructs a fully qualified API endpoint URL using the configured Worker URL.
 */
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getWorkerApiUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;
};

/**
 * Generates administrative authorization headers for admin endpoints.
 */
export const getAdminAuthHeaders = (adminEmail?: string, adminPassword?: string): Record<string, string> => {
  const email = adminEmail || FIXED_ADMIN_EMAIL;
  const pwd = adminPassword || FIXED_ADMIN_PASSWORD;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${pwd}`,
    'X-Admin-Email': email,
  };
};

let cachedRuntimeClientId: string | null = null;

export const _resetCachedGoogleClientIdForTests = () => {
  cachedRuntimeClientId = null;
};

/**
 * Synchronously retrieves Google Client ID if available from:
 * 1. window.__TALLIX_ENV__ (injected into HTML by Cloudflare Worker at edge)
 * 2. window.__ENV__
 * 3. Vite build-time environment variable (import.meta.env.VITE_GOOGLE_CLIENT_ID)
 * 4. In-memory runtime cache
 */
export const getGoogleClientIdSync = (): string => {
  const globalObj: any = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (globalObj) {
    const injected =
      globalObj.__TALLIX_ENV__?.VITE_GOOGLE_CLIENT_ID ||
      globalObj.__TALLIX_ENV__?.googleClientId ||
      globalObj.__ENV__?.VITE_GOOGLE_CLIENT_ID ||
      globalObj.__TALLIX_CONFIG__?.googleClientId;
    if (injected && typeof injected === 'string' && injected.trim()) {
      return injected.trim().replace(/^["']|["']$/g, '');
    }
  }

  const buildTimeId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim().replace(/^["']|["']$/g, '');
  if (buildTimeId) {
    return buildTimeId;
  }

  return cachedRuntimeClientId || '';
};

/**
 * Resolves the Google Client ID either from synchronous sources, build-time Vite env,
 * or dynamically from the Cloudflare Worker /api/auth/config endpoint.
 */
export const fetchGoogleClientId = async (): Promise<string> => {
  const syncId = getGoogleClientIdSync();
  if (syncId) {
    cachedRuntimeClientId = syncId;
    return syncId;
  }

  if (cachedRuntimeClientId) {
    return cachedRuntimeClientId;
  }

  // Endpoints to attempt in order:
  // 1. Same-origin relative path /api/auth/config (fastest, avoids CORS, matches workers.dev origin)
  // 2. Fully qualified buildApiUrl('/api/auth/config')
  const endpointsToTry: string[] = [];
  if (typeof window !== 'undefined') {
    endpointsToTry.push('/api/auth/config');
  }
  const workerBase = getWorkerApiUrl();
  if (workerBase) {
    const fullUrl = buildApiUrl('/api/auth/config');
    if (!endpointsToTry.includes(fullUrl)) {
      endpointsToTry.push(fullUrl);
    }
  }

  for (const endpoint of endpointsToTry) {
    try {
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const resolvedId = (data?.googleClientId || '').trim().replace(/^["']|["']$/g, '');
        if (resolvedId) {
          cachedRuntimeClientId = resolvedId;
          return resolvedId;
        }
      }
    } catch {
      // try next endpoint
    }
  }

  return '';
};
