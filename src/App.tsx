import React, { useState, useEffect } from 'react';
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
import { LocalRepository } from './services/localRepository';
import { generateEntityId } from './services/idGenerator';
import { syncEngine } from './services/syncEngine';
import { toPaisa, parseExactMoney, splitExactAmount } from './utils/money';

export type AppRoute = 'landing' | 'signin' | 'signup' | 'forgot-password' | 'app';

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

  // Routing State based on URL
  const getRouteFromPath = (): AppRoute => {
    const path = window.location.pathname;
    if (path === '/login') return 'signin';
    if (path === '/signup') return 'signup';
    if (path === '/forgot-password') return 'forgot-password';
    if (path === '/dashboard' || path === '/admin/dashboard' || path.startsWith('/admin')) return 'app';
    return 'landing';
  };

  const [route, setRoute] = useState<AppRoute>(getRouteFromPath);

  // Sync route changes with browser pushState
  const navigateTo = (newRoute: AppRoute, targetTab?: ActiveTab) => {
    setRoute(newRoute);
    if (targetTab) {
      setActiveTab(targetTab);
    }
    const currentPath = window.location.pathname;
    let targetPath = '/';
    if (newRoute === 'landing') targetPath = '/';
    else if (newRoute === 'signin') targetPath = '/login';
    else if (newRoute === 'signup') targetPath = '/signup';
    else if (newRoute === 'forgot-password') targetPath = '/forgot-password';
    else if (newRoute === 'app') {
      const tab = targetTab || activeTab;
      targetPath = tab === 'system-admin' ? '/admin/dashboard' : '/dashboard';
    }

    if (currentPath !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const path = window.location.pathname;
    if (path === '/admin/dashboard' || path.startsWith('/admin')) {
      return 'system-admin';
    }
    return 'dashboard';
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

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

  // Sync popstate navigation (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const currentRoute = getRouteFromPath();
      setRoute(currentRoute);
      if (window.location.pathname === '/admin/dashboard' || window.location.pathname.startsWith('/admin')) {
        if (user.systemRole === 'Admin') {
          setActiveTab('system-admin');
        }
      } else if (window.location.pathname === '/dashboard') {
        setActiveTab('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user.systemRole]);

  // Tab change handler that keeps URL in sync with admin dashboard
  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (route === 'app') {
      const targetPath = tab === 'system-admin' ? '/admin/dashboard' : '/dashboard';
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

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

  // Modals state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('tallix_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('tallix_auth', isAuthenticated ? 'true' : isGuestSession ? 'guest' : 'false');
  }, [isAuthenticated, isGuestSession]);

  useEffect(() => {
    localStorage.setItem('tallix_registered_users', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    localStorage.setItem('tallix_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('tallix_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('tallix_settlements', JSON.stringify(settlements));
  }, [settlements]);

  useEffect(() => {
    localStorage.setItem('tallix_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('tallix_guest_visits', JSON.stringify(guestVisits));
  }, [guestVisits]);

  // Offline-First IndexedDB Initializer & Remote Synchronization Subscription
  useEffect(() => {
    let isMounted = true;

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
      }
    });

    return () => {
      isMounted = false;
      unsubscribeData();
    };
  }, []);

  // Update syncEngine active user ID
  useEffect(() => {
    syncEngine.setUserId(user?.id || null);
  }, [user?.id]);

  // Data Isolation Per Logged-In User with Dynamic Real-time Balance Calculation
  const userGroups = React.useMemo(() => {
    if (!user || !user.id || !user.email) return [];
    const cleanUserEmail = user.email.toLowerCase();
    const filtered = groups.filter((g) =>
      g.members.some(
        (m) =>
          m.id === user.id ||
          (m.email && m.email.toLowerCase() === cleanUserEmail)
      )
    );
    return enrichGroupsWithBalances(filtered, expenses, settlements);
  }, [groups, expenses, settlements, user]);

  const userGroupIds = React.useMemo(() => {
    return new Set(userGroups.map((g) => g.id));
  }, [userGroups]);

  const userExpenses = React.useMemo(() => {
    if (!user || !user.id || !user.email) return [];
    const cleanUserEmail = user.email.toLowerCase();
    return expenses.filter((e) => {
      // Shared expense: only accessible if user is a member of that Squad
      if (e.isShared && e.groupId) {
        return userGroupIds.has(e.groupId);
      }
      // Personal expense: owned by user
      return (
        e.paidByUserId === user.id ||
        (e as any).createdByEmail?.toLowerCase() === cleanUserEmail
      );
    });
  }, [expenses, user, userGroupIds]);

  const userSettlements = React.useMemo(() => {
    if (!user || !user.id) return [];
    return settlements.filter(
      (s) =>
        s.fromUserId === user.id ||
        s.toUserId === user.id ||
        (s.groupId && userGroupIds.has(s.groupId))
    );
  }, [settlements, user, userGroupIds]);

  // Route Protection: Redirect unauthenticated users trying to access app dashboard
  useEffect(() => {
    if (route === 'app') {
      if (!isAuthenticated && !isGuestSession) {
        navigateTo('signin');
      }
    }
  }, [route, isAuthenticated, isGuestSession]);

  // Role Guard: Redirect non-admin users away from system-admin
  useEffect(() => {
    if (activeTab === 'system-admin' && user.systemRole !== 'Admin') {
      setActiveTab('dashboard');
      if (window.location.pathname === '/admin/dashboard' || window.location.pathname.startsWith('/admin')) {
        window.history.pushState(null, '', '/dashboard');
      }
    }
  }, [activeTab, user]);

  // Handlers
  const handleSaveUser = (updatedUser: UserProfile) => {
    setUser(updatedUser);
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

    // Automatic Role-Based Dashboard Redirection
    if (authenticatedUser.systemRole === 'Admin') {
      setActiveTab('system-admin');
      navigateTo('app', 'system-admin');
    } else {
      setActiveTab('dashboard');
      navigateTo('app', 'dashboard');
    }

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

  const handleGuestSubmit = (guestRecord: GuestVisit) => {
    setGuestVisits((prev) => [guestRecord, ...prev]);
    LocalRepository.addGuestVisit(guestRecord);
    setIsAuthenticated(false);
    setIsGuestSession(true);
    localStorage.setItem('tallix_auth', 'guest');
    setIsGuestModalOpen(false);

    // Create temporary guest user profile
    const guestUser: UserProfile = {
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

    setUser(guestUser);
    localStorage.setItem('tallix_user', JSON.stringify(guestUser));
    setActiveTab('dashboard');

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Guest visit session initiated: ${guestRecord.name} (${guestRecord.email}) [IP: ${guestRecord.ip}, ${guestRecord.country}]`,
        source: 'guest-collector',
      },
      ...prev,
    ]);

    navigateTo('app');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsGuestSession(false);
    setUser(INITIAL_USER);
    localStorage.removeItem('tallix_auth');
    localStorage.removeItem('tallix_user');

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

    navigateTo('signin');
  };

  const handleSaveExpense = (newExpenseData: Omit<Expense, 'id'>) => {
    const defaultGroup = userGroups[0];
    const targetGroupId = newExpenseData.isShared
      ? (newExpenseData.groupId || selectedGroupId || defaultGroup?.id)
      : undefined;
    const selectedGroup = groups.find((g) => g.id === targetGroupId);

    // Find if the logged in user matches a specific member ID in the group, or fallback to user.id
    const matchedPayer = selectedGroup?.members.find((m) =>
      isMemberMatch(m, user.id, user.name)
    );
    const finalPaidByUserId = matchedPayer ? matchedPayer.id : user.id;
    const finalPaidByName = matchedPayer ? matchedPayer.name : user.name;

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
      createdBy: user.id,
      createdByEmail: user.email,
      paidByUserId: finalPaidByUserId,
      paidByName: finalPaidByName,
    } as Expense;

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
          id: user.id,
          name: `${user.name} (You)`,
          email: user.email,
          role: 'Admin',
          balance: 0,
        },
      ],
    };

    LocalRepository.createGroup(createdGroup, user.id);
    setGroups((prev) => [createdGroup, ...prev]);
    setSelectedGroupId(createdGroup.id);
    setActiveTab('shared-groups');

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
    const matchedGroup = groups.find((g) => g.inviteCode?.toUpperCase() === cleanCode);

    if (!matchedGroup) {
      return { success: false, message: 'Invalid invite code. Squad not found.' };
    }

    const isAlreadyMember = matchedGroup.members.some((m) => m.id === user.id || m.email === user.email);
    if (isAlreadyMember) {
      return { success: false, message: `You are already a member of ${matchedGroup.name}.` };
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

    setSelectedGroupId(matchedGroup.id);
    setActiveTab('shared-groups');

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
    const targetGroup = groups.find((g) => g.id === groupId);
    LocalRepository.deleteGroup(groupId, user.id);
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
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
    };
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
    const matchedGroup = groups.find((g) => g.id === settlementData.groupId);
    
    // Attempt to resolve payee member from group members list
    const payeeName = settlementData.payeeName || settlementData.toUserName || 'Recipient';
    const payeeMember = matchedGroup?.members.find(
      (m) =>
        (settlementData.toUserId && m.id === settlementData.toUserId) ||
        isMemberMatch(m, undefined, payeeName)
    );

    const payerName = settlementData.payerName || settlementData.fromUserName || user.name;
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
      fromUserId: payerMember?.id || settlementData.fromUserId || user.id,
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

  // Route 1: Landing Page (`route === 'landing'`)
  if (route === 'landing') {
    return (
      <LandingPageView
        onSignInClick={() => navigateTo('signin')}
        onSignUpClick={() => navigateTo('signup')}
        onLaunchAppClick={() => {
          if (isAuthenticated || isGuestSession) {
            navigateTo('app');
          } else {
            navigateTo('signin');
          }
        }}
      />
    );
  }

  // Route 2: Sign In Page (`route === 'signin'`)
  if (route === 'signin') {
    return (
      <SignInView
        registeredUsers={registeredUsers}
        onSuccess={handleAuthSuccess}
        onSuccessAuth={handleAuthSuccess}
        onSwitchToSignUp={() => navigateTo('signup')}
        onNavigateToSignUp={() => navigateTo('signup')}
        onForgotPassword={() => navigateTo('forgot-password')}
        onNavigateToForgotPassword={() => navigateTo('forgot-password')}
        onBackToHome={() => navigateTo('landing')}
        onOpenGuestModal={() => setIsGuestModalOpen(true)}
      />
    );
  }

  // Route 3: Sign Up Page (`route === 'signup'`)
  if (route === 'signup') {
    return (
      <SignUpView
        registeredUsers={registeredUsers}
        onRegister={handleRegisterUser}
        onRegisterUser={handleRegisterUser}
        onSuccess={handleAuthSuccess}
        onSuccessAuth={handleAuthSuccess}
        onSwitchToSignIn={() => navigateTo('signin')}
        onNavigateToSignIn={() => navigateTo('signin')}
        onBackToHome={() => navigateTo('landing')}
      />
    );
  }

  // Route 4: Forgot Password Page (`route === 'forgot-password'`)
  if (route === 'forgot-password') {
    return (
      <ForgotPasswordView
        registeredUsers={registeredUsers}
        onBackToSignIn={() => navigateTo('signin')}
        onNavigateToSignIn={() => navigateTo('signin')}
        onBackToHome={() => navigateTo('landing')}
      />
    );
  }

  // Route 5: Active App Workspace (`route === 'app'`)
  return (
    <div className="flex h-screen w-full bg-[#09090b] text-[#fafafa] font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        user={user}
        groups={userGroups}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        onOpenNewGroup={() => setIsNewGroupOpen(true)}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
        onLogout={handleLogout}
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
            user={user}
            onOpenEditProfile={() => setIsEditProfileOpen(true)}
            onLogout={handleLogout}
            isMobileMenuOpen={isMobileMenuOpen}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            lang={lang}
            onLangChange={setLang}
            onOpenGuestModal={() => setIsGuestModalOpen(true)}
          />

          {/* Quick Route Switches */}
          <div className="absolute top-3 right-56 hidden xl:flex items-center gap-2">
            <button
              onClick={() => navigateTo('signin')}
              className="text-[11px] bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-[#a1a1aa] hover:text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              Switch Account
            </button>
            <button
              onClick={() => navigateTo('landing')}
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
              user={user}
              expenses={userExpenses}
              groups={userGroups}
              settlements={userSettlements}
              onSelectTab={setActiveTab}
              onOpenNewTransaction={() => setIsNewTransactionOpen(true)}
              onOpenSettleUp={() => setIsSettleUpOpen(true)}
              onSaveExpense={handleSaveExpense}
              onUpdateExpenseStatus={handleUpdateExpenseStatus}
              onDeleteExpense={handleDeleteExpense}
              lang={lang}
            />
          )}

          {activeTab === 'personal-expenses' && (
            <PersonalExpensesView
              expenses={userExpenses}
              onOpenNewTransaction={() => setIsNewTransactionOpen(true)}
              onDeleteExpense={handleDeleteExpense}
              onToggleExpenseStatus={handleToggleExpenseStatus}
            />
          )}

          {activeTab === 'shared-groups' && (
            <SharedGroupsView
              groups={userGroups}
              expenses={userExpenses}
              settlements={userSettlements}
              selectedGroupId={selectedGroupId}
              setSelectedGroupId={setSelectedGroupId}
              currentUser={user}
              onOpenNewGroup={() => setIsNewGroupOpen(true)}
              onOpenJoinGroup={() => setIsJoinGroupOpen(true)}
              onOpenNewTransaction={() => setIsNewTransactionOpen(true)}
              onOpenSettleUp={(grpId) => {
                if (grpId) setSelectedGroupId(grpId);
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

        {/* Footer Status Bar */}
        <FooterStatusBar />
      </main>

      {/* Modals */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={(tab) => {
          setActiveTab(tab);
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
        currentUser={user}
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
        currentUser={user}
        defaultGroupId={selectedGroupId}
        onSettle={handleSettleUp}
        onRecordSettlement={handleSettleUp}
      />

      <EditExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        groups={userGroups}
        onSaveExpense={handleEditExpense}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        user={user}
        onSaveUser={handleSaveUser}
        onSave={handleSaveUser}
      />
    </div>
  );
}
