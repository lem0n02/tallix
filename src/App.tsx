import React, { useState, useEffect } from 'react';
import { CategoryItem, Expense, Group, Settlement, UserProfile, AuditLog, RegisteredUser, ThemeMode, LanguageMode, GuestVisit } from './types';
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

export type AppRoute = 'landing' | 'signin' | 'signup' | 'forgot-password' | 'app';

type MockDataPayload = {
  INITIAL_USER: UserProfile;
  INITIAL_REGISTERED_USERS: RegisteredUser[];
  INITIAL_MEMBERS: Array<{ id: string; name: string; email: string; role: string; balance: number }>;
  INITIAL_GROUPS: Group[];
  INITIAL_EXPENSES: Expense[];
  INITIAL_SETTLEMENTS: Settlement[];
  CATEGORIES: Array<{ id: string; name: string; iconName: string; color: string; budgetMonthly: number; currentSpent: number }>;
  INITIAL_AUDIT_LOGS: AuditLog[];
  INITIAL_GUEST_VISITS?: GuestVisit[];
};

type AppConfig = {
  superAdminEmail: string;
  superAdminPassword: string;
};

const EMPTY_USER: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: '',
  systemRole: 'User',
  title: '',
  department: '',
  avatarGradient: 'from-blue-500 to-emerald-400',
  liquidityLimit: 0,
  currentLiquidity: 0,
  monthlyBurnRate: 0,
};

const EMPTY_CONFIG: AppConfig = {
  superAdminEmail: '',
  superAdminPassword: '',
};

const buildSuperAdminUser = (config: AppConfig): RegisteredUser | null => {
  if (!config.superAdminEmail) return null;

  return {
    id: 'usr_superadmin',
    name: 'Super Admin',
    email: config.superAdminEmail,
    password: config.superAdminPassword,
    systemRole: 'Admin',
    roleTitle: 'Super Administrator',
    department: 'Management',
    avatarGradient: 'from-amber-500 to-emerald-500',
    createdAt: '2026-01-01',
    status: 'Active',
    isVerified: true,
  };
};

const ensureSuperAdminUser = (
  users: RegisteredUser[],
  config: AppConfig
): RegisteredUser[] => {
  const superAdmin = buildSuperAdminUser(config);
  if (!superAdmin) return users;

  const existingIndex = users.findIndex(
    (user) => user.email.toLowerCase() === config.superAdminEmail.toLowerCase()
  );

  if (existingIndex >= 0) {
    const nextUsers = [...users];
    nextUsers[existingIndex] = {
      ...nextUsers[existingIndex],
      password: config.superAdminPassword,
      systemRole: 'Admin',
      roleTitle: nextUsers[existingIndex].roleTitle || 'Super Administrator',
      department: nextUsers[existingIndex].department || 'Management',
      avatarGradient: nextUsers[existingIndex].avatarGradient || 'from-amber-500 to-emerald-500',
      status: nextUsers[existingIndex].status || 'Active',
    };
    return nextUsers;
  }

  return [superAdmin, ...users];
};

const sanitizeExpenses = (rawExpenses: Expense[]): Expense[] => {
  return rawExpenses.map((exp) => {
    const cleanAmount = Math.round((exp.amount || 0) * 100) / 100;
    if (!exp.isShared || !exp.splits || exp.splits.length === 0) {
      return { ...exp, amount: cleanAmount };
    }
    const splitsSum = Math.round(exp.splits.reduce((s, sp) => s + sp.amount, 0) * 100) / 100;
    if (Math.abs(splitsSum - cleanAmount) > 0.001) {
      const count = exp.splits.length;
      const baseShare = Math.floor((cleanAmount / count) * 100) / 100;
      let remainderCents = Math.round((cleanAmount - (baseShare * count)) * 100);
      const fixedSplits = exp.splits.map((sp) => {
        let memberShare = baseShare;
        if (remainderCents > 0) {
          memberShare = Math.round((memberShare + 0.01) * 100) / 100;
          remainderCents--;
        }
        return { ...sp, amount: memberShare };
      });
      return { ...exp, amount: cleanAmount, splits: fixedSplits };
    }
    return { ...exp, amount: cleanAmount };
  });
};

export default function App() {
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>(EMPTY_CONFIG);

  // Theme & Language Global State
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('tallix_theme');
    return (saved as ThemeMode) || 'dark';
  });

  const [lang, setLang] = useState<LanguageMode>(() => {
    const saved = localStorage.getItem('tallix_lang');
    return (saved as LanguageMode) || 'en';
  });

  // Apply theme to html element
  useEffect(() => {
    localStorage.setItem('tallix_theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else if (theme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      // System mode check
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.remove('light', 'dark');
      root.classList.add(systemDark ? 'dark' : 'light');
    }
  }, [theme]);

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
    if (path === '/dashboard') return 'app';
    return 'landing';
  };

  const [route, setRoute] = useState<AppRoute>(getRouteFromPath);

  // Sync route changes with browser pushState
  const navigateTo = (newRoute: AppRoute) => {
    setRoute(newRoute);
    const currentPath = window.location.pathname;
    let targetPath = '/';
    if (newRoute === 'landing') targetPath = '/';
    else if (newRoute === 'signin') targetPath = '/login';
    else if (newRoute === 'signup') targetPath = '/signup';
    else if (newRoute === 'forgot-password') targetPath = '/forgot-password';
    else if (newRoute === 'app') targetPath = '/dashboard';

    if (currentPath !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  // Sync popstate navigation (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRouteFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
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
    return saved ? JSON.parse(saved) : EMPTY_USER;
  });

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>(() => {
    const saved = localStorage.getItem('tallix_registered_users');
    return saved ? JSON.parse(saved) : [];
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('tallix_expenses');
    const parsed = saved ? JSON.parse(saved) : [];
    return sanitizeExpenses(parsed);
  });

  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('tallix_groups');
    return saved ? JSON.parse(saved) : [];
  });

  const [settlements, setSettlements] = useState<Settlement[]>(() => {
    const saved = localStorage.getItem('tallix_settlements');
    return saved ? JSON.parse(saved) : [];
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('tallix_audit_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [guestVisits, setGuestVisits] = useState<GuestVisit[]>(() => {
    const saved = localStorage.getItem('tallix_guest_visits');
    return saved ? JSON.parse(saved) : [];
  });

  const [categories, setCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadSeedData = async () => {
      try {
        const [dataResponse, configResponse] = await Promise.all([
          fetch('/api/mock-data'),
          fetch('/api/config'),
        ]);

        if (!dataResponse.ok) {
          throw new Error(`Failed to load mock data (${dataResponse.status})`);
        }

        if (!configResponse.ok) {
          throw new Error(`Failed to load config (${configResponse.status})`);
        }

        const data: MockDataPayload = await dataResponse.json();
        const config: AppConfig = await configResponse.json();

        if (cancelled) return;

        setAppConfig(config);

        if (!localStorage.getItem('tallix_user')) setUser(data.INITIAL_USER);
        const savedRegisteredUsers = localStorage.getItem('tallix_registered_users');
        const initialRegisteredUsers = savedRegisteredUsers ? JSON.parse(savedRegisteredUsers) : data.INITIAL_REGISTERED_USERS;
        setRegisteredUsers(ensureSuperAdminUser(initialRegisteredUsers, config));
        if (!localStorage.getItem('tallix_expenses')) setExpenses(sanitizeExpenses(data.INITIAL_EXPENSES));
        if (!localStorage.getItem('tallix_groups')) setGroups(data.INITIAL_GROUPS);
        if (!localStorage.getItem('tallix_settlements')) setSettlements(data.INITIAL_SETTLEMENTS);
        if (!localStorage.getItem('tallix_audit_logs')) setAuditLogs(data.INITIAL_AUDIT_LOGS);
        if (!localStorage.getItem('tallix_guest_visits') && data.INITIAL_GUEST_VISITS) setGuestVisits(data.INITIAL_GUEST_VISITS);
        setCategories(data.CATEGORIES);
      } catch (error) {
        console.error('Failed to bootstrap Tallix mock data:', error);
      } finally {
        if (!cancelled) setIsDataLoaded(true);
      }
    };

    loadSeedData();

    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!isDataLoaded) return;
    localStorage.setItem('tallix_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem('tallix_auth', isAuthenticated ? 'true' : isGuestSession ? 'guest' : 'false');
  }, [isAuthenticated, isGuestSession]);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem('tallix_registered_users', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem('tallix_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem('tallix_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem('tallix_settlements', JSON.stringify(settlements));
  }, [settlements]);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem('tallix_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    if (!isDataLoaded) return;
    localStorage.setItem('tallix_guest_visits', JSON.stringify(guestVisits));
  }, [guestVisits]);

  useEffect(() => {
    if (!isDataLoaded) return;

    const syncTimer = window.setTimeout(() => {
      const payload: MockDataPayload = {
        INITIAL_USER: user,
        INITIAL_REGISTERED_USERS: registeredUsers,
        INITIAL_MEMBERS: groups[0]?.members ?? [],
        INITIAL_GROUPS: groups,
        INITIAL_EXPENSES: expenses,
        INITIAL_SETTLEMENTS: settlements,
        CATEGORIES: categories,
        INITIAL_AUDIT_LOGS: auditLogs,
        INITIAL_GUEST_VISITS: guestVisits,
      };

      fetch('/api/mock-data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }).catch((error) => {
        console.error('Failed to persist Tallix mock data:', error);
      });
    }, 250);

    return () => window.clearTimeout(syncTimer);
  }, [isDataLoaded, user, registeredUsers, groups, expenses, settlements, categories, auditLogs, guestVisits]);

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
    if (!isDataLoaded) return;
    if (route === 'app') {
      if (!isAuthenticated && !isGuestSession) {
        navigateTo('signin');
      }
    }
  }, [route, isAuthenticated, isGuestSession, isDataLoaded]);

  // Role Guard: Redirect non-admin users away from system-admin
  useEffect(() => {
    if (!isDataLoaded) return;
    if (activeTab === 'system-admin' && user.systemRole !== 'Admin') {
      setActiveTab('dashboard');
    }
  }, [activeTab, user, isDataLoaded]);

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
    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextStatus = u.status === 'Active' ? 'Disabled' : 'Active';
          return { ...u, status: nextStatus };
        }
        return u;
      })
    );
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
    setRegisteredUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, systemRole: newRole } : u))
    );
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
    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const nextVal = u.aiCopilotEnabled === false ? true : false;
          return { ...u, aiCopilotEnabled: nextVal };
        }
        return u;
      })
    );
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

    // Automatic Role-Based Dashboard Redirection
    if (authenticatedUser.systemRole === 'Admin') {
      setActiveTab('system-admin');
    } else {
      setActiveTab('dashboard');
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

    navigateTo('app');
  };

  const handleGuestSubmit = (guestRecord: GuestVisit) => {
    setGuestVisits((prev) => [guestRecord, ...prev]);
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

    const createdExpense: Expense = {
      id: `exp_${Date.now()}`,
      ...newExpenseData,
      isShared: !!newExpenseData.isShared,
      groupId: targetGroupId,
      groupName: newExpenseData.isShared ? (selectedGroup?.name || newExpenseData.groupName) : undefined,
      createdBy: user.id,
      createdByEmail: user.email,
      paidByUserId: finalPaidByUserId,
      paidByName: finalPaidByName,
    } as Expense;

    setExpenses((prev) => [createdExpense, ...prev]);

    if (createdExpense.isShared && createdExpense.groupId) {
      setGroups((prevGroups) =>
        prevGroups.map((g) => {
          if (g.id === createdExpense.groupId) {
            return {
              ...g,
              totalSpent: g.totalSpent + createdExpense.amount,
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
        message: `New expense logged: "${createdExpense.title}" (৳${createdExpense.amount})`,
        source: 'expense-ledger',
      },
      ...prev,
    ]);
  };

  const handleUpdateExpenseStatus = (id: string, status: 'Pending' | 'Flagged' | 'Settled') => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status } : e))
    );
  };

  const handleToggleExpenseStatus = (id: string) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status: e.status === 'Settled' ? 'Pending' : 'Settled' } : e
      )
    );
  };

  const handleDeleteExpense = (id: string) => {
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
      id: `grp_${Date.now()}`,
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

    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === matchedGroup.id) {
          return {
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
        }
        return g;
      })
    );

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
    setGroups((prev) =>
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
  };

  const handleEditExpense = (updatedExpense: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updatedExpense.id ? updatedExpense : e)));
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Expense updated: "${updatedExpense.title}" (৳${updatedExpense.amount})`,
        source: 'expense-ledger',
      },
      ...prev,
    ]);
  };

  const handleAcceptSettlement = (settlementId: string) => {
    setSettlements((prev) =>
      prev.map((s) => (s.id === settlementId ? { ...s, status: 'Accepted' } : s))
    );
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
    setSettlements((prev) =>
      prev.map((s) => (s.id === settlementId ? { ...s, status: 'Rejected' } : s))
    );
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

    const newSettlement: Settlement = {
      id: settlementData.id || `stl_${Date.now()}`,
      groupId: settlementData.groupId || matchedGroup?.id || '',
      groupName: matchedGroup?.name || settlementData.groupName || 'Shared Squad',
      fromUserId: payerMember?.id || settlementData.fromUserId || user.id,
      fromUserName: payerMember?.name || payerName,
      toUserId: payeeMember?.id || settlementData.toUserId || `user_payee_${Date.now()}`,
      toUserName: payeeMember?.name || payeeName,
      amount: Number(settlementData.amount),
      currency: settlementData.currency || matchedGroup?.currency || 'BDT',
      paymentMethod: settlementData.paymentMethod || 'bKash',
      status: settlementData.status || 'Pending',
      createdAt: settlementData.createdAt || new Date().toISOString().split('T')[0],
      proofUrl: settlementData.proofUrl,
      note: settlementData.note,
    };

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

  if (!isDataLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#09090b] text-[#fafafa]">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
          <p className="text-sm text-[#a1a1aa]">Loading Tallix seed data...</p>
        </div>
      </div>
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
        setActiveTab={setActiveTab}
        user={user}
        groups={userGroups}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        onOpenNewGroup={() => setIsNewGroupOpen(true)}
        onOpenEditProfile={() => setIsEditProfileOpen(true)}
        onLogout={handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
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
            theme={theme}
            onThemeChange={setTheme}
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
            <AnalyticsView expenses={userExpenses} categories={categories} />
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
              currentUserId={user.id}
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
        expenses={userExpenses}
        groups={userGroups}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsCommandPaletteOpen(false);
        }}
        onSelectGroup={(groupId) => {
          setSelectedGroupId(groupId);
          setActiveTab('shared-groups');
          setIsCommandPaletteOpen(false);
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
