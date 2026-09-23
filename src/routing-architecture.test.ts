import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRoute,
  normalizePath,
  getPathForTab,
  parseLocationPath,
} from './router';

describe('Authoritative Routing Architecture Suite', () => {
  describe('1. URL Normalization and Canonicalization', () => {
    it('normalizes trailing slashes, empty strings, queries, and hash fragments', () => {
      expect(normalizePath('')).toBe('/');
      expect(normalizePath('/')).toBe('/');
      expect(normalizePath('///')).toBe('/');
      expect(normalizePath('/dashboard/')).toBe('/dashboard');
      expect(normalizePath('/transactions?date=2026-09')).toBe('/transactions');
      expect(normalizePath('/groups/GOA2026#members')).toBe('/groups/GOA2026');
      expect(normalizePath('/groups/GOA2026/?foo=bar#section')).toBe('/groups/GOA2026');
    });
  });

  describe('2. Authoritative Route Parsing', () => {
    it('parses public landing page', () => {
      const match = parseRoute('/');
      expect(match.routeName).toBe('landing');
      expect(match.isProtected).toBe(false);
      expect(match.isAuth).toBe(false);
      expect(match.isAdmin).toBe(false);
    });

    it('parses authentication pages (/login, /signin, /signup, /register, /forgot-password)', () => {
      expect(parseRoute('/login').routeName).toBe('login');
      expect(parseRoute('/login').isAuth).toBe(true);
      expect(parseRoute('/signin').routeName).toBe('login');
      expect(parseRoute('/signup').routeName).toBe('signup');
      expect(parseRoute('/signup').isAuth).toBe(true);
      expect(parseRoute('/register').routeName).toBe('signup');
      expect(parseRoute('/forgot-password').routeName).toBe('forgot-password');
      expect(parseRoute('/forgot-password').isAuth).toBe(true);
    });

    it('parses core user workspace routes (/dashboard, /transactions, /analytics, /ai-advisor, /activity)', () => {
      const dash = parseRoute('/dashboard');
      expect(dash.routeName).toBe('dashboard');
      expect(dash.activeTab).toBe('dashboard');
      expect(dash.isProtected).toBe(true);

      const trans = parseRoute('/transactions');
      expect(trans.routeName).toBe('transactions');
      expect(trans.activeTab).toBe('personal-expenses');
      expect(trans.isProtected).toBe(true);

      const exp = parseRoute('/expenses');
      expect(exp.routeName).toBe('transactions');
      expect(exp.activeTab).toBe('personal-expenses');

      const pExp = parseRoute('/personal-expenses');
      expect(pExp.routeName).toBe('transactions');
      expect(pExp.activeTab).toBe('personal-expenses');

      const anal = parseRoute('/analytics');
      expect(anal.routeName).toBe('analytics');
      expect(anal.activeTab).toBe('analytics');
      expect(anal.isProtected).toBe(true);

      const ai = parseRoute('/ai-advisor');
      expect(ai.routeName).toBe('ai-advisor');
      expect(ai.activeTab).toBe('ai-advisor');
      expect(ai.isProtected).toBe(true);

      const copilot = parseRoute('/ai-copilot');
      expect(copilot.routeName).toBe('ai-advisor');
      expect(copilot.activeTab).toBe('ai-advisor');

      const act = parseRoute('/activity');
      expect(act.routeName).toBe('activity');
      expect(act.activeTab).toBe('activity');
      expect(act.isProtected).toBe(true);
    });

    it('parses profile and settings routes (/profile, /settings)', () => {
      const prof = parseRoute('/profile');
      expect(prof.routeName).toBe('profile');
      expect(prof.activeTab).toBe('profile');
      expect(prof.isProtected).toBe(true);

      const sett = parseRoute('/settings');
      expect(sett.routeName).toBe('settings');
      expect(sett.activeTab).toBe('profile');
      expect(sett.isProtected).toBe(true);
    });

    it('parses group listing and dynamic group routes (/groups, /groups/:groupId)', () => {
      const groupsRoot = parseRoute('/groups');
      expect(groupsRoot.routeName).toBe('groups');
      expect(groupsRoot.activeTab).toBe('shared-groups');
      expect(groupsRoot.params.groupId).toBeUndefined();

      const groupGoa = parseRoute('/groups/GOA2026');
      expect(groupGoa.routeName).toBe('group-details');
      expect(groupGoa.activeTab).toBe('shared-groups');
      expect(groupGoa.params.groupId).toBe('GOA2026');

      const groupSpecial = parseRoute('/groups/Team%20Alpha');
      expect(groupSpecial.routeName).toBe('group-details');
      expect(groupSpecial.params.groupId).toBe('Team Alpha');
    });

    it('parses admin routes (/admin/dashboard, /admin, /system-admin, /admin/login)', () => {
      const adminDash = parseRoute('/admin/dashboard');
      expect(adminDash.routeName).toBe('admin-dashboard');
      expect(adminDash.activeTab).toBe('system-admin');
      expect(adminDash.isAdmin).toBe(true);
      expect(adminDash.isProtected).toBe(true);

      const adminRoot = parseRoute('/admin');
      expect(adminRoot.routeName).toBe('admin-dashboard');
      expect(adminRoot.activeTab).toBe('system-admin');
      expect(adminRoot.isAdmin).toBe(true);

      const sysAdmin = parseRoute('/system-admin');
      expect(sysAdmin.routeName).toBe('admin-dashboard');
      expect(sysAdmin.activeTab).toBe('system-admin');

      const adminLogin = parseRoute('/admin/login');
      expect(adminLogin.routeName).toBe('admin-login');
      expect(adminLogin.activeTab).toBe('system-admin');
      expect(adminLogin.isAdmin).toBe(true);
      expect(adminLogin.isAuth).toBe(true);
    });

    it('handles unknown routes by returning not-found', () => {
      const unknown = parseRoute('/some/invalid/nested/path');
      expect(unknown.routeName).toBe('not-found');
      expect(unknown.isProtected).toBe(false);
    });
  });

  describe('3. Canonical URL Generation (getPathForTab)', () => {
    it('generates exact canonical URLs for all active tabs', () => {
      expect(getPathForTab('dashboard')).toBe('/dashboard');
      expect(getPathForTab('personal-expenses')).toBe('/transactions');
      expect(getPathForTab('shared-groups')).toBe('/groups');
      expect(getPathForTab('shared-groups', 'GOA2026')).toBe('/groups/GOA2026');
      expect(getPathForTab('analytics')).toBe('/analytics');
      expect(getPathForTab('ai-advisor')).toBe('/ai-advisor');
      expect(getPathForTab('activity')).toBe('/activity');
      expect(getPathForTab('profile')).toBe('/profile');
      expect(getPathForTab('system-admin')).toBe('/admin/dashboard');
    });
  });

  describe('4. Legacy Compatibility Wrapper (parseLocationPath)', () => {
    it('maintains backwards compatibility for legacy consumers and tests', () => {
      expect(parseLocationPath('/dashboard')).toEqual({
        route: 'app',
        activeTab: 'dashboard',
        selectedGroupId: null,
        isEditProfileOpen: false,
      });

      expect(parseLocationPath('/transactions')).toEqual({
        route: 'app',
        activeTab: 'personal-expenses',
        selectedGroupId: null,
        isEditProfileOpen: false,
      });

      expect(parseLocationPath('/groups/GOA2026')).toEqual({
        route: 'app',
        activeTab: 'shared-groups',
        selectedGroupId: 'GOA2026',
        isEditProfileOpen: false,
      });

      expect(parseLocationPath('/profile')).toEqual({
        route: 'app',
        activeTab: 'dashboard',
        selectedGroupId: null,
        isEditProfileOpen: true,
      });

      expect(parseLocationPath('/login')).toEqual({
        route: 'signin',
        activeTab: 'dashboard',
        selectedGroupId: null,
        isEditProfileOpen: false,
      });
    });
  });

  describe('5. Desktop & Mobile Shared Navigation Matrix', () => {
    const requiredDesktopRoutes = [
      { path: '/dashboard', expectedTab: 'dashboard', expectedRoute: 'dashboard' },
      { path: '/transactions', expectedTab: 'personal-expenses', expectedRoute: 'transactions' },
      { path: '/analytics', expectedTab: 'analytics', expectedRoute: 'analytics' },
      { path: '/settings', expectedTab: 'profile', expectedRoute: 'settings' },
      { path: '/profile', expectedTab: 'profile', expectedRoute: 'profile' },
      { path: '/groups/GOA2026', expectedTab: 'shared-groups', expectedRoute: 'group-details', groupId: 'GOA2026' },
      { path: '/groups/squad_alpha', expectedTab: 'shared-groups', expectedRoute: 'group-details', groupId: 'squad_alpha' },
      { path: '/groups', expectedTab: 'shared-groups', expectedRoute: 'groups' },
      { path: '/ai-advisor', expectedTab: 'ai-advisor', expectedRoute: 'ai-advisor' },
      { path: '/activity', expectedTab: 'activity', expectedRoute: 'activity' },
    ];

    it.each(requiredDesktopRoutes)(
      'resolves $path to tab: $expectedTab without unexpected redirection',
      ({ path, expectedTab, expectedRoute, groupId }) => {
        const routeInfo = parseRoute(path);
        expect(routeInfo.routeName).toBe(expectedRoute);
        expect(routeInfo.activeTab).toBe(expectedTab);
        expect(routeInfo.isProtected).toBe(true);
        if (groupId) {
          expect(routeInfo.params.groupId).toBe(groupId);
        }
      }
    );

    it('preserves route identity across simulated page refresh (F5)', () => {
      // Direct URL / F5 entry simulation
      const targetPaths = [
        '/dashboard',
        '/transactions',
        '/analytics',
        '/settings',
        '/profile',
        '/groups/GOA2026',
      ];

      targetPaths.forEach((path) => {
        const parsed = parseRoute(path);
        // Ensure no redirect to landing or unhandled 404
        expect(parsed.routeName).not.toBe('landing');
        expect(parsed.routeName).not.toBe('not-found');
        expect(parsed.isProtected).toBe(true);

        // Canonical mapping matches
        const canonical = getPathForTab(parsed.activeTab, parsed.params.groupId);
        if (path === '/settings') {
          // Settings is an alias for profile
          expect(canonical).toBe('/profile');
        } else {
          expect(canonical).toBe(path);
        }
      });
    });

    it('extracts groupId with special characters and spaces safely', () => {
      const parsed = parseRoute('/groups/Trip%20to%20Cox%27s%20Bazar');
      expect(parsed.params.groupId).toBe("Trip to Cox's Bazar");
      expect(parsed.routeName).toBe('group-details');
      expect(parsed.activeTab).toBe('shared-groups');
    });

    it('ensures both /settings and /profile resolve to profile view', () => {
      const settingsRoute = parseRoute('/settings');
      const profileRoute = parseRoute('/profile');

      expect(settingsRoute.activeTab).toBe('profile');
      expect(profileRoute.activeTab).toBe('profile');
      expect(settingsRoute.isProtected).toBe(true);
      expect(profileRoute.isProtected).toBe(true);
    });
  });
});
