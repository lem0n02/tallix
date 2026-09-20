import { UserProfile } from '../types';

/**
 * Fixed System Administrator Configuration for Tallix
 * 
 * This admin credential is strictly hardcoded in the application source code.
 * It CANNOT be modified, disabled, or deleted from the UI, database, or admin panel.
 * 
 * Credential Separation:
 * - Admin credentials grant full access to /admin/dashboard and system administration.
 * - The same email address can also register and log in as a normal user account with a different password.
 * - Logging in with the normal user password operates exclusively with normal user features.
 */
export const FIXED_ADMIN_EMAIL = 'abdulatiflemon@gmail.com';
export const FIXED_ADMIN_PASSWORD = 'Admin@Tallix2026!';

/**
 * Validates whether the given email and password match the fixed admin credentials.
 * Performs a case-insensitive email match and exact case-sensitive password match.
 */
export function isFixedAdminCredentials(email: string, password: string): boolean {
  if (!email || !password) return false;
  return (
    email.trim().toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase() &&
    password === FIXED_ADMIN_PASSWORD
  );
}

/**
 * Returns true if the email matches the fixed admin email address.
 */
export function isFixedAdminEmail(email: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === FIXED_ADMIN_EMAIL.toLowerCase();
}

/**
 * Generates the immutable Super Administrator profile for active sessions.
 * Never stores or exposes the admin password.
 */
export function getFixedAdminProfile(): UserProfile {
  return {
    id: 'usr_tallix_fixed_admin',
    name: 'Tallix Super Administrator',
    email: FIXED_ADMIN_EMAIL,
    role: 'Super Administrator',
    systemRole: 'Admin',
    title: 'Super Administrator',
    department: 'Platform Governance',
    avatarGradient: 'from-amber-500 to-rose-500',
    liquidityLimit: 500000,
    currentLiquidity: 0,
    monthlyBurnRate: 0,
    aiCopilotEnabled: true,
  };
}
