import { ActiveTab } from './components/Sidebar';

export type AppRouteName =
  | 'landing'
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'dashboard'
  | 'transactions'
  | 'groups'
  | 'group-details'
  | 'analytics'
  | 'ai-advisor'
  | 'activity'
  | 'profile'
  | 'settings'
  | 'admin-login'
  | 'admin-dashboard'
  | 'not-found';

export interface RouteMatch {
  pathname: string;
  routeName: AppRouteName;
  params: {
    groupId?: string;
    projectId?: string;
  };
  activeTab: ActiveTab;
  isProtected: boolean;
  isAdmin: boolean;
  isAuth: boolean;
}

/**
 * Normalizes a URL pathname by trimming and removing trailing slashes.
 */
export function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  const clean = pathname.trim().split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

/**
 * Pure, authoritative route parser. Derives the complete route state directly from the pathname.
 */
export function parseRoute(rawPath: string): RouteMatch {
  const pathname = normalizePath(rawPath);

  // 1. Public Landing Page
  if (pathname === '/') {
    return {
      pathname,
      routeName: 'landing',
      params: {},
      activeTab: 'dashboard',
      isProtected: false,
      isAdmin: false,
      isAuth: false,
    };
  }

  // 2. Authentication Routes
  if (pathname === '/login' || pathname === '/signin') {
    return {
      pathname,
      routeName: 'login',
      params: {},
      activeTab: 'dashboard',
      isProtected: false,
      isAdmin: false,
      isAuth: true,
    };
  }

  if (pathname === '/signup' || pathname === '/register') {
    return {
      pathname,
      routeName: 'signup',
      params: {},
      activeTab: 'dashboard',
      isProtected: false,
      isAdmin: false,
      isAuth: true,
    };
  }

  if (pathname === '/forgot-password') {
    return {
      pathname,
      routeName: 'forgot-password',
      params: {},
      activeTab: 'dashboard',
      isProtected: false,
      isAdmin: false,
      isAuth: true,
    };
  }

  // 3. Admin Routes
  if (pathname === '/admin/login') {
    return {
      pathname,
      routeName: 'admin-login',
      params: {},
      activeTab: 'system-admin',
      isProtected: false,
      isAdmin: true,
      isAuth: true,
    };
  }

  if (
    pathname === '/admin' ||
    pathname === '/admin/dashboard' ||
    pathname === '/system-admin' ||
    pathname.startsWith('/admin/projects')
  ) {
    let projectId: string | undefined;
    if (pathname.startsWith('/admin/projects/edit/')) {
      projectId = decodeURIComponent(pathname.replace('/admin/projects/edit/', ''));
    }
    return {
      pathname,
      routeName: 'admin-dashboard',
      params: { projectId },
      activeTab: 'system-admin',
      isProtected: true,
      isAdmin: true,
      isAuth: false,
    };
  }

  // 4. Core User Workspace Routes
  if (pathname === '/dashboard' || pathname === '/home') {
    return {
      pathname,
      routeName: 'dashboard',
      params: {},
      activeTab: 'dashboard',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  if (
    pathname === '/transactions' ||
    pathname === '/personal-expenses' ||
    pathname === '/expenses'
  ) {
    return {
      pathname,
      routeName: 'transactions',
      params: {},
      activeTab: 'personal-expenses',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  if (pathname === '/analytics') {
    return {
      pathname,
      routeName: 'analytics',
      params: {},
      activeTab: 'analytics',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  // Profile & Settings aliases (both render the same profile/settings destination)
  if (pathname === '/profile') {
    return {
      pathname,
      routeName: 'profile',
      params: {},
      activeTab: 'profile',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  if (pathname === '/settings') {
    return {
      pathname,
      routeName: 'settings',
      params: {},
      activeTab: 'profile',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  // Group Dynamic Routes: /groups or /groups/:groupId (e.g. /groups/GOA2026, /groups/grp_123)
  if (pathname === '/groups') {
    return {
      pathname,
      routeName: 'groups',
      params: {},
      activeTab: 'shared-groups',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  if (pathname.startsWith('/groups/')) {
    const rawGroupId = pathname.slice('/groups/'.length).trim();
    const groupId = rawGroupId ? decodeURIComponent(rawGroupId) : undefined;
    return {
      pathname,
      routeName: groupId ? 'group-details' : 'groups',
      params: { groupId },
      activeTab: 'shared-groups',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  if (pathname === '/ai-advisor' || pathname === '/ai-copilot') {
    return {
      pathname,
      routeName: 'ai-advisor',
      params: {},
      activeTab: 'ai-advisor',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  if (pathname === '/activity') {
    return {
      pathname,
      routeName: 'activity',
      params: {},
      activeTab: 'activity',
      isProtected: true,
      isAdmin: false,
      isAuth: false,
    };
  }

  // 5. Genuinely Unknown Routes
  return {
    pathname,
    routeName: 'not-found',
    params: {},
    activeTab: 'dashboard',
    isProtected: false,
    isAdmin: false,
    isAuth: false,
  };
}

/**
 * Builds the canonical path for a given tab and optional group ID.
 */
export function getPathForTab(tab: ActiveTab, grpId?: string | null): string {
  switch (tab) {
    case 'system-admin':
      return '/admin/dashboard';
    case 'personal-expenses':
      return '/transactions';
    case 'shared-groups':
      return grpId ? `/groups/${encodeURIComponent(grpId)}` : '/groups';
    case 'analytics':
      return '/analytics';
    case 'ai-advisor':
      return '/ai-advisor';
    case 'activity':
      return '/activity';
    case 'profile':
      return '/profile';
    case 'dashboard':
    default:
      return '/dashboard';
  }
}

/**
 * Legacy compatibility structure for tests and existing consumers.
 */
export type AppRoute = 'landing' | 'signin' | 'signup' | 'forgot-password' | 'app';

export interface RouteState {
  route: AppRoute;
  activeTab: ActiveTab;
  selectedGroupId: string | null;
  isEditProfileOpen: boolean;
}

/**
 * Compatibility wrapper to support existing regression test suite while using the authoritative parser.
 */
export function parseLocationPath(pathname: string): RouteState {
  const match = parseRoute(pathname);

  if (match.routeName === 'landing') {
    return { route: 'landing', activeTab: 'dashboard', selectedGroupId: null, isEditProfileOpen: false };
  }
  if (match.routeName === 'login' || match.routeName === 'admin-login') {
    return { route: 'signin', activeTab: 'dashboard', selectedGroupId: null, isEditProfileOpen: false };
  }
  if (match.routeName === 'signup') {
    return { route: 'signup', activeTab: 'dashboard', selectedGroupId: null, isEditProfileOpen: false };
  }
  if (match.routeName === 'forgot-password') {
    return { route: 'forgot-password', activeTab: 'dashboard', selectedGroupId: null, isEditProfileOpen: false };
  }
  if (match.routeName === 'profile' || match.routeName === 'settings') {
    return { route: 'app', activeTab: 'dashboard', selectedGroupId: null, isEditProfileOpen: true };
  }
  if (match.routeName === 'not-found') {
    return { route: 'landing', activeTab: 'dashboard', selectedGroupId: null, isEditProfileOpen: false };
  }

  return {
    route: 'app',
    activeTab: match.activeTab,
    selectedGroupId: match.params.groupId || null,
    isEditProfileOpen: false,
  };
}
