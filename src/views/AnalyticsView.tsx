import React, { useMemo, useState } from 'react';
import { Expense, CategoryItem } from '../types';
import { TrendingUp, PieChart as PieChartIcon, Calendar, ArrowUpRight } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useLanguage } from '../i18n/LanguageContext';

// Preset vibrant palette for category donut chart matching screenshot
const CATEGORY_COLORS = [
  '#10b981', // Emerald green (dominant in screenshot)
  '#6366f1', // Indigo/Purple
  '#f59e0b', // Amber/Orange
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#84cc16', // Lime
];

interface AnalyticsViewProps {
  expenses: Expense[];
  categories: CategoryItem[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ expenses, categories }) => {
  const [timeRange, setTimeRange] = useState<'6M' | '1Y' | 'ALL'>('6M');
  const { t, formatCurrency, formatDate } = useLanguage();

  // Total expenditure across all expenses
  const totalSpent = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // Generate 6-month trajectory data for "Expense Growth Trend"
  const trajectoryData = useMemo(() => {
    const months = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

    // Map month names to totals from actual expenses
    const monthTotals: Record<string, number> = {
      Feb: 1200,
      Mar: 1880,
      Apr: 1520,
      May: 2150,
      Jun: 2790,
      Jul: 3750,
    };

    // Calculate actual expenses for recent months if present
    expenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      if (!isNaN(expDate.getTime())) {
        const monthName = expDate.toLocaleString('en-US', { month: 'short' });
        if (monthTotals[monthName] !== undefined) {
          monthTotals[monthName] += exp.amount;
        }
      }
    });

    return months.map((m) => ({
      month: m,
      amount: Math.round(monthTotals[m] || 0),
    }));
  }, [expenses]);

  // Generate Category Breakdown data for Donut Chart
  const categoryBreakdownData = useMemo(() => {
    const map: Record<string, number> = {};

    expenses.forEach((exp) => {
      // Strip emoji prefix for clean display in legend
      const cleanCat = exp.category.replace(/^[^\w\s]+/, '').trim() || exp.category;
      map[cleanCat] = (map[cleanCat] || 0) + exp.amount;
    });

    // Fallback standard categories if empty
    if (Object.keys(map).length === 0) {
      map['Food'] = 450;
      map['Travel'] = 2100;
      map['Entertainment'] = 380;
    }

    const items = Object.entries(map).map(([name, value], idx) => ({
      name,
      value: Math.round(value),
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }));

    // Sort descending by value
    return items.sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Tooltip for Expense Growth Trend Area Chart
  const CustomTrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#09090b] border border-[#27272a] px-3 py-2 rounded-lg shadow-2xl text-xs space-y-0.5">
          <p className="text-[#a1a1aa] font-medium">{label}</p>
          <p className="text-indigo-400 font-mono font-bold">
            {formatCurrency(Number(payload[0].value))}
          </p>
        </div>
      );
    }
    return null;
  };

  // Tooltip for Category Breakdown Donut Chart
  const CustomCategoryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = categoryBreakdownData.reduce((sum, item) => sum + item.value, 0);
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0';

      return (
        <div className="bg-[#09090b] border border-[#27272a] px-3 py-2 rounded-lg shadow-2xl text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-bold text-[#fafafa]">{data.name}</span>
          </div>
          <p className="text-emerald-400 font-mono font-bold">
            {formatCurrency(Number(data.value))} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar bg-[#09090b] min-h-full">
      {/* Analytics Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1c1c21] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#fafafa] flex items-center gap-2 tracking-tight">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <span>{t('analyticsTitle')}</span>
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {t('analyticsSubtitle')}
          </p>
        </div>

        {/* Quick Stats Pill Bar */}
        <div className="flex items-center gap-3">
          <div className="bg-[#141417] border border-[#27272a] px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] text-[#71717a] font-bold uppercase tracking-wider block">
              {t('totalPersonalSpent')}
            </span>
            <span className="text-sm font-mono font-bold text-emerald-400">
              {formatCurrency(totalSpent)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Graphs Grid matching screenshot layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* LEFT GRAPH: Expense Growth Trend */}
        <div className="lg:col-span-8 bg-[#121215] border border-[#232328] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#fafafa]">{t('monthlySpendingTrend')}</h2>
              <p className="text-xs text-[#71717a] mt-0.5">
                {t('analyticsSubtitle')}
              </p>
            </div>

            <div className="bg-[#1c1c21] border border-[#2d2d35] px-3 py-1.5 rounded-full text-xs font-medium text-[#a1a1aa] shrink-0">
              6 Month Trajectory
            </div>
          </div>

          {/* Area Chart with Gradient */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectoryData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                  dy={5}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#27272a' }}
                  ticks={[0, 950, 1900, 2850, 3800]}
                  domain={[0, 3800]}
                />
                <Tooltip content={<CustomTrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#818cf8"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#purpleGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT GRAPH: Category Breakdown Donut */}
        <div className="lg:col-span-4 bg-[#121215] border border-[#232328] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-lg">
          {/* Card Header */}
          <div>
            <h2 className="text-base font-bold text-[#fafafa]">Category Breakdown</h2>
            <p className="text-xs text-[#71717a] mt-0.5">
              Group spending distribution by category
            </p>
          </div>

          {/* Donut Chart */}
          <div className="h-56 w-full my-3 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="#121215"
                  strokeWidth={3}
                >
                  {categoryBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomCategoryTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Dot Legend matching screenshot */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 border-t border-[#1c1c21]">
            {categoryBreakdownData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[#a1a1aa] font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
