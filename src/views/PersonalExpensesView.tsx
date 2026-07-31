import React, { useState, useMemo } from 'react';
import { Expense } from '../types';
import { Plus, Search, Trash2, Calendar, CreditCard, Tag, DollarSign, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useLanguage } from '../i18n/LanguageContext';

interface PersonalExpensesViewProps {
  expenses: Expense[];
  onOpenNewTransaction: () => void;
  onDeleteExpense: (id: string) => void;
  onToggleExpenseStatus?: (id: string) => void;
}

export const PersonalExpensesView: React.FC<PersonalExpensesViewProps> = ({
  expenses,
  onOpenNewTransaction,
  onDeleteExpense,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { t, formatCurrency, formatNumber, formatDate } = useLanguage();

  // Filter only personal expenses
  const personalExpenses = useMemo(() => {
    return expenses.filter((exp) => !exp.isShared);
  }, [expenses]);

  // Apply search & category filters
  const filteredExpenses = useMemo(() => {
    return personalExpenses
      .filter((exp) => {
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchTitle = exp.title.toLowerCase().includes(q);
          const matchCategory = exp.category.toLowerCase().includes(q);
          const matchMethod = exp.paymentMethod.toLowerCase().includes(q);
          if (!matchTitle && !matchCategory && !matchMethod) return false;
        }
        if (selectedCategory !== 'all' && exp.category !== selectedCategory) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [personalExpenses, searchTerm, selectedCategory]);

  // Compute total amount
  const totalPersonalAmount = useMemo(() => {
    return personalExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [personalExpenses]);

  // Prepare chart data (expenses grouped by date chronologically)
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    // Collect all dates
    personalExpenses.forEach((exp) => {
      const current = map.get(exp.date) || 0;
      map.set(exp.date, current + exp.amount);
    });

    // Convert to sorted array
    const sorted = Array.from(map.entries())
      .map(([date, amount]) => ({
        date,
        displayDate: formatDate(date),
        amount,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sorted;
  }, [personalExpenses, formatDate]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
      {/* Header & Add Transaction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#18181b] border border-[#27272a] p-5 rounded-xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#fafafa] flex items-center gap-2">
            <span>{t('personalExpensesTitle')}</span>
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            {t('totalPersonalSpent')}: <span className="text-blue-400 font-bold font-mono text-sm">{formatCurrency(totalPersonalAmount)}</span>
          </p>
        </div>

        <button
          onClick={onOpenNewTransaction}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addPersonalExpense')}</span>
        </button>
      </div>

      {/* Little Graph / Mini Chart */}
      <div className="bg-[#18181b] border border-[#27272a] p-5 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            {t('monthlySpendingTrend')}
          </h2>
          <span className="text-[11px] text-[#71717a] font-mono">
            {formatNumber(chartData.length)} {t('date')}s
          </span>
        </div>

        <div className="h-44 w-full pt-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="personalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="displayDate"
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                  tickFormatter={(val) => formatCurrency(val)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#09090b',
                    borderColor: '#27272a',
                    borderRadius: '8px',
                    color: '#fafafa',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [formatCurrency(value), t('amount')]}
                  labelFormatter={(label) => `${t('date')}: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#personalGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[#71717a]">
              {t('noPersonalExpenses')}
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#18181b] border border-[#27272a] p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#71717a]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchPersonalPlaceholder')}
            className="w-full bg-[#09090b] border border-[#27272a] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#fafafa] focus:outline-none focus:border-blue-500 placeholder-[#52525b]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full sm:w-auto bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-1.5 text-xs text-[#fafafa] focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">{t('allCategories')}</option>
            <option value="🍛 Food">🍛 {t('foodDining')}</option>
            <option value="🏠 Rent">🏠 {t('housingUtilities')}</option>
            <option value="🛒 Groceries">🛒 Groceries</option>
            <option value="💡 Utilities">💡 {t('housingUtilities')}</option>
            <option value="🌐 Internet">🌐 Software & Cloud</option>
            <option value="🚍 Transportation">🚍 {t('transportation')}</option>
            <option value="🎓 Education">🎓 General / Other</option>
            <option value="📱 Mobile & Subscriptions">📱 {t('softwareCloud')}</option>
            <option value="🩺 Health">🩺 {t('healthWellness')}</option>
            <option value="👕 Personal Care">👕 {t('shopping')}</option>
            <option value="🎉 Entertainment">🎉 {t('entertainment')}</option>
            <option value="🛍️ Shopping">🛍️ {t('shopping')}</option>
            <option value="👨‍👩‍👧 Family">👨‍👩‍👧 Family</option>
            <option value="💰 Savings">💰 Savings</option>
          </select>
        </div>
      </div>

      {/* Transactions Table: Title, Date, Category, Payment Method, Amount */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-[#27272a] bg-[#1c1c1f] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#fafafa] uppercase tracking-wider">
            {t('personalExpensesTitle')} ({formatNumber(filteredExpenses.length)})
          </h3>
          <span className="text-xs text-[#a1a1aa] font-mono">
            {t('totalExpenses')}: {formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] text-[#71717a] uppercase border-b border-[#27272a] bg-[#09090b]">
              <tr>
                <th className="px-6 py-3 font-semibold">{t('tableTitle')}</th>
                <th className="px-6 py-3 font-semibold">{t('date')}</th>
                <th className="px-6 py-3 font-semibold">{t('category')}</th>
                <th className="px-6 py-3 font-semibold">{t('paymentMethod')}</th>
                <th className="px-6 py-3 font-semibold text-right">{t('amount')}</th>
                <th className="px-4 py-3 font-semibold text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="text-sm hover:bg-white/5 transition-colors">
                  {/* Title */}
                  <td className="px-6 py-4">
                    <span className="font-semibold text-[#fafafa]">{exp.title}</span>
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 text-xs font-mono text-[#a1a1aa] whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#71717a]" />
                      <span>{formatDate(exp.date)}</span>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-6 py-4">
                    <span className="text-xs text-[#a1a1aa] bg-[#09090b] border border-[#27272a] px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                      <Tag className="w-3 h-3 text-[#71717a]" />
                      {exp.category}
                    </span>
                  </td>

                  {/* Pay Method */}
                  <td className="px-6 py-4 text-xs text-[#a1a1aa]">
                    <span className="inline-flex items-center gap-1.5 bg-[#09090b] px-2.5 py-1 rounded border border-[#27272a]">
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                      {exp.paymentMethod}
                    </span>
                  </td>

                  {/* Amount */}
                  <td className="px-6 py-4 text-right tabular-nums font-mono font-bold text-[#fafafa]">
                    {formatCurrency(exp.amount)}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-4 text-center">
                    <button
                      onClick={() => onDeleteExpense(exp.id)}
                      className="text-[#71717a] hover:text-red-400 p-1.5 rounded hover:bg-[#27272a] transition-colors cursor-pointer"
                      title={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-xs text-[#71717a]">
                    {t('noPersonalExpenses')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

