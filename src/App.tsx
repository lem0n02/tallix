import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  INITIAL_USER,
  INITIAL_REGISTERED_USERS,
  INITIAL_GROUPS,
  INITIAL_EXPENSES,
  INITIAL_SETTLEMENTS,
  CATEGORIES,
  INITIAL_AUDIT_LOGS,
} from './data/mockData';
import { Expense, Group, Settlement, UserProfile, AuditLog, RegisteredUser, LanguageMode, GuestVisit } from './types';
import { enrichGroupsWithBalances, isMemberMatch } from './utils/balanceEngine';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { FooterStatusBar } from './components/FooterStatusBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { DashboardView } from './views/DashboardView';
import { PersonalExpensesView } from './views/PersonalExpensesView';
import { SharedGroupsView } from './views/SharedGroupsView';
import { AnalyticsView } from './views/AnalyticsView';
import { AIAssistantView } from './views/AIAssistantView';
import { AdminView } from './views/AdminView';
import { LandingPageView } from './views/LandingPageView';
import { SignInView } from './components/auth/SignInView';
import { SignUpView } from './components/auth/SignUpView';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { NewTransactionModal } from './components/NewTransactionModal';
import { NewGroupModal } from './components/NewGroupModal';
import { JoinGroupModal } from './components/JoinGroupModal';
import { SettleUpModal } from './components/SettleUpModal';
import { EditProfileModal } from './components/EditProfileModal';
import { EditExpenseModal } from './components/EditExpenseModal';
import { ExitGuestModal } from './components/auth/ExitGuestModal';
import { INITIAL_GUEST_USER, INITIAL_GUEST_GROUPS } from './config/guestConstants';
import { ProfileView } from './views/ProfileView';
import { NotFoundView } from './views/NotFoundView';
import { ActivityView } from './views/ActivityView';
import { LanguageProvider } from './i18n/LanguageContext';
import {
  parseRoute,
  parseLocationPath,
  getPathForTab,
  normalizePath,
  AppRoute,
  RouteState,
} from './router';
import { LocalRepository } from './services/localRepository';
import { generateEntityId } from './services/idGenerator';
import { syncEngine } from './services/syncEngine';
import { updateUserProfile, fetchUserProfileFromD1 } from './services/authService';
import { toPaisa, parseExactMoney, splitExactAmount } from './utils/money';
import {
  getCurrentMonthKey,
  getAvailableMonthKeys,
  filterExpensesByMonth,
} from './utils/monthFilter';

export { parseLocationPath, getPathForTab };
export type { AppRoute, RouteState };

const sanitizeExpenses = (rawExpenses: Expense[]): Expense[] => {
  return rawExpenses.map((exp) => {
    const exactAmount = parseExactMoney(exp.originalAmount !== undefined ? exp.originalAmount : exp.amount);
    const origAmount = exp.originalAmount !== undefined ? parseExactMoney(exp.originalAmount) : exactAmount;
    const exactPaisa = toPaisa(origAmount);

    if (!exp.isShared || !exp.splits || exp.splits.length === 0) {
      return {
        ...exp,
        amount: exactAmount,
        originalAmount: origAmount,
        amount_paisa: exactPaisa,
      };
    }

    // Splits exist: verify exact sum in paisa
    const splitsSumPaisa = exp.splits.reduce((s, sp) => s + toPaisa(sp.amount), 0);
    if (splitsSumPaisa !== exactPaisa) {
      const count = exp.splits.length;
      const splitShares = splitExactAmount(exactAmount, count);
      const fixedSplits = exp.splits.map((sp, idx) => ({
        ...sp,
        amount: splitShares[idx],
        amount_paisa: toPaisa(splitShares[idx]),
      }));
      return {
        ...exp,
        amount: exactAmount,
        originalAmount: origAmount,
        amount_paisa: exactPaisa,
        splits: fixedSplits,
      };
    }

    return {
      ...exp,
      amount: exactAmount,
      originalAmount: origAmount,
      amount_paisa: exactPaisa,
    };
  });
};

export default function App() {
  // Language Global State
  const [lang, setLang] = useState<LanguageMode>(() => {
    const saved = localStorage.getItem('tallix_lang');
    return (saved as LanguageMode) || 'en';
  });

  // Enforce 100% Dark Mode Only
  useEffect(() => {
    try {
      localStorage.removeItem('tallix_theme');
    } catch (e) {}
    const root = document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  }, []);

  // Apply lang to local storage
  useEffect(() => {
    localStorage.setItem('tallix_lang', lang);
  }, [lang]);

  // Single Source of Truth for Routing: Current Browser Path
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });

  // Authoritative route computation derived directly from currentPath
  const currentRoute = useMemo(() => parseRoute(currentPath), [currentPath]);

  // Derived state directly from currentRoute
  const activeTab: ActiveTab = currentRoute.activeTab;
  const selectedGroupId: string | null = currentRoute.params.groupId || null;
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState<boolean>(false);
  const isEditProfileOpen = isEditProfileModalOpen;

  // Unified, authoritative internal navigation helper
  const navigate = useCallback((targetPath: string, options?: { replace?: boolean }) => {
    const normalized = normalizePath(targetPath);
    if (typeof window !== 'undefined') {
      if (options?.replace) {
        window.history.replaceState(null, '', normalized);
      } else if (window.location.pathname !== normalized) {
        window.history.pushState(null, '', normalized);
      }
    }
    setCurrentPath(normalized);
  }, []);

  // Backward-compatible navigateTo helper
  const navigateTo = useCallback(
    (newRoute: AppRoute, targetTab?: ActiveTab, targetGroupId?: string | null) => {
      if (newRoute === 'landing') {
        navigate('/');
      } else if (newRoute === 'signin') {
        navigate('/login');
      } else if (newRoute === 'signup') {
        navigate('/signup');
      } else if (newRoute === 'forgot-password') {
        navigate('/forgot-password');
      } else if (newRoute === 'app') {
        const tab = targetTab || (currentRoute.isProtected ? currentRoute.activeTab : 'dashboard');
        const grp = targetGroupId !== undefined ? targetGroupId : (currentRoute.params.groupId || null);
        navigate(getPathForTab(tab, grp));
      }
    },
    [navigate, currentRoute]
  );

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('tallix_auth') === 'true';
  });

  const [isGuestSession, setIsGuestSession] = useState<boolean>(() => {
    return localStorage.getItem('tallix_auth') === 'guest';
  });

  // Local storage state persistence
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('tallix_user');
    return saved ? JSON.parse(saved) : INITIAL_USER;
  });

  // Sync with browser Back and Forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Tab change handler that updates URL via canonical path
  const handleSelectTab = useCallback(
    (tab: ActiveTab) => {
      const targetPath = getPathForTab(tab);
      navigate(targetPath);
    },
    [navigate]
  );

  const handleSelectGroup = useCallback(
    (groupId: string | null) => {
      const targetPath = groupId ? `/groups/${encodeURIComponent(groupId)}` : '/groups';
      navigate(targetPath);
    },
    [navigate]
  );

  const handleOpenSettings = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  const handleCloseSettings = useCallback(() => {
    setIsEditProfileModalOpen(false);
  }, []);

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>(() => {
    const saved = localStorage.getItem('tallix_registered_users');
    return saved ? JSON.parse(saved) : INITIAL_REGISTERED_USERS;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('tallix_expenses');
    const parsed = saved ? JSON.parse(saved) : INITIAL_EXPENSES;
    return sanitizeExpenses(parsed);
  });

  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('tallix_groups');
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });

  const [settlements, setSettlements] = useState<Settlement[]>(() => {
    const saved = localStorage.getItem('tallix_settlements');
    return saved ? JSON.parse(saved) : INITIAL_SETTLEMENTS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('tallix_audit_logs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [guestVisits, setGuestVisits] = useState<GuestVisit[]>(() => {
    const saved = localStorage.getItem('tallix_guest_visits');
    return saved ? JSON.parse(saved) : [];
  });

  // Guest-isolated data state
  const [guestUser, setGuestUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('tallix_guest_user');
    return saved ? JSON.parse(saved) : INITIAL_GUEST_USER;
  });

  const [guestExpenses, setGuestExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('tallix_guest_expenses');
    return saved ? sanitizeExpenses(JSON.parse(saved)) : [];
  });

  const [guestGroups, setGuestGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('tallix_guest_groups');
    return saved ? JSON.parse(saved) : INITIAL_GUEST_GROUPS;
  });

  const [guestSettlements, setGuestSettlements] = useState<Settlement[]>(() => {
    const saved = localStorage.getItem('tallix_guest_settlements');
    return saved ? JSON.parse(saved) : [];
  });

  // Modal for Exit Guest Confirmation
  const [isExitGuestModalOpen, setIsExitGuestModalOpen] = useState(false);

  // Modals state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Sync registered user state to local storage (only when NOT in guest session)
  useEffect(() => {
    if (!isGuestSession) {
      localStorage.setItem('tallix_user', JSON.stringify(user));
    }
  }, [user, isGuestSession]);

  useEffect(() => {
    localStorage.setItem('tallix_auth', isAuthenticated ? 'true' : isGuestSession ? 'guest' : 'false');
  }, [isAuthenticated, isGuestSession]);

  useEffect(() => {
    localStorage.setItem('tallix_registered_users', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    if (!isGuestSession) {
      localStorage.setItem('tallix_expenses', JSON.stringify(expenses));
    }
  }, [expenses, isGuestSession]);

  useEffect(() => {
    if (!isGuestSession) {
      localStorage.setItem('tallix_groups', JSON.stringify(groups));
    }
  }, [groups, isGuestSession]);

  useEffect(() => {
    if (!isGuestSession) {
      localStorage.setItem('tallix_settlements', JSON.stringify(settlements));
    }
  }, [settlements, isGuestSession]);

  useEffect(() => {
    localStorage.setItem('tallix_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('tallix_guest_visits', JSON.stringify(guestVisits));
  }, [guestVisits]);

  // Guest-isolated persistence
  useEffect(() => {
    if (isGuestSession) {
      localStorage.setItem('tallix_guest_user', JSON.stringify(guestUser));
    }
  }, [guestUser, isGuestSession]);

  useEffect(() => {
    if (isGuestSession) {
      localStorage.setItem('tallix_guest_expenses', JSON.stringify(guestExpenses));
    }
  }, [guestExpenses, isGuestSession]);

  useEffect(() => {
    if (isGuestSession) {
      localStorage.setItem('tallix_guest_groups', JSON.stringify(guestGroups));
    }
  }, [guestGroups, isGuestSession]);

  useEffect(() => {
    if (isGuestSession) {
      localStorage.setItem('tallix_guest_settlements', JSON.stringify(guestSettlements));
    }
  }, [guestSettlements, isGuestSession]);

  // Offline-First IndexedDB Initializer & Remote Synchronization Subscription
  useEffect(() => {
    let isMounted = true;

    // Ensure syncEngine listeners and reachability checks are initialized
    syncEngine.initListeners();

    // Initialize local IndexedDB database and migrate localStorage seed
    LocalRepository.initialize({
      expenses: sanitizeExpenses(INITIAL_EXPENSES),
      groups: INITIAL_GROUPS,
      settlements: INITIAL_SETTLEMENTS,
      registeredUsers: INITIAL_REGISTERED_USERS,
      auditLogs: INITIAL_AUDIT_LOGS,
      guestVisits: [],
    }).then((loadedData) => {
      if (!isMounted) return;
      if (loadedData.expenses) {
        setExpenses(sanitizeExpenses(loadedData.expenses));
      }
      if (loadedData.groups) {
        setGroups(loadedData.groups);
      }
      if (loadedData.settlements) {
        setSettlements(loadedData.settlements);
      }
      if (loadedData.registeredUsers && loadedData.registeredUsers.length > 0) {
        setRegisteredUsers(loadedData.registeredUsers);
      }
      if (loadedData.auditLogs && loadedData.auditLogs.length > 0) {
        setAuditLogs(loadedData.auditLogs);
      }
      if (loadedData.guestVisits && loadedData.guestVisits.length > 0) {
        setGuestVisits(loadedData.guestVisits);
      }
    });

    // When background sync pulls remote changes from Cloudflare, update local state
    const unsubscribeData = syncEngine.subscribeDataUpdates(async () => {
      if (!isMounted) return;
      const [allExp, allGrp, allStl, allUsr] = await Promise.all([
        LocalRepository.getAllExpenses(),
        LocalRepository.getAllGroups(),
        LocalRepository.getAllSettlements(),
        LocalRepository.getAllRegisteredUsers(),
      ]);
      setExpenses(sanitizeExpenses(allExp));
      setGroups(allGrp);
      setSettlements(allStl);
      if (allUsr && allUsr.length > 0) {
        setRegisteredUsers(allUsr);

        // When remote changes from another device arrive, synchronize current authenticated user's profile
        setUser((currentUser) => {
          if (!currentUser || !currentUser.id || currentUser.isGuest) return currentUser;
          const remoteMe = allUsr.find((u) => u.id === currentUser.id || (u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()));
          if (remoteMe) {
            const remoteBudget = remoteMe.monthlyBudget !== undefined ? Number(remoteMe.monthlyBudget) : (remoteMe.liquidityLimit !== undefined ? Number(remoteMe.liquidityLimit) : currentUser.liquidityLimit);
            const remoteAvatar = remoteMe.avatarUrl || undefined;
            const currentBudget = currentUser.monthlyBudget !== undefined ? currentUser.monthlyBudget : currentUser.liquidityLimit;
            if (remoteAvatar !== currentUser.avatarUrl || remoteBudget !== currentBudget) {
              const updatedProfile: UserProfile = {
                ...currentUser,
                avatarUrl: remoteAvatar,
                monthlyBudget: remoteBudget,
                liquidityLimit: remoteBudget,
              };
              try {
                localStorage.setItem('tallix_user', JSON.stringify(updatedProfile));
              } catch {
                // Ignore storage quota
              }
              return updatedProfile;
            }
          }
          return currentUser;
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribeData();
    };
  }, []);

  // Cross-device profile sync on authenticated session startup
  useEffect(() => {
    if (isAuthenticated && !isGuestSession && user?.id) {
      fetchUserProfileFromD1(user.id, user.email).then((freshProfile) => {
        if (freshProfile) {
          setUser((curr) => {
            const currentBudget = curr.monthlyBudget !== undefined ? curr.monthlyBudget : curr.liquidityLimit;
            const freshBudget = freshProfile.monthlyBudget !== undefined ? freshProfile.monthlyBudget : freshProfile.liquidityLimit;
            const isDifferent =
              freshProfile.avatarUrl !== curr.avatarUrl ||
              freshBudget !== currentBudget;

            if (isDifferent) {
              const updated: UserProfile = {
                ...curr,
                avatarUrl: freshProfile.avatarUrl,
                monthlyBudget: freshBudget,
                liquidityLimit: freshBudget,
              };
              try {
                localStorage.setItem('tallix_user', JSON.stringify(updated));
              } catch {
                // Ignore storage quota
              }
              return updated;
            }
            return curr;
          });
        }
      }).catch((e) => console.warn('[App] Could not fetch fresh profile from D1:', e));
    }
  }, [isAuthenticated, isGuestSession, user?.id]);

  // Active State Collections: completely isolated between Guest Mode and Registered Users
  const activeUser = isGuestSession ? guestUser : user;
  const activeExpenses = isGuestSession ? guestExpenses : expenses;
  const activeGroups = isGuestSession ? guestGroups : groups;
  const activeSettlements = isGuestSession ? guestSettlements : settlements;

  // Update syncEngine active user ID (never enable remote sync for guest sessions)
  useEffect(() => {
    if (isGuestSession || activeUser?.isGuest) {
      syncEngine.setUserId(null);
    } else {
      syncEngine.setUserId(activeUser?.id || null);
    }
  }, [activeUser?.id, activeUser?.isGuest, isGuestSession]);

  // Data Isolation Per Logged-In User with Dynamic Real-time Balance Calculation
  const userGroups = React.useMemo(() => {
    if (!activeUser || !activeUser.id) return [];
    const cleanUserEmail = (activeUser.email || '').toLowerCase();
    const filtered = activeGroups.filter((g) =>
      Array.isArray(g.members) &&
      g.members.some(
        (m) =>
          isMemberMatch(m, activeUser.id, activeUser.name) ||
          (m.email && m.email.toLowerCase() === cleanUserEmail)
      )
    );
    return enrichGroupsWithBalances(filtered, activeExpenses, activeSettlements);
  }, [activeGroups, activeExpenses, activeSettlements, activeUser]);

  const userGroupIds = React.useMemo(() => {
    return new Set(userGroups.map((g) => g.id));
  }, [userGroups]);

  // All authorized expenses for this user (including all squad expenses for squads they belong to)
  const userExpenses = React.useMemo(() => {
    if (!activeUser || !activeUser.id) return [];
    const cleanUserEmail = (activeUser.email || '').toLowerCase();
    const userMember = { id: activeUser.id, name: activeUser.name, email: activeUser.email };
    return activeExpenses.filter((e) => {
      // Shared expense: only accessible if user is a member of that Squad
      if (e.isShared && e.groupId) {
        return userGroupIds.has(e.groupId);
      }
      // Personal expense: owned / paid by user
      return (
        e.paidByUserId === activeUser.id ||
        e.createdBy === activeUser.id ||
        (e as any).createdByEmail?.toLowerCase() === cleanUserEmail ||
        isMemberMatch(userMember, e.paidByUserId, e.paidByName)
      );
    });
  }, [activeExpenses, activeUser, userGroupIds]);

  // Dedicated Dashboard Query: Current user's personal transactions PLUS squad transactions
  // where the CURRENT USER is the payer / owner. Transactions paid by other members are excluded from Dashboard.
  const dashboardExpenses = React.useMemo(() => {
    if (!activeUser || !activeUser.id) return [];
    const cleanUserEmail = (activeUser.email || '').toLowerCase();
    const userMember = { id: activeUser.id, name: activeUser.name, email: activeUser.email };

    return userExpenses.filter((e) => {
      const isPaidByMe = isMemberMatch(userMember, e.paidByUserId, e.paidByName);
      const isOwnedByMe =
        e.paidByUserId === activeUser.id ||
        e.createdBy === activeUser.id ||
        (e as any).createdByEmail?.toLowerCase() === cleanUserEmail;

      return isPaidByMe || isOwnedByMe;
    });
  }, [userExpenses, activeUser]);

  const userSettlements = React.useMemo(() => {
    if (!activeUser || !activeUser.id) return [];
    return activeSettlements.filter(
      (s) =>
        s.fromUserId === activeUser.id ||
        s.toUserId === activeUser.id ||
        (s.groupId && userGroupIds.has(s.groupId))
    );
  }, [activeSettlements, activeUser, userGroupIds]);

  // Shared Month Filter State: Defaults to current month, preserved across page refresh in sessionStorage
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('tallix_selected_month');
      if (saved) return saved;
    } catch {
      // Ignore storage errors
    }
    return getCurrentMonthKey();
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('tallix_selected_month', selectedMonth);
    } catch {
      // Ignore storage errors
    }
  }, [selectedMonth]);

  // Dynamically compute available months based on transaction dates (descending order)
  const availableMonths = useMemo(() => {
    return getAvailableMonthKeys(activeExpenses);
  }, [activeExpenses]);

  // Month-filtered personal and shared expenses
  const monthFilteredUserExpenses = useMemo(() => {
    return filterExpensesByMonth(userExpenses, selectedMonth);
  }, [userExpenses, selectedMonth]);

  // Month-filtered dashboard expenses (personal + paid by me in squads)
  const monthFilteredDashboardExpenses = useMemo(() => {
    return filterExpensesByMonth(dashboardExpenses, selectedMonth);
  }, [dashboardExpenses, selectedMonth]);

  // Route Protection: Redirect unauthenticated users trying to access protected workspace routes
  useEffect(() => {
    if (currentRoute.isProtected) {
      if (!isAuthenticated && !isGuestSession) {
        try {
          sessionStorage.setItem('tallix_intended_destination', currentPath);
        } catch {
          // Ignore storage errors
        }
        navigate('/login', { replace: true });
      }
    }
  }, [currentRoute.isProtected, isAuthenticated, isGuestSession, currentPath, navigate]);

  // Role Guard: Redirect non-admin users away from admin dashboard
  useEffect(() => {
    if (currentRoute.isAdmin && activeUser.systemRole !== 'Admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [currentRoute.isAdmin, activeUser.systemRole, navigate]);

  // Auth Guard: Redirect already-authenticated users away from login/signup/forgot-password
  useEffect(() => {
    if (currentRoute.isAuth && (isAuthenticated || isGuestSession)) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentRoute.isAuth, isAuthenticated, isGuestSession, navigate]);

  // Handlers
  const handleSaveUser = async (updatedUser: UserProfile) => {
    if (isGuestSession) {
      setGuestUser(updatedUser);
      try {
        localStorage.setItem('tallix_guest_user', JSON.stringify(updatedUser));
      } catch {
        // Ignore localStorage quota
      }
      setAuditLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Guest profile updated locally: ${updatedUser.name}`,
          source: 'guest-manager',
        },
        ...prev,
      ]);
      return;
    }

    setUser(updatedUser);
    try {
      localStorage.setItem('tallix_user', JSON.stringify(updatedUser));
    } catch {
      // Ignore localStorage errors
    }

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Profile updated: ${updatedUser.name} (${updatedUser.email})`,
        source: 'user-manager',
      },
      ...prev,
    ]);

    // Update in registeredUsers local state
    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id === updatedUser.id || (u.email && u.email.toLowerCase() === updatedUser.email.toLowerCase())) {
          return {
            ...u,
            avatarUrl: updatedUser.avatarUrl,
            monthlyBudget: updatedUser.monthlyBudget ?? updatedUser.liquidityLimit,
            liquidityLimit: updatedUser.liquidityLimit ?? updatedUser.monthlyBudget,
            updatedAt: new Date().toISOString(),
          };
        }
        return u;
      })
    );

    // Persist to authoritative Cloudflare D1
    if (!isGuestSession && updatedUser.id) {
      try {
        const result = await updateUserProfile({
          userId: updatedUser.id,
          email: updatedUser.email,
          avatarUrl: updatedUser.avatarUrl || null,
          monthlyBudget: updatedUser.monthlyBudget ?? updatedUser.liquidityLimit,
          liquidityLimit: updatedUser.liquidityLimit ?? updatedUser.monthlyBudget,
        });

        if (result.success && result.user) {
          setUser(result.user);
          try {
            localStorage.setItem('tallix_user', JSON.stringify(result.user));
          } catch {
            // Ignore storage quota
          }
        }

        // Trigger background sync engine to push any queued mutations
        syncEngine.triggerSync().catch(() => {});
      } catch (err) {
        console.warn('[App] Profile save persistence error:', err);
      }
    }
  };

  const handleRegisterUser = (newUser: RegisteredUser) => {
    setRegisteredUsers((prev) => [newUser, ...prev]);
    LocalRepository.saveRegisteredUser(newUser);
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `New user account created: ${newUser.name} (${newUser.email}) - Role: ${newUser.systemRole}`,
        source: 'auth-service',
      },
      ...prev,
    ]);
  };

  const handleDeleteUser = (userIdToDelete: string) => {
    setRegisteredUsers((prev) => prev.filter((u) => u.id !== userIdToDelete));
    LocalRepository.deleteRegisteredUser(userIdToDelete);
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: `User account deleted by admin: ID ${userIdToDelete}`,
        source: 'admin-controller',
      },
      ...prev,
    ]);
  };

  const handleToggleUserStatus = (userId: string) => {
    let updatedUser: RegisteredUser | undefined;
    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
          updatedUser = { ...u, status: nextStatus };
          return updatedUser;
        }
        return u;
      })
    );
    if (updatedUser) {
      LocalRepository.updateRegisteredUser(updatedUser);
    }
    const targetUser = registeredUsers.find((u) => u.id === userId);
    const newStatus = targetUser?.status === 'Active' ? 'Disabled' : 'Active';
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `User status changed for ${targetUser?.email || userId}: ${newStatus}`,
        source: 'admin-controller',
      },
      ...prev,
    ]);
  };

  const handleChangeUserRole = (userId: string, newRole: 'Admin' | 'User') => {
    let updatedUser: RegisteredUser | undefined;
    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          updatedUser = { ...u, systemRole: newRole };
          return updatedUser;
        }
        return u;
      })
    );
    if (updatedUser) {
      LocalRepository.updateRegisteredUser(updatedUser);
    }
    const targetUser = registeredUsers.find((u) => u.id === userId);
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `User role changed for ${targetUser?.email || userId}: ${newRole}`,
        source: 'admin-controller',
      },
      ...prev,
    ]);
  };

  const handleToggleUserAICopilot = (userId: string) => {
    let updatedUser: RegisteredUser | undefined;
    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextVal = u.aiCopilotEnabled === false ? true : false;
          updatedUser = { ...u, aiCopilotEnabled: nextVal };
          return updatedUser;
        }
        return u;
      })
    );
    if (updatedUser) {
      LocalRepository.updateRegisteredUser(updatedUser);
    }
    const targetUser = registeredUsers.find((u) => u.id === userId);
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `AI Copilot access toggled for ${targetUser?.email || userId}`,
        source: 'admin-controller',
      },
      ...prev,
    ]);
  };

  const handleAddUserByAdmin = (newUser: RegisteredUser) => {
    setRegisteredUsers((prev) => [newUser, ...prev]);
    LocalRepository.saveRegisteredUser(newUser);
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `User added by Admin: ${newUser.name} (${newUser.email}) - Role: ${newUser.systemRole}`,
        source: 'admin-controller',
      },
      ...prev,
    ]);
  };

  const handleAuthSuccess = (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setIsAuthenticated(true);
    setIsGuestSession(false);
    localStorage.setItem('tallix_auth', 'true');
    localStorage.setItem('tallix_user', JSON.stringify(authenticatedUser));

    // Ensure authenticated user is in registeredUsers state so local views immediately have access
    setRegisteredUsers((prev) => {
      if (prev.some((u) => u.id === authenticatedUser.id || (u.email && u.email.toLowerCase() === authenticatedUser.email.toLowerCase()))) {
        return prev;
      }
      return [
        {
          id: authenticatedUser.id,
          name: authenticatedUser.name,
          email: authenticatedUser.email,
          systemRole: authenticatedUser.systemRole,
          roleTitle: authenticatedUser.title,
          department: authenticatedUser.department,
          avatarGradient: authenticatedUser.avatarGradient,
          createdAt: new Date().toISOString().split('T')[0],
          status: 'Active',
          isVerified: true,
        },
        ...prev,
      ];
    });

    // Automatic Role-Based Dashboard Redirection or Restoring Intended Destination
    let destination = authenticatedUser.systemRole === 'Admin' ? '/admin/dashboard' : '/dashboard';
    try {
      const intended = sessionStorage.getItem('tallix_intended_destination');
      if (intended) {
        sessionStorage.removeItem('tallix_intended_destination');
        const parsed = parseRoute(intended);
        if (parsed.routeName !== 'landing' && !parsed.isAuth && parsed.routeName !== 'not-found') {
          if (authenticatedUser.systemRole === 'Admin' || !parsed.isAdmin) {
            destination = intended;
          }
        }
      }
    } catch {
      // ignore storage errors
    }
    navigate(destination);

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Successful login: ${authenticatedUser.name} (${authenticatedUser.systemRole} Role)`,
        source: 'auth-session',
      },
      ...prev,
    ]);
  };

  const handleContinueAsGuest = () => {
    setIsAuthenticated(false);
    setIsGuestSession(true);
    localStorage.setItem('tallix_auth', 'guest');

    // Ensure default guest state in local storage if not yet initialized
    const savedGuestUser = localStorage.getItem('tallix_guest_user');
    if (!savedGuestUser) {
      setGuestUser(INITIAL_GUEST_USER);
      localStorage.setItem('tallix_guest_user', JSON.stringify(INITIAL_GUEST_USER));
    }

    const savedGuestGroups = localStorage.getItem('tallix_guest_groups');
    if (!savedGuestGroups) {
      setGuestGroups(INITIAL_GUEST_GROUPS);
      localStorage.setItem('tallix_guest_groups', JSON.stringify(INITIAL_GUEST_GROUPS));
    }

    syncEngine.setUserId(null);

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Guest Mode session started (isolated local device mode)',
        source: 'guest-session',
      },
      ...prev,
    ]);

    navigate('/dashboard');
  };

  const handleExitGuestMode = () => {
    setIsExitGuestModalOpen(false);
    setIsGuestSession(false);
    setIsAuthenticated(false);
    localStorage.removeItem('tallix_auth');
    localStorage.removeItem('tallix_guest_expenses');
    localStorage.removeItem('tallix_guest_groups');
    localStorage.removeItem('tallix_guest_settlements');
    localStorage.removeItem('tallix_guest_user');

    setGuestExpenses([]);
    setGuestGroups(INITIAL_GUEST_GROUPS);
    setGuestSettlements([]);
    setGuestUser(INITIAL_GUEST_USER);

    // If a registered user was previously cached, restore their profile so login screen is ready
    const cachedRegisteredUser = localStorage.getItem('tallix_user');
    if (cachedRegisteredUser) {
      try {
        setUser(JSON.parse(cachedRegisteredUser));
      } catch {}
    } else {
      setUser(INITIAL_USER);
    }

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Exited Guest Mode session',
        source: 'guest-session',
      },
      ...prev,
    ]);

    navigate('/login');
  };

  const handleGuestSubmit = (guestRecord: GuestVisit) => {
    setGuestVisits((prev) => [guestRecord, ...prev]);
    LocalRepository.addGuestVisit(guestRecord);
    setIsAuthenticated(false);
    setIsGuestSession(true);
    localStorage.setItem('tallix_auth', 'guest');
    setIsGuestModalOpen(false);

    // Create temporary guest user profile
    const guestUserRecord: UserProfile = {
      id: guestRecord.id,
      name: guestRecord.name,
      email: guestRecord.email,
      role: 'Guest Visitor',
      title: 'Guest Session',
      department: 'Platform Visitor',
      systemRole: 'User',
      avatarGradient: 'from-[#0062FF] to-[#60A5FA]',
      liquidityLimit: 0,
      monthlyBurnRate: 0,
      currentLiquidity: 0,
      isGuest: true,
    };

    setGuestUser(guestUserRecord);
    localStorage.setItem('tallix_guest_user', JSON.stringify(guestUserRecord));

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Guest visit session initiated: ${guestRecord.name} (${guestRecord.email})`,
        source: 'guest-collector',
      },
      ...prev,
    ]);

    navigate('/dashboard');
  };

  const handleLogout = () => {
    if (isGuestSession) {
      setIsExitGuestModalOpen(true);
      return;
    }
    setIsAuthenticated(false);
    setIsGuestSession(false);
    setUser(INITIAL_USER);
    localStorage.removeItem('tallix_auth');
    localStorage.removeItem('tallix_user');
    try {
      sessionStorage.removeItem('tallix_intended_destination');
    } catch {}

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `User logged out: ${user?.name || 'User'}`,
        source: 'auth-session',
      },
      ...prev,
    ]);

    navigate('/login');
  };

  const handleSaveExpense = (newExpenseData: Omit<Expense, 'id'>) => {
    const defaultGroup = userGroups[0];
    const targetGroupId = newExpenseData.isShared
      ? (newExpenseData.groupId || selectedGroupId || defaultGroup?.id)
      : undefined;
    const selectedGroup = activeGroups.find((g) => g.id === targetGroupId);

    // Find if the logged in user matches a specific member ID in the group, or fallback to activeUser.id
    const matchedPayer = selectedGroup?.members.find((m) =>
      isMemberMatch(m, activeUser.id, activeUser.name)
    );
    const finalPaidByUserId = newExpenseData.paidByUserId || (matchedPayer ? matchedPayer.id : activeUser.id);
    const finalPaidByName = newExpenseData.paidByName || (matchedPayer ? matchedPayer.name : activeUser.name);

    const exactAmount = parseExactMoney(newExpenseData.amount);
    const origAmount = newExpenseData.originalAmount !== undefined
      ? parseExactMoney(newExpenseData.originalAmount)
      : exactAmount;
    const exactPaisa = toPaisa(origAmount);

    const createdExpense: Expense = {
      id: generateEntityId('exp'),
      ...newExpenseData,
      amount: exactAmount,
      originalAmount: origAmount,
      amount_paisa: exactPaisa,
      isShared: !!newExpenseData.isShared,
      groupId: targetGroupId,
      groupName: newExpenseData.isShared ? (selectedGroup?.name || newExpenseData.groupName) : undefined,
      createdBy: activeUser.id,
      createdByEmail: activeUser.email,
      paidByUserId: finalPaidByUserId,
      paidByName: finalPaidByName,
    } as Expense;

    if (isGuestSession) {
      setGuestExpenses((prev) => [createdExpense, ...prev]);

      if (createdExpense.isShared && createdExpense.groupId) {
        setGuestGroups((prevGroups) =>
          prevGroups.map((g) => {
            if (g.id === createdExpense.groupId) {
              return {
                ...g,
                totalSpent: Math.round((g.totalSpent + createdExpense.amount) * 100) / 100,
              };
            }
            return g;
          })
        );
      }

      setAuditLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Guest expense logged: "${createdExpense.title}" (৳${createdExpense.amount})`,
          source: 'guest-ledger',
        },
        ...prev,
      ]);
      return;
    }

    // Persist locally in IndexedDB and enqueue for sync
    LocalRepository.createExpense(createdExpense, user.id);
    setExpenses((prev) => [createdExpense, ...prev]);

    if (createdExpense.isShared && createdExpense.groupId) {
      setGroups((prevGroups) =>
        prevGroups.map((g) => {
          if (g.id === createdExpense.groupId) {
            const updated = {
              ...g,
              totalSpent: Math.round((g.totalSpent + createdExpense.amount) * 100) / 100,
            };
            LocalRepository.updateGroup(updated, user.id);
            return updated;
          }
          return g;
        })
      );
    }

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `New expense logged: "${createdExpense.title}" (৳${createdExpense.amount})`,
        source: 'expense-ledger',
      },
      ...prev,
    ]);
  };

  const handleUpdateExpenseStatus = (id: string, status: 'Completed' | 'Pending' | 'Approved' | 'Flagged') => {
    if (isGuestSession) {
      setGuestExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status } : e))
      );
      return;
    }
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const updated = { ...e, status };
          LocalRepository.updateExpense(updated, user.id);
          return updated;
        }
        return e;
      })
    );
  };

  const handleToggleExpenseStatus = (id: string) => {
    if (isGuestSession) {
      setGuestExpenses((prev) =>
        prev.map((e) => {
          if (e.id === id) {
            const nextStatus = (e.status === 'Completed' ? 'Pending' : 'Completed') as 'Completed' | 'Pending';
            return { ...e, status: nextStatus };
          }
          return e;
        })
      );
      return;
    }
    setExpenses((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const nextStatus = (e.status === 'Completed' ? 'Pending' : 'Completed') as 'Completed' | 'Pending';
          const updated = { ...e, status: nextStatus };
          LocalRepository.updateExpense(updated, user.id);
          return updated;
        }
        return e;
      })
    );
  };

  const handleDeleteExpense = (id: string) => {
    if (isGuestSession) {
      setGuestExpenses((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    LocalRepository.deleteExpense(id, user.id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSaveGroup = (newGroupData: {
    name: string;
    description: string;
    category: string;
    imageUrl?: string;
  }) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randCode = `${chars.charAt(Math.floor(Math.random() * 26))}${chars.charAt(Math.floor(Math.random() * 26))}${chars.charAt(Math.floor(Math.random() * 26))}-${chars.charAt(Math.floor(Math.random() * 26))}${chars.charAt(Math.floor(Math.random() * 26))}${chars.charAt(Math.floor(Math.random() * 26))}-${Math.floor(100 + Math.random() * 900)}`;

    const createdGroup: Group = {
      id: generateEntityId('grp'),
      name: newGroupData.name,
      description: newGroupData.description,
      category: newGroupData.category,
      imageUrl: newGroupData.imageUrl,
      inviteCode: randCode,
      currency: 'BDT',
      createdAt: new Date().toISOString().split('T')[0],
      avatarGradient: 'from-[#0062FF] to-[#60A5FA]',
      totalSpent: 0,
      unsettledAmount: 0,
      members: [
        {
          id: activeUser.id,
          name: activeUser.name,
          email: activeUser.email,
          role: 'Admin',
          balance: 0,
        },
      ],
    };

    if (isGuestSession) {
      setGuestGroups((prev) => [createdGroup, ...prev]);
      navigate(`/groups/${encodeURIComponent(createdGroup.id)}`);
      setAuditLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Created guest squad: "${createdGroup.name}"`,
          source: 'guest-squad',
        },
        ...prev,
      ]);
      return;
    }

    LocalRepository.createGroup(createdGroup, user.id);
    setGroups((prev) => [createdGroup, ...prev]);
    navigate(`/groups/${encodeURIComponent(createdGroup.id)}`);

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Created new squad: "${createdGroup.name}" with code ${randCode}`,
        source: 'squad-manager',
      },
      ...prev,
    ]);
  };

  const handleJoinGroupByCode = (inviteCode: string): { success: boolean; message: string } => {
    const cleanCode = inviteCode.trim().toUpperCase();
    const targetGroups = isGuestSession ? guestGroups : groups;
    const matchedGroup = targetGroups.find((g) => g.inviteCode?.toUpperCase() === cleanCode);

    if (!matchedGroup) {
      return { success: false, message: 'Invalid invite code. Squad not found.' };
    }

    const isAlreadyMember = matchedGroup.members.some((m) => m.id === activeUser.id || m.email === activeUser.email);
    if (isAlreadyMember) {
      return { success: false, message: `You are already a member of ${matchedGroup.name}.` };
    }

    if (isGuestSession) {
      setGuestGroups((prev) =>
        prev.map((g) => {
          if (g.id === matchedGroup.id) {
            return {
              ...g,
              members: [
                ...g.members,
                {
                  id: activeUser.id,
                  name: activeUser.name,
                  email: activeUser.email,
                  role: 'Member',
                  balance: 0,
                },
              ],
            };
          }
          return g;
        })
      );
      navigate(`/groups/${encodeURIComponent(matchedGroup.id)}`);
      return { success: true, message: `Successfully joined ${matchedGroup.name}!` };
    }

    let updatedGroup: Group | undefined;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === matchedGroup.id) {
          updatedGroup = {
            ...g,
            members: [
              ...g.members,
              {
                id: user.id,
                name: user.name,
                email: user.email,
                role: 'Member',
                balance: 0,
              },
            ],
          };
          return updatedGroup;
        }
        return g;
      })
    );

    if (updatedGroup) {
      LocalRepository.updateGroup(updatedGroup, user.id);
    }

    navigate(`/groups/${encodeURIComponent(matchedGroup.id)}`);

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `User ${user.name} joined squad "${matchedGroup.name}" via code ${cleanCode}`,
        source: 'squad-manager',
      },
      ...prev,
    ]);

    return { success: true, message: `Successfully joined ${matchedGroup.name}!` };
  };

  const handleDeleteGroup = (groupId: string) => {
    if (isGuestSession) {
      setGuestGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (selectedGroupId === groupId) {
        navigate('/groups');
      }
      return;
    }
    const targetGroup = groups.find((g) => g.id === groupId);
    LocalRepository.deleteGroup(groupId, user.id);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (selectedGroupId === groupId) {
      navigate('/groups');
    }
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: `Squad deleted: "${targetGroup?.name || groupId}"`,
        source: 'squad-manager',
      },
      ...prev,
    ]);
  };

  const handleRemoveMember = (groupId: string, memberId: string) => {
    if (isGuestSession) {
      setGuestGroups((prev) =>
        prev.map((g) => {
          if (g.id === groupId) {
            return {
              ...g,
              members: g.members.filter((m) => m.id !== memberId),
            };
          }
          return g;
        })
      );
      return;
    }
    let updatedGroup: Group | undefined;
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          updatedGroup = {
            ...g,
            members: g.members.filter((m) => m.id !== memberId),
          };
          return updatedGroup;
        }
        return g;
      })
    );
    if (updatedGroup) {
      LocalRepository.updateGroup(updatedGroup, user.id);
    }
  };

  const handleEditExpense = (updatedExpense: Expense) => {
    const exactAmount = parseExactMoney(updatedExpense.amount);
    const origAmount = updatedExpense.originalAmount !== undefined
      ? parseExactMoney(updatedExpense.originalAmount)
      : exactAmount;
    const cleanExpense: Expense = {
      ...updatedExpense,
      amount: exactAmount,
      originalAmount: origAmount,
      amount_paisa: toPaisa(origAmount),
      updatedAt: new Date().toISOString(),
    };

    if (isGuestSession) {
      setGuestExpenses((prev) => prev.map((e) => (e.id === cleanExpense.id ? cleanExpense : e)));
      return;
    }

    LocalRepository.updateExpense(cleanExpense, user.id);
    setExpenses((prev) => prev.map((e) => (e.id === cleanExpense.id ? cleanExpense : e)));
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Expense updated: "${cleanExpense.title}" (৳${cleanExpense.amount})`,
        source: 'expense-ledger',
      },
      ...prev,
    ]);
  };

  const handleAcceptSettlement = (settlementId: string) => {
    if (isGuestSession) {
      setGuestSettlements((prev) =>
        prev.map((s) => (s.id === settlementId ? { ...s, status: 'Accepted' } : s))
      );
      return;
    }
    let targetSettlement: Settlement | undefined;
    setSettlements((prev) =>
      prev.map((s) => {
        if (s.id === settlementId) {
          targetSettlement = { ...s, status: 'Accepted' };
          return targetSettlement;
        }
        return s;
      })
    );
    if (targetSettlement) {
      LocalRepository.updateSettlement(targetSettlement, user.id);
    }
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Settlement accepted: ID ${settlementId}`,
        source: 'settlement-engine',
      },
      ...prev,
    ]);
  };

  const handleRejectSettlement = (settlementId: string) => {
    if (isGuestSession) {
      setGuestSettlements((prev) =>
        prev.map((s) => (s.id === settlementId ? { ...s, status: 'Rejected' } : s))
      );
      return;
    }
    let targetSettlement: Settlement | undefined;
    setSettlements((prev) =>
      prev.map((s) => {
        if (s.id === settlementId) {
          targetSettlement = { ...s, status: 'Rejected' };
          return targetSettlement;
        }
        return s;
      })
    );
    if (targetSettlement) {
      LocalRepository.updateSettlement(targetSettlement, user.id);
    }
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Settlement rejected: ID ${settlementId}`,
        source: 'settlement-engine',
      },
      ...prev,
    ]);
  };

  const handleSettleUp = (settlementData: Settlement | any) => {
    const activeGroupList = isGuestSession ? guestGroups : groups;
    const matchedGroup = activeGroupList.find((g) => g.id === settlementData.groupId);
    
    // Attempt to resolve payee member from group members list
    const payeeName = settlementData.payeeName || settlementData.toUserName || 'Recipient';
    const payeeMember = matchedGroup?.members.find(
      (m) =>
        (settlementData.toUserId && m.id === settlementData.toUserId) ||
        isMemberMatch(m, undefined, payeeName)
    );

    const payerName = settlementData.payerName || settlementData.fromUserName || activeUser.name;
    const payerMember = matchedGroup?.members.find(
      (m) =>
        (settlementData.fromUserId && m.id === settlementData.fromUserId) ||
        isMemberMatch(m, undefined, payerName)
    );

    const exactAmount = parseExactMoney(settlementData.amount);
    const origAmount = settlementData.originalAmount !== undefined
      ? parseExactMoney(settlementData.originalAmount)
      : exactAmount;

    const newSettlement: Settlement = {
      id: settlementData.id || generateEntityId('stl'),
      groupId: settlementData.groupId || matchedGroup?.id || '',
      groupName: matchedGroup?.name || settlementData.groupName || 'Shared Squad',
      fromUserId: payerMember?.id || settlementData.fromUserId || activeUser.id,
      fromUserName: payerMember?.name || payerName,
      toUserId: payeeMember?.id || settlementData.toUserId || generateEntityId('usr'),
      toUserName: payeeMember?.name || payeeName,
      amount: exactAmount,
      originalAmount: origAmount,
      amount_paisa: toPaisa(origAmount),
      currency: settlementData.currency || matchedGroup?.currency || 'BDT',
      paymentMethod: settlementData.paymentMethod || 'bKash',
      status: settlementData.status || 'Pending',
      createdAt: settlementData.createdAt || new Date().toISOString().split('T')[0],
      proofUrl: settlementData.proofUrl,
      note: settlementData.note,
    };

    if (isGuestSession) {
      setGuestSettlements((prev) => [newSettlement, ...prev.filter((s) => s.id !== newSettlement.id)]);
      return;
    }

    LocalRepository.createSettlement(newSettlement, user.id);
    setSettlements((prev) => [newSettlement, ...prev.filter((s) => s.id !== newSettlement.id)]);

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Settlement claim logged: ${newSettlement.amount} BDT (${newSettlement.fromUserName} -> ${newSettlement.toUserName})`,
        source: 'settlement-engine',
      },
      ...prev,
    ]);
  };

  // Route 0: 404 Not Found Page
  if (currentRoute.routeName === 'not-found') {
    return (
      <LanguageProvider lang={lang} setLang={setLang}>
        <NotFoundView
          requestedPath={currentPath}
          onNavigateHome={() => navigate(isAuthenticated || isGuestSession ? '/dashboard' : '/')}
        />
      </LanguageProvider>
    );
  }

  // Route 1: Landing Page (`currentRoute.routeName === 'landing'`)
  if (currentRoute.routeName === 'landing') {
    return (
      <LanguageProvider lang={lang} setLang={setLang}>
        <LandingPageView
          onSignInClick={() => navigate('/login')}
          onSignUpClick={() => navigate('/signup')}
          onLaunchAppClick={() => {
            if (isAuthenticated || isGuestSession) {
              navigate('/dashboard');
            } else {
              navigate('/login');
            }
          }}
        />
      </LanguageProvider>
    );
  }

  // Route 2: Sign In Page (`currentRoute.routeName === 'login' || currentRoute.routeName === 'admin-login'`)
  if (currentRoute.routeName === 'login' || currentRoute.routeName === 'admin-login') {
    return (
      <LanguageProvider lang={lang} setLang={setLang}>
        <SignInView
          registeredUsers={registeredUsers}
          onSuccess={handleAuthSuccess}
          onSuccessAuth={handleAuthSuccess}
          onSwitchToSignUp={() => navigate('/signup')}
          onNavigateToSignUp={() => navigate('/signup')}
          onForgotPassword={() => navigate('/forgot-password')}
          onNavigateToForgotPassword={() => navigate('/forgot-password')}
          onBackToHome={() => navigate('/')}
          onOpenGuestModal={() => setIsGuestModalOpen(true)}
          onContinueAsGuest={handleContinueAsGuest}
        />
      </LanguageProvider>
    );
  }

  // Route 3: Sign Up Page (`currentRoute.routeName === 'signup'`)
  if (currentRoute.routeName === 'signup') {
    return (
      <LanguageProvider lang={lang} setLang={setLang}>
        <SignUpView
          registeredUsers={registeredUsers}
          onRegister={handleRegisterUser}
          onRegisterUser={handleRegisterUser}
          onSuccess={handleAuthSuccess}
          onSuccessAuth={handleAuthSuccess}
          onSwitchToSignIn={() => navigate('/login')}
          onNavigateToSignIn={() => navigate('/login')}
          onBackToHome={() => navigate('/')}
          onContinueAsGuest={handleContinueAsGuest}
        />
      </LanguageProvider>
    );
  }

  // Route 4: Forgot Password Page (`currentRoute.routeName === 'forgot-password'`)
  if (currentRoute.routeName === 'forgot-password') {
    return (
      <LanguageProvider lang={lang} setLang={setLang}>
        <ForgotPasswordView
          registeredUsers={registeredUsers}
          onBackToSignIn={() => navigate('/login')}
          onNavigateToSignIn={() => navigate('/login')}
          onBackToHome={() => navigate('/')}
        />
      </LanguageProvider>
    );
  }

  // Route Protection: Unauthenticated users must not render workspace
  if (currentRoute.isProtected && !isAuthenticated && !isGuestSession) {
    return null;
  }

  // Route 5: Active App Workspace
  return (
    <LanguageProvider lang={lang} setLang={setLang}>
      <div className="flex h-screen w-full bg-[#09090b] text-[#fafafa] font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        user={activeUser}
        groups={userGroups}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={handleSelectGroup}
        onOpenNewGroup={() => setIsNewGroupOpen(true)}
        onOpenEditProfile={handleOpenSettings}
        onLogout={isGuestSession ? () => setIsExitGuestModalOpen(true) : handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        lang={lang}
        onLangChange={setLang}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header Bar */}
        <div className="relative">
          <Header
            onOpenNewTransaction={() => setIsNewTransactionOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            user={activeUser}
            onOpenEditProfile={handleOpenSettings}
            onLogout={isGuestSession ? () => setIsExitGuestModalOpen(true) : handleLogout}
            isMobileMenuOpen={isMobileMenuOpen}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            availableMonths={availableMonths}
            lang={lang}
            onLangChange={setLang}
            onOpenGuestModal={() => setIsGuestModalOpen(true)}
            isGuestSession={isGuestSession}
            onOpenExitGuestModal={() => setIsExitGuestModalOpen(true)}
          />

          {/* Quick Route Switches */}
          <div className="absolute top-3 right-56 hidden xl:flex items-center gap-2">
            {isGuestSession ? (
              <button
                onClick={() => setIsExitGuestModalOpen(true)}
                className="text-[11px] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium"
              >
                Exit Guest Mode
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="text-[11px] bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer"
              >
                Switch Account
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="text-[11px] bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              Landing Page
            </button>
          </div>
        </div>

        {/* View Routing */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={activeUser}
              expenses={monthFilteredDashboardExpenses}
              groups={userGroups}
              settlements={userSettlements}
              onSelectTab={handleSelectTab}
              onOpenNewTransaction={() => setIsNewTransactionOpen(true)}
              onOpenSettleUp={() => setIsSettleUpOpen(true)}
              onSaveExpense={handleSaveExpense}
              onUpdateExpenseStatus={handleUpdateExpenseStatus}
              onDeleteExpense={handleDeleteExpense}
              onEditExpense={(exp) => setEditingExpense(exp)}
              lang={lang}
            />
          )}

          {activeTab === 'personal-expenses' && (
            <PersonalExpensesView
              expenses={monthFilteredUserExpenses}
              onOpenNewTransaction={() => setIsNewTransactionOpen(true)}
              onDeleteExpense={handleDeleteExpense}
              onToggleExpenseStatus={handleToggleExpenseStatus}
              onEditExpense={(exp) => setEditingExpense(exp)}
            />
          )}

          {activeTab === 'shared-groups' && (
            <SharedGroupsView
              groups={userGroups}
              expenses={monthFilteredUserExpenses}
              allExpenses={userExpenses}
              settlements={userSettlements}
              selectedGroupId={selectedGroupId}
              setSelectedGroupId={handleSelectGroup}
              currentUser={activeUser}
              onOpenNewGroup={() => setIsNewGroupOpen(true)}
              onOpenJoinGroup={() => setIsJoinGroupOpen(true)}
              onOpenNewTransaction={() => setIsNewTransactionOpen(true)}
              onOpenSettleUp={(grpId) => {
                if (grpId) handleSelectGroup(grpId);
                setIsSettleUpOpen(true);
              }}
              onDeleteGroup={handleDeleteGroup}
              onRemoveMember={handleRemoveMember}
              onDeleteExpense={handleDeleteExpense}
              onEditExpense={(exp) => setEditingExpense(exp)}
              onAcceptSettlement={handleAcceptSettlement}
              onRejectSettlement={handleRejectSettlement}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView expenses={userExpenses} categories={CATEGORIES} />
          )}

          {activeTab === 'ai-advisor' && <AIAssistantView expenses={userExpenses} />}

          {activeTab === 'activity' && (
            <ActivityView auditLogs={auditLogs} guestVisits={guestVisits} />
          )}

          {activeTab === 'profile' && (
            <ProfileView
              user={activeUser}
              onSaveUser={handleSaveUser}
              lang={lang}
              onNavigate={navigate}
              isGuestSession={isGuestSession}
              onExitGuestMode={() => setIsExitGuestModalOpen(true)}
            />
          )}

          {activeTab === 'system-admin' && (
            <AdminView
              registeredUsers={registeredUsers}
              groups={groups}
              expenses={expenses}
              auditLogs={auditLogs}
              guestVisits={guestVisits}
              onDeleteUser={handleDeleteUser}
              onToggleUserStatus={handleToggleUserStatus}
              onChangeUserRole={handleChangeUserRole}
              onToggleUserAICopilot={handleToggleUserAICopilot}
              onAddUser={handleAddUserByAdmin}
              onRefreshUsers={(users) => setRegisteredUsers(users)}
              currentUserId={user.id}
              lang={lang}
            />
          )}
        </div>

        {/* Footer Status Bar (Desktop) */}
        <div className="hidden md:block">
          <FooterStatusBar />
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        user={activeUser}
        onOpenEditProfile={handleOpenSettings}
      />

      {/* Modals */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tab) => {
          handleSelectTab(tab);
          setIsCommandPaletteOpen(false);
        }}
        onOpenNewTransaction={() => {
          setIsCommandPaletteOpen(false);
          setIsNewTransactionOpen(true);
        }}
        onOpenNewGroup={() => {
          setIsCommandPaletteOpen(false);
          setIsNewGroupOpen(true);
        }}
        onOpenSettleUp={() => {
          setIsCommandPaletteOpen(false);
          setIsSettleUpOpen(true);
        }}
      />

      <NewTransactionModal
        isOpen={isNewTransactionOpen}
        onClose={() => setIsNewTransactionOpen(false)}
        groups={userGroups}
        currentUser={activeUser}
        defaultGroupId={selectedGroupId || undefined}
        onSave={handleSaveExpense}
        onSaveExpense={handleSaveExpense}
      />

      <NewGroupModal
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        onSave={handleSaveGroup}
        onCreateGroup={handleSaveGroup}
      />

      <JoinGroupModal
        isOpen={isJoinGroupOpen}
        onClose={() => setIsJoinGroupOpen(false)}
        onJoin={handleJoinGroupByCode}
        onJoinGroup={handleJoinGroupByCode}
      />

      <SettleUpModal
        isOpen={isSettleUpOpen}
        onClose={() => setIsSettleUpOpen(false)}
        groups={userGroups}
        currentUser={activeUser}
        defaultGroupId={selectedGroupId}
        onSettle={handleSettleUp}
        onRecordSettlement={handleSettleUp}
      />

      <EditExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        groups={userGroups}
        currentUser={activeUser}
        onSaveExpense={handleEditExpense}
        onSave={handleEditExpense}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={handleCloseSettings}
        user={activeUser}
        onSaveUser={handleSaveUser}
        onSave={handleSaveUser}
      />

        <ExitGuestModal
          isOpen={isExitGuestModalOpen}
          onClose={() => setIsExitGuestModalOpen(false)}
          onConfirmExit={handleExitGuestMode}
        />
      </div>
    </LanguageProvider>
  );
}
