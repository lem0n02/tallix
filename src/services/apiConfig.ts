// Centralized Worker and Backend API Configuration for Tallix
import { FIXED_ADMIN_EMAIL, FIXED_ADMIN_PASSWORD } from '../config/fixedAdminAuth';

/**
 * Returns the configured Cloudflare Worker API URL.
 * In production builds, this reads import.meta.env.VITE_WORKER_URL.
 * If empty or running on the same host (such as deployed Cloudflare Worker with Assets),
 * returns an empty base string so requests route to same-origin /api/*.
 */
export const getWorkerApiUrl = (): string => {
  const envUrl = (import.meta.env.VITE_WORKER_URL || '').trim().replace(/\/$/, '');
  return envUrl;
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
