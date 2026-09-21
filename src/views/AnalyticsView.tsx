import React, { useMemo, useState } from 'react';
import { Expense, CategoryItem } from '../types';
import { TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
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
import { toPaisa, fromPaisa, sumExactAmounts } from '../utils/money';

// Preset vibrant palette for category donut chart
const CATEGORY_COLORS = [
  '#10b981', // Emerald green
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
  const { t, formatCurrency } = useLanguage();

  // Total expenditure across all scoped user expenses (computed strictly using integer paisa)
  const totalSpent = useMemo(() => {
    return sumExactAmounts(expenses.map((e) => e.amount));
  }, [expenses]);

  // Generate dynamic trajectory data for "Expense Growth Trend" strictly from real transactions
  const trajectoryData = useMemo(() => {
    if (expenses.length === 0) {
      return [];
    }

    // Determine the anchor date: latest expense date or current date (whichever is later)
    let anchorDate = new Date();
    const timestamps = expenses
      .map((e) => new Date(e.date).getTime())
      .filter((time) => !isNaN(time));

    if (timestamps.length > 0) {
      const latestTime = Math.max(...timestamps);
      if (latestTime > anchorDate.getTime()) {
        anchorDate = new Date(latestTime);
      }
    }

    // Number of months to show based on selected timeRange
    let numMonths = 6;
    if (timeRange === '1Y') {
      numMonths = 12;
    } else if (timeRange === 'ALL') {
      if (timestamps.length > 0) {
        const earliestTime = Math.min(...timestamps);
        const earliestDate = new Date(earliestTime);
        const diffMonths =
          (anchorDate.getFullYear() - earliestDate.getFullYear()) * 12 +
          (anchorDate.getMonth() - earliestDate.getMonth()) +
          1;
        numMonths = Math.max(6, Math.min(diffMonths, 36));
      }
    }

    // Build the month buckets ending at anchorDate, each initialized to exactly 0 paisa
    const monthBuckets: {
      key: string;
      monthName: string;
      year: number;
      amountPaisa: number;
    }[] = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthName = d.toLocaleString('en-US', { month: 'short' });
      monthBuckets.push({
        key,
        monthName,
        year: d.getFullYear(),
        amountPaisa: 0,
      });
    }

    const bucketMap = new Map<string, number>();
    monthBuckets.forEach((b, idx) => bucketMap.set(b.key, idx));

    // Aggregate real expenses using exact paisa integer addition
    expenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      if (!isNaN(expDate.getTime())) {
        const key = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
        const idx = bucketMap.get(key);
        if (idx !== undefined) {
          monthBuckets[idx].amountPaisa += toPaisa(exp.amount);
        }
      }
    });

    return monthBuckets.map((b) => ({
      month: b.monthName,
      year: b.year,
      amount: fromPaisa(b.amountPaisa),
      key: b.key,
    }));
  }, [expenses, timeRange]);

  // Maximum amount in trajectory for dynamic YAxis scaling
  const maxTrendAmount = useMemo(() => {
    if (trajectoryData.length === 0) return 0;
    return Math.max(...trajectoryData.map((d) => d.amount));
  }, [trajectoryData]);

  // Generate Category Breakdown data for Donut Chart dynamically from real transactions
  const categoryBreakdownData = useMemo(() => {
    if (expenses.length === 0) {
      return [];
    }

    const map: Record<string, number> = {};

    expenses.forEach((exp) => {
      // Strip emoji prefix for clean display in legend
      const cleanCat = exp.category.replace(/^[^\w\s]+/, '').trim() || exp.category;
      map[cleanCat] = (map[cleanCat] || 0) + toPaisa(exp.amount);
    });

    const items = Object.entries(map).map(([name, paisaValue], idx) => {
      // Match color from configured categories if available
      const matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(c.name.replace(/^[^\w\s]+/, '').trim().toLowerCase())
      );
      return {
        name,
        value: fromPaisa(paisaValue),
        color: matchedCat?.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      };
    });

    // Sort descending by value
    return items.sort((a, b) => b.value - a.value);
  }, [expenses, categories]);

  // Tooltip for Expense Growth Trend Area Chart
  const CustomTrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0].payload;
      const displayLabel = dataItem.year ? `${label} ${dataItem.year}` : label;
      return (
        <div className="bg-[#09090b] border border-[#27272a] px-3 py-2 rounded-lg shadow-2xl text-xs space-y-0.5">
          <p className="text-[#a1a1aa] font-medium">{displayLabel}</p>
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
      const total = sumExactAmounts(categoryBreakdownData.map((item) => item.value));
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

      {/* Main Graphs Grid */}
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

            {/* Time Range Selector */}
            <div className="flex items-center bg-[#1c1c21] border border-[#2d2d35] p-0.5 rounded-full text-xs font-medium text-[#a1a1aa] shrink-0">
              <button
                type="button"
                onClick={() => setTimeRange('6M')}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                  timeRange === '6M' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'hover:text-[#fafafa]'
                }`}
              >
                6M
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('1Y')}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                  timeRange === '1Y' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'hover:text-[#fafafa]'
                }`}
              >
                1Y
              </button>
              <button
                type="button"
                onClick={() => setTimeRange('ALL')}
                className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                  timeRange === 'ALL' ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'hover:text-[#fafafa]'
                }`}
              >
                ALL
              </button>
            </div>
          </div>

          {/* Area Chart or Empty State */}
          {expenses.length === 0 || trajectoryData.length === 0 ? (
            <div className="h-72 w-full flex flex-col items-center justify-center text-center p-6 bg-[#0e0e11] rounded-xl border border-[#1c1c21] border-dashed">
              <div className="w-12 h-12 rounded-full bg-[#1c1c21] flex items-center justify-center mb-3">
                <TrendingUp className="w-6 h-6 text-[#71717a]" />
              </div>
              <p className="text-sm font-semibold text-[#fafafa]">
                {t('noSpendingDataYet')}
              </p>
              <p className="text-xs text-[#71717a] mt-1 max-w-xs">
                {t('addFirstTransactionToSeeAnalytics')}
              </p>
            </div>
          ) : (
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
                    domain={[0, maxTrendAmount > 0 ? Math.ceil(maxTrendAmount * 1.15) : 100]}
                    tickFormatter={(val) => formatCurrency(val)}
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
          )}
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

          {/* Donut Chart or Empty State */}
          {categoryBreakdownData.length === 0 ? (
            <div className="h-56 w-full my-3 flex flex-col items-center justify-center text-center p-6 bg-[#0e0e11] rounded-xl border border-[#1c1c21] border-dashed">
              <div className="w-12 h-12 rounded-full bg-[#1c1c21] flex items-center justify-center mb-3">
                <PieChartIcon className="w-6 h-6 text-[#71717a]" />
              </div>
              <p className="text-sm font-semibold text-[#fafafa]">
                {t('noCategoryDataYet')}
              </p>
              <p className="text-xs text-[#71717a] mt-1 max-w-xs">
                {t('addTransactionsToCategorize')}
              </p>
            </div>
          ) : (
            <>
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

              {/* Bottom Dot Legend */}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
