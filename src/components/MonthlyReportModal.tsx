import React from 'react';
import { X, Download, FileText, Calendar, DollarSign, Scale, ArrowUpRight, ArrowDownRight, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { Expense, Settlement, UserProfile } from '../types';
import { buildMonthlyReportData, downloadMonthlyPdf } from '../utils/pdfReportGenerator';
import { useLanguage } from '../i18n/LanguageContext';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  user: UserProfile;
  expenses: Expense[];
  settlements: Settlement[];
}

export const MonthlyReportModal: React.FC<MonthlyReportModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  user,
  expenses = [],
  settlements = [],
}) => {
  const { formatCurrency, formatDate } = useLanguage();

  if (!isOpen) return null;

  const report = buildMonthlyReportData(monthKey, user, expenses, settlements);

  const handleDownload = () => {
    downloadMonthlyPdf(monthKey, user, expenses, settlements);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#27272a] flex items-center justify-between bg-[#141416]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {report.monthDisplay} Statement
                </h3>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                  Official Archive
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa]">
                Immutable historical accounting ledger for {report.user.name} ({report.user.email})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#71717a] hover:text-white rounded-lg hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Monthly Expenses */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-sky-400" />
                  <span>1. Monthly Expenses</span>
                </span>
                <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">
                  {report.expenses.allSorted.length} items
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                {formatCurrency(report.expenses.totalAmount)}
              </p>
              <div className="pt-2 border-t border-[#27272a] flex items-center justify-between text-xs text-[#a1a1aa]">
                <span>Personal: <strong className="text-white">{formatCurrency(report.expenses.personalTotal)}</strong></span>
                <span>Shared: <strong className="text-white">{formatCurrency(report.expenses.sharedTotal)}</strong></span>
              </div>
            </div>

            {/* Card 2: Settlement Activity (Separated) */}
            <div className="bg-[#09090b] border border-[#27272a] rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  <span>2. Settlement Activity</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {report.settlements.items.length} items
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400 tracking-tight">
                {formatCurrency(report.settlements.totalActivity)}
              </p>
              <div className="pt-2 border-t border-[#27272a] flex items-center justify-between text-xs text-[#a1a1aa]">
                <span>Settle Up: <strong className="text-emerald-400">{formatCurrency(report.settlements.settleUpTotal)}</strong></span>
                <span>Settle Down: <strong className="text-rose-400">{formatCurrency(report.settlements.settleDownTotal)}</strong></span>
              </div>
            </div>
          </div>

          {/* Strict Separation Notice */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Accounting Rule Enforced:</strong> Settlement amounts are independent balance transfers and are strictly isolated from personal and squad expense accounting totals.
            </span>
          </div>

          {/* Table 1: Expenses */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#fafafa] flex items-center justify-between">
              <span>Monthly Expense Transactions</span>
              <span className="text-[10px] text-[#71717a] font-normal">Sorted Newest-First</span>
            </h4>
            {report.expenses.allSorted.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#71717a] bg-[#09090b] rounded-xl border border-[#27272a]">
                No expenses logged for {report.monthDisplay}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#27272a] bg-[#09090b]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141416] text-[#71717a] text-[10px] uppercase font-bold tracking-wider border-b border-[#27272a]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Title / Merchant</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Scope</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]/60">
                    {report.expenses.allSorted.map((exp) => (
                      <tr key={exp.id} className="hover:bg-[#18181b]/50 transition-colors">
                        <td className="p-3 text-[#a1a1aa] whitespace-nowrap font-mono">{formatDate(exp.date)}</td>
                        <td className="p-3 font-semibold text-white">{exp.title || exp.merchant}</td>
                        <td className="p-3 text-[#a1a1aa]">{exp.category}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${exp.isShared ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'}`}>
                            {exp.isShared ? 'Shared' : 'Personal'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-white">{formatCurrency(exp.originalAmount ?? exp.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Table 2: Settlements (Separate Section) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
              <span>Monthly Settlement Activity (Separate Accounting Layer)</span>
              <span className="text-[10px] text-[#71717a] font-normal">Sorted Newest-First</span>
            </h4>
            {report.settlements.items.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#71717a] bg-[#09090b] rounded-xl border border-[#27272a]">
                No settlement activity recorded for {report.monthDisplay}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#27272a] bg-[#09090b]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141416] text-[#71717a] text-[10px] uppercase font-bold tracking-wider border-b border-[#27272a]">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Counterparty</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272a]/60">
                    {report.settlements.items.map((stl) => {
                      const isUp = stl.settlementType === 'SETTLE_UP';
                      return (
                        <tr key={stl.id} className="hover:bg-[#18181b]/50 transition-colors">
                          <td className="p-3 text-[#a1a1aa] whitespace-nowrap font-mono">{formatDate(stl.createdAt)}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${isUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
                              {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              <span>{isUp ? 'SETTLE UP' : 'SETTLE DOWN'}</span>
                            </span>
                          </td>
                          <td className="p-3 text-[#fafafa] font-medium">{stl.fromUserName} → {stl.toUserName}</td>
                          <td className="p-3 text-[#a1a1aa]">{stl.paymentMethod || 'bKash'}</td>
                          <td className="p-3">
                            <span className="font-mono text-[10px] text-[#a1a1aa]">{stl.status}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">{formatCurrency(stl.originalAmount ?? stl.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-[#27272a] bg-[#141416] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#71717a]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Deterministic PDF archive reproducible anytime offline</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/25 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
