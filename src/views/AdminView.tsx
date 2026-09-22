import React, { useState } from 'react';
import {
  Users,
  FolderGit2,
  Receipt,
  Search,
  Trash2,
  UserPlus,
  ShieldCheck,
  X,
  Terminal,
  AlertTriangle,
  Play,
  Pause,
  Lock,
  UserCheck,
  UserX,
  Shield,
  Activity,
  CheckCircle2,
  Ban,
  Sparkles,
  Globe,
  Monitor,
  Smartphone,
  Cpu,
  Clock,
  RefreshCw,
  Database
} from 'lucide-react';
import { RegisteredUser, Group, Expense, AuditLog, GuestVisit } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { fetchAdminUsersFromD1, registerUserToCloudflareD1 } from '../services/authService';

interface AdminViewProps {
  registeredUsers: RegisteredUser[];
  groups: Group[];
  expenses: Expense[];
  auditLogs: AuditLog[];
  guestVisits?: GuestVisit[];
  onDeleteUser: (userId: string) => void;
  onToggleUserStatus: (userId: string) => void;
  onChangeUserRole: (userId: string, newRole: 'Admin' | 'User') => void;
  onToggleUserAICopilot?: (userId: string) => void;
  onAddUser: (user: RegisteredUser) => void;
  onRefreshUsers?: (users: RegisteredUser[]) => void;
  currentUserId: string;
}

export const ADMIN_AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour (3,600,000 ms)

export const AdminView: React.FC<AdminViewProps> = ({
  registeredUsers,
  groups,
  expenses,
  auditLogs,
  guestVisits = [],
  onDeleteUser,
  onToggleUserStatus,
  onChangeUserRole,
  onToggleUserAICopilot,
  onAddUser,
  onRefreshUsers,
  currentUserId,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'guests' | 'squads' | 'logs'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Admin' | 'User'>('All');
  const [userToDelete, setUserToDelete] = useState<RegisteredUser | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);

  // Authoritative D1 Users state
  const [d1Users, setD1Users] = useState<RegisteredUser[]>(registeredUsers);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Timestamp of the most recent fetch to prevent duplicate/premature requests
  const lastFetchTimeRef = React.useRef<number>(0);
  const onRefreshUsersRef = React.useRef(onRefreshUsers);

  React.useEffect(() => {
    onRefreshUsersRef.current = onRefreshUsers;
  }, [onRefreshUsers]);

  // Synchronize with incoming prop when prop changes
  React.useEffect(() => {
    if (registeredUsers && registeredUsers.length > 0) {
      setD1Users(registeredUsers);
    }
  }, [registeredUsers]);

  // Load authoritative users from Cloudflare D1
  const loadAuthoritativeUsers = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const fetched = await fetchAdminUsersFromD1();
      if (Array.isArray(fetched) && fetched.length > 0) {
        setD1Users(fetched);
        if (onRefreshUsersRef.current) {
          onRefreshUsersRef.current(fetched);
        }
      }
      setLastRefreshedAt(new Date());
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      console.warn('[AdminView] Failed to retrieve authoritative users from D1:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Managed single 1-hour lifecycle timer:
  // 1. Exactly ONE initial D1 fetch on mount
  // 2. Maximum ONE automatic refresh per hour
  // 3. Single interval timer, cleanly cleared on unmount
  // 4. Tab visibility guard (no polling while hidden; checks elapsed time when returning)
  React.useEffect(() => {
    // 1. Initial D1 fetch on mount
    loadAuthoritativeUsers();

    // 2. Single 1-hour timer for automatic refresh
    const hourlyTimerId = setInterval(() => {
      // Do not run background requests if tab is hidden
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      loadAuthoritativeUsers();
    }, ADMIN_AUTO_REFRESH_INTERVAL_MS);

    // 3. Tab visibility handler: on returning, if 1-hour interval has elapsed since last fetch, refresh at most once
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastFetchTimeRef.current;
        if (elapsed >= ADMIN_AUTO_REFRESH_INTERVAL_MS) {
          loadAuthoritativeUsers();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // 4. Clean up single timer and listener when unmounting
    return () => {
      clearInterval(hourlyTimerId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [loadAuthoritativeUsers]);

  const { t, formatNumber, formatDate } = useLanguage();

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'User' | 'Admin'>('User');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Metrics (Authoritative from D1 / Cached)
  const totalUsersCount = d1Users.length;
  const activeUsersCount = d1Users.filter((u) => u.status === 'Active').length;
  const disabledUsersCount = d1Users.filter((u) => u.status === 'Disabled').length;
  const totalSquadsCount = groups.length;
  const totalSystemTransactionsCount = expenses.length;
  const totalGuestsCount = guestVisits.length;

  // Filtered Users
  const filteredUsers = d1Users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    if (roleFilter === 'All') return matchesSearch;
    return matchesSearch && u.systemRole === roleFilter;
  });

  // Filtered Guest Visits
  const filteredGuests = guestVisits.filter((g) => {
    return (
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.country.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setFormError('Please fill in both Full Name and Email');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(newUserEmail.trim())) {
      setFormError('Please enter a valid email address');
      return;
    }

    if (d1Users.some((u) => u.email.toLowerCase() === newUserEmail.trim().toLowerCase())) {
      setFormError('An account with this email address already exists');
      return;
    }

    setIsSubmittingUser(true);
    setFormError(null);

    const generatedId = `usr_admin_created_${Date.now()}`;

    registerUserToCloudflareD1({
      id: generatedId,
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      password: newUserPassword || undefined,
      systemRole: newUserRole,
      status: 'Active',
    })
      .then((res) => {
        setIsSubmittingUser(false);
        onAddUser(res.user);
        setD1Users((prev) => [res.user, ...prev.filter((u) => u.id !== res.user.id)]);
        setIsAddUserModalOpen(false);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setFormError(null);
      })
      .catch((err) => {
        setIsSubmittingUser(false);
        setFormError(err?.message || 'Failed to create user in Cloudflare D1.');
      });
  };

  const confirmDelete = () => {
    if (userToDelete) {
      onDeleteUser(userToDelete.id);
      setUserToDelete(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar bg-[#09090b] text-[#fafafa]">
      {/* Privacy Guarantee Header Banner */}
      <div className="bg-linear-to-r from-blue-950/40 via-[#18181b] to-emerald-950/30 border border-blue-500/20 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-[#fafafa] tracking-tight flex items-center gap-2">
                <span>{t('adminDashboardTitle')}</span>
              </h1>
              <span className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Privacy Protected
              </span>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed max-w-3xl">
              Super Admin panel with strict <strong className="text-emerald-400 font-semibold">zero financial exposure</strong>. Full control over registered accounts, guest visitors telemetry, AI Copilot access, and security audit logs.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddUserModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Overview High-Level System Metrics */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#71717a] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" /> High-Level System Metrics
          </h2>
          <span className="text-[10px] text-[#52525b] font-mono">System Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Registered Users */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 space-y-2 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717a]">{t('registeredUsers')}</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#fafafa] font-mono">{totalUsersCount}</span>
              <span className="text-[11px] text-[#a1a1aa]">Accounts</span>
            </div>
            <p className="text-[10px] text-[#71717a]">{activeUsersCount} Active • {disabledUsersCount} Disabled</p>
          </div>

          {/* Guest Visits */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 space-y-2 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717a]">{t('guestVisits')}</span>
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Globe className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-teal-400 font-mono">{totalGuestsCount}</span>
              <span className="text-[11px] text-[#a1a1aa]">Guest Sessions</span>
            </div>
            <p className="text-[10px] text-[#71717a]">Auto Telemetry Captured</p>
          </div>

          {/* Total Squads */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 space-y-2 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717a]">Total Squads</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <FolderGit2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#fafafa] font-mono">{totalSquadsCount}</span>
              <span className="text-[11px] text-[#a1a1aa]">Groups</span>
            </div>
            <p className="text-[10px] text-[#71717a]">Shared group spaces</p>
          </div>

          {/* Total Transactions (Count only) */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-4 space-y-2 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#71717a]">Total Transactions</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-[#fafafa] font-mono">{totalSystemTransactionsCount}</span>
              <span className="text-[11px] text-[#a1a1aa]">Logged Receipts</span>
            </div>
            <p className="text-[10px] text-amber-400/90 font-medium">Count only • Privacy safe</p>
          </div>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#27272a] pb-3">
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${activeAdminTab === 'users'
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
            }`}
        >
          <Users className="w-4 h-4" />
          <span>Registered Users ({d1Users.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('guests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${activeAdminTab === 'guests'
            ? 'bg-teal-600 text-white shadow-md'
            : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
            }`}
        >
          <Globe className="w-4 h-4" />
          <span>{t('guestVisits')} ({guestVisits.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('squads')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${activeAdminTab === 'squads'
            ? 'bg-purple-600 text-white shadow-md'
            : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
            }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>Squad Spaces ({groups.length})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${activeAdminTab === 'logs'
            ? 'bg-emerald-600 text-white shadow-md'
            : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
            }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Security Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: REGISTERED USERS MANAGEMENT */}
      {activeAdminTab === 'users' && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#fafafa] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" /> User Access & AI Copilot Control
                </h2>
                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Database className="w-3 h-3 text-blue-400" /> Authoritative: Cloudflare D1
                </span>
                {lastRefreshedAt && (
                  <span className="text-[10px] text-[#71717a] hidden md:inline">
                    Synced {lastRefreshedAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#71717a] mt-0.5">
                Authoritative user registry from Cloudflare D1. Manage system roles, enable/disable status, and AI access.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Refresh D1 Users Button */}
              <button
                type="button"
                onClick={() => loadAuthoritativeUsers()}
                disabled={isRefreshing}
                title="Fetch latest registered users from Cloudflare D1"
                className="bg-[#09090b] hover:bg-[#27272a] text-[#fafafa] border border-[#27272a] rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-[11px] font-medium hidden sm:inline">Refresh D1</span>
              </button>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#71717a]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name or email..."
                  className="bg-[#09090b] border border-[#27272a] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-emerald-500 w-40 sm:w-56"
                />
              </div>

              {/* Role Filter */}
              <div className="flex bg-[#09090b] border border-[#27272a] rounded-xl p-0.5 text-xs">
                {(['All', 'Admin', 'User'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${roleFilter === r
                      ? 'bg-[#27272a] text-[#fafafa] shadow-sm'
                      : 'text-[#71717a] hover:text-[#fafafa]'
                      }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* User Access Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-190">
              <thead>
                <tr className="border-b border-[#27272a] text-[10px] uppercase tracking-wider font-bold text-[#71717a]">
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">AI Copilot</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Super Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/50 text-xs">
                {filteredUsers.map((u) => {
                  const isCurrentUser = u.id === currentUserId;
                  const isAdmin = u.systemRole === 'Admin';
                  const isActive = u.status === 'Active';
                  const isAiEnabled = u.aiCopilotEnabled !== false;

                  return (
                    <tr key={u.id} className="hover:bg-[#27272a]/30 transition-colors">
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-[#fafafa]">
                        <div className="flex items-center gap-2">
                          <span>{u.name}</span>
                          {isCurrentUser && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-mono font-medium">
                              You
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 font-mono text-[#e4e4e7] text-[11px]">
                        {u.email}
                      </td>

                      {/* System Role */}
                      <td className="py-3.5 px-4">
                        {isCurrentUser ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-tight uppercase border bg-blue-500/10 text-blue-400 border-blue-500/30">
                            <ShieldCheck className="w-3 h-3" /> Admin
                          </span>
                        ) : (
                          <select
                            value={u.systemRole}
                            onChange={(e) => onChangeUserRole(u.id, e.target.value as 'Admin' | 'User')}
                            className={`bg-[#09090b] border px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider focus:outline-none cursor-pointer transition-all ${isAdmin
                              ? 'text-blue-400 border-blue-500/30 focus:border-blue-500'
                              : 'text-emerald-400 border-emerald-500/30 focus:border-emerald-500'
                              }`}
                          >
                            <option value="User">User</option>
                            <option value="Admin">Admin</option>
                          </select>
                        )}
                      </td>

                      {/* AI Copilot Access Switcher */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => onToggleUserAICopilot && onToggleUserAICopilot(u.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${isAiEnabled
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                            : 'bg-zinc-800 text-[#71717a] border-zinc-700 hover:text-white'
                            }`}
                          title="Toggle AI Copilot Access for this user"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isAiEnabled ? 'text-blue-400' : 'text-zinc-500'}`} />
                          <span>{isAiEnabled ? 'Enabled' : 'Disabled'}</span>
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                              }`}
                          />
                          <span>{u.status}</span>
                        </span>
                      </td>

                      {/* Admin Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isCurrentUser ? (
                          <span className="text-[10px] text-[#52525b] italic">Active Session</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {/* Enable/Disable Toggle */}
                            <button
                              onClick={() => onToggleUserStatus(u.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer border ${isActive
                                ? 'bg-[#09090b] hover:bg-amber-500/10 text-amber-400 border-[#27272a] hover:border-amber-500/40'
                                : 'bg-[#09090b] hover:bg-emerald-500/10 text-emerald-400 border-[#27272a] hover:border-emerald-500/40'
                                }`}
                              title={isActive ? 'Disable User Account' : 'Enable User Account'}
                            >
                              {isActive ? (
                                <>
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Disable</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Enable</span>
                                </>
                              )}
                            </button>

                            {/* Delete Account */}
                            <button
                              onClick={() => setUserToDelete(u)}
                              className="px-2.5 py-1 bg-[#09090b] hover:bg-red-500/10 border border-[#27272a] hover:border-red-500/40 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title="Delete user account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#71717a]">
                      No users found matching &quot;{searchTerm}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GUEST VISITS TELEMETRY */}
      {activeAdminTab === 'guests' && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#fafafa] flex items-center gap-2">
                <Globe className="w-4 h-4 text-teal-400" />
                <span>Guest Visitor Sessions Telemetry</span>
              </h2>
              <p className="text-xs text-[#71717a]">
                Auto-collected guest details for Super Admin review
              </p>
            </div>
            <span className="text-xs font-mono bg-teal-500/10 border border-teal-500/30 text-teal-400 px-3 py-1 rounded-full">
              {guestVisits.length} Guests Recorded
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-180">
              <thead>
                <tr className="border-b border-[#27272a] text-[10px] uppercase tracking-wider font-bold text-[#71717a]">
                  <th className="py-3 px-4">Visitor Name & Email</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Browser & OS</th>
                  <th className="py-3 px-4">Device</th>
                  <th className="py-3 px-4 text-right">Visit Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]/50 text-xs">
                {filteredGuests.map((g) => (
                  <tr key={g.id} className="hover:bg-[#27272a]/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{g.name}</div>
                      <div className="text-[11px] text-[#a1a1aa] font-mono">{g.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-400 font-bold">
                      {g.ip}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 bg-[#09090b] border border-[#27272a] px-2.5 py-1 rounded text-xs text-[#fafafa]">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        {g.country}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-purple-300">
                        <Monitor className="w-3.5 h-3.5 text-purple-400" />
                        <span>{g.browser}</span>
                      </div>
                      <div className="text-[10px] text-[#71717a]">{g.os}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        {g.deviceType === 'Mobile' ? <Smartphone className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
                        {g.deviceType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-[#a1a1aa] font-mono text-[11px]">
                      {g.visitTime ? new Date(g.visitTime).toLocaleString() : 'Just Now'}
                    </td>
                  </tr>
                ))}

                {filteredGuests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#71717a]">
                      No guest visits recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SQUAD SPACES OVERVIEW */}
      {activeAdminTab === 'squads' && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="border-b border-[#27272a] pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#fafafa] flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-purple-400" /> Active Squad Spaces
              </h2>
              <p className="text-[11px] text-[#71717a]">Platform shared squads (Metadata & membership count)</p>
            </div>
            <span className="text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
              {groups.length} Squads
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {groups.map((g) => (
              <div
                key={g.id}
                className="p-4 bg-[#09090b] border border-[#27272a] rounded-xl flex items-center justify-between text-xs hover:border-[#3f3f46] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full bg-linear-to-tr ${g.avatarGradient || 'from-blue-500 to-indigo-500'}`} />
                  <div>
                    <p className="font-bold text-[#fafafa] text-sm">{g.name}</p>
                    <p className="text-[11px] text-[#71717a] mt-0.5">
                      Category: {g.category} • Created: {g.createdAt || '2026-01-10'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-400 text-xs">{g.members.length} Members</p>
                  <p className="text-[10px] text-[#71717a] font-mono mt-0.5">Invite Code: {g.inviteCode}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM AUDIT LOGS */}
      {activeAdminTab === 'logs' && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex justify-between items-center border-b border-[#27272a] pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#fafafa]">
                  System Audit Event Logs
                </h2>
                <p className="text-[11px] text-[#71717a]">Real-time authentication and system telemetry events</p>
              </div>
            </div>
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 border cursor-pointer ${isStreaming
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-[#09090b] text-[#71717a] border-[#27272a]'
                }`}
            >
              {isStreaming ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isStreaming ? 'Streaming' : 'Paused'}</span>
            </button>
          </div>

          <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-3 font-mono text-xs max-h-96 overflow-y-auto custom-scrollbar space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-[11px] border-b border-[#27272a]/40 pb-1.5">
                <span className="text-[#71717a] shrink-0 text-[10px]">
                  {log.timestamp.includes('T') ? log.timestamp.split('T')[1]?.substring(0, 8) : log.timestamp}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${log.level === 'INFO'
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : log.level === 'WARN'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                >
                  {log.level || 'INFO'}
                </span>
                <span className="text-[#a1a1aa] shrink-0 font-mono text-[10px] bg-[#18181b] px-1 rounded border border-[#27272a]">
                  [{log.source}]
                </span>
                <span className="text-white flex-1">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#18181b] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 border-b border-[#27272a] pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold">Confirm Account Deletion</h3>
                <p className="text-xs text-[#a1a1aa]">Super Admin Action</p>
              </div>
            </div>

            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email})? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#27272a]">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-[#a1a1aa] hover:text-white bg-[#09090b] border border-[#27272a] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl cursor-pointer shadow-lg shadow-red-600/30"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#18181b] border border-[#27272a] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setIsAddUserModalOpen(false)}
              className="absolute top-4 right-4 text-[#71717a] hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="border-b border-[#27272a] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>Add New User Account</span>
              </h3>
              <p className="text-xs text-[#71717a]">Provision credentials for a new user</p>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-3">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-lg text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. sarah@example.com"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">Temporary Password</label>
                <input
                  type="text"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#a1a1aa] mb-1">System Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'User' | 'Admin')}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#a1a1aa] hover:text-white bg-[#09090b] border border-[#27272a] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 rounded-xl cursor-pointer shadow-lg shadow-emerald-400/20"
                >
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
