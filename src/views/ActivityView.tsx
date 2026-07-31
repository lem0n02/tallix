import React, { useState } from 'react';
import {
  Activity,
  LogIn,
  LogOut,
  UserCheck,
  Globe,
  Search,
  Monitor,
  Smartphone,
  Cpu,
  Clock,
  Shield,
  Filter,
  Users
} from 'lucide-react';
import { AuditLog, GuestVisit } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface ActivityViewProps {
  auditLogs: AuditLog[];
  guestVisits: GuestVisit[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  auditLogs,
  guestVisits,
}) => {
  const [subTab, setSubTab] = useState<'all' | 'login' | 'logout' | 'account' | 'guest'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { t, formatDate } = useLanguage();

  // Filter logs by tab & search term
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.userEmail && log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (subTab === 'login') {
      return log.type === 'LOGIN' || log.message.toLowerCase().includes('login') || log.message.toLowerCase().includes('authenticated');
    }
    if (subTab === 'logout') {
      return log.type === 'LOGOUT' || log.message.toLowerCase().includes('logout') || log.message.toLowerCase().includes('logged out');
    }
    if (subTab === 'account') {
      return log.type === 'ACTIVITY' || (!log.message.toLowerCase().includes('login') && !log.message.toLowerCase().includes('logout'));
    }
    return true;
  });

  const filteredGuestVisits = guestVisits.filter((visit) => {
    return (
      visit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.browser.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      return date.toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090b] text-[#fafafa] overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272a] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-blue-500" />
            <span>{t('activityTitle')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1">
            {t('activitySubtitle')}
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#71717a]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchActivityPlaceholder')}
            className="w-full bg-[#18181b] border border-[#27272a] focus:border-blue-500 text-white rounded-lg pl-9 pr-3 py-2 text-xs outline-none transition-colors"
          />
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#27272a] pb-3">
        <button
          onClick={() => setSubTab('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'all'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>All History ({auditLogs.length + guestVisits.length})</span>
        </button>

        <button
          onClick={() => setSubTab('login')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'login'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
          }`}
        >
          <LogIn className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('loginHistory')}</span>
        </button>

        <button
          onClick={() => setSubTab('logout')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'logout'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
          }`}
        >
          <LogOut className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('logoutHistory')}</span>
        </button>

        <button
          onClick={() => setSubTab('account')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'account'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>{t('accountActivity')}</span>
        </button>

        <button
          onClick={() => setSubTab('guest')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            subTab === 'guest'
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border border-[#27272a]'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-teal-400" />
          <span>{t('guestVisits')} ({guestVisits.length})</span>
        </button>
      </div>

      {/* Guest Visits Detailed Table / Cards */}
      {(subTab === 'all' || subTab === 'guest') && filteredGuestVisits.length > 0 && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-400" />
              <span>{t('guestVisits')} Logs</span>
            </h3>
            <span className="text-xs text-teal-400 font-mono bg-teal-500/10 border border-teal-500/20 px-2.5 py-0.5 rounded-full">
              {filteredGuestVisits.length} Records Saved
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#27272a] text-[11px] uppercase tracking-wider text-[#71717a]">
                  <th className="py-2.5 px-3">Visitor Name & Email</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Browser / Device</th>
                  <th className="py-2.5 px-3 text-right">Visit Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a] text-xs">
                {filteredGuestVisits.map((v) => (
                  <tr key={v.id} className="hover:bg-[#27272a]/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-white">{v.name}</div>
                      <div className="text-[11px] text-[#a1a1aa]">{v.email}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-blue-400 font-medium">
                      {v.ip}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 bg-[#09090b] border border-[#27272a] px-2 py-0.5 rounded text-[11px] text-[#fafafa]">
                        <Globe className="w-3 h-3 text-emerald-400" />
                        {v.country}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-[#a1a1aa]">
                        <Monitor className="w-3.5 h-3.5 text-purple-400" />
                        <span>{v.browser}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#71717a]">
                        <span>{v.os}</span> • <span className="text-amber-400">{v.deviceType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-[#a1a1aa] font-mono text-[11px]">
                      {formatTimestamp(v.visitTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Activity Timeline Feed */}
      {subTab !== 'guest' && (
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>System & User Event Logs</span>
            </h3>
            <span className="text-xs text-[#a1a1aa] font-mono">
              {filteredAuditLogs.length} Events
            </span>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#71717a]">
              {t('noLogsFound')}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAuditLogs.map((log) => {
                const isLogin = log.message.toLowerCase().includes('login') || log.type === 'LOGIN';
                const isLogout = log.message.toLowerCase().includes('logout') || log.type === 'LOGOUT';
                
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3.5 rounded-lg bg-[#09090b] border border-[#27272a] hover:border-[#3f3f46] transition-colors"
                  >
                    <div className="mt-0.5 p-2 rounded-lg bg-[#18181b] border border-[#27272a] shrink-0">
                      {isLogin ? (
                        <LogIn className="w-4 h-4 text-emerald-400" />
                      ) : isLogout ? (
                        <LogOut className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Activity className="w-4 h-4 text-blue-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {log.message}
                        </span>
                        <span className="text-[10px] text-[#71717a] font-mono shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#52525b]" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#71717a]">
                        <span className="bg-[#18181b] border border-[#27272a] px-2 py-0.5 rounded font-mono text-[#a1a1aa]">
                          src: {log.source}
                        </span>
                        {log.level && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.level === 'WARN'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : log.level === 'ERROR'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {log.level}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
