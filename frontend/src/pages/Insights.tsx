import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from 'recharts';
import {
  TrendingDown,
  TrendingUp,
  Lightbulb,
  Store,
  Coffee,
  ShoppingBag,
  Utensils,
  ChevronRight,
  Edit3,
  X,
  PackageCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePeriod } from '../context/PeriodContext';
import { fetchApi, InsightsResponse, Transaction } from '../api/client';
import { CoinBuddy } from '../components/CoinBuddy';
import { ActivityPeriodFilter, SelectedPeriod, DurationType } from '../components/ActivityPeriodFilter';
import { EditTransactionSheet } from '../components/EditTransactionSheet';

const CHART_COLORS = [
  '#F24E8E', // Primary pink
  '#F777A9', // Medium pink
  '#FF9EC4', // Light pink
  '#FA6398', // Accent rose
  '#D6336C', // Deep raspberry
  '#B8255F', // Dark blush
  '#FFA8A8', // Pastel peach-pink
  '#E64980', // Hot pink
];

function formatMoney(amountMinor: number, currency: string = 'NGN'): string {
  const major = amountMinor / 100;
  const symbol = currency === 'NGN' ? '₦' : currency + ' ';
  return `${symbol}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(major)}`;
}

export const Insights: React.FC = () => {
  const queryClient = useQueryClient();
  const { settings } = useAuth();
  const { period: globalPeriod, mode: globalMode } = usePeriod();
  const currency = settings?.home_currency || 'NGN';

  // Local filter period on Insights page
  const getInitialDuration = (): DurationType => {
    if (globalMode === 'weekly') return 'weekly';
    if (globalMode === 'monthly') return 'monthly';
    if (globalMode === 'yearly') return 'yearly';
    if (globalMode === 'custom') return 'custom';
    if (globalMode === 'all_time') return 'all_time';
    return 'cycle';
  };

  const [duration, setDuration] = useState<DurationType>(getInitialDuration);
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>(() => ({
    from: globalPeriod.from,
    to: globalPeriod.to,
    label: globalPeriod.label,
  }));

  // Selected transaction for edit/delete sheet
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Meal plan modal / edit state
  const [isEditingMealPlan, setIsEditingMealPlan] = useState(false);
  const [mealPlanInput, setMealPlanInput] = useState('');

  // Fetch insights data
  const { data, isLoading } = useQuery({
    queryKey: ['insights', { from: selectedPeriod.from, to: selectedPeriod.to }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedPeriod.from) params.set('from', selectedPeriod.from);
      if (selectedPeriod.to) params.set('to', selectedPeriod.to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return fetchApi<InsightsResponse>(`/api/insights${qs}`);
    },
  });

  // Mutation for updating weekly meal plan target
  const updateMealPlanMutation = useMutation({
    mutationFn: (targetMinor: number) =>
      fetchApi<{ message: string; weekly_target: number }>('/api/insights/meal-plan', {
        method: 'PUT',
        body: JSON.stringify({ weekly_target: targetMinor }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      setIsEditingMealPlan(false);
    },
  });

  const handleSaveMealPlan = (e: React.FormEvent) => {
    e.preventDefault();
    const major = parseFloat(mealPlanInput.replace(/,/g, ''));
    if (isNaN(major) || major < 0) return;
    updateMealPlanMutation.mutate(Math.round(major * 100));
  };

  const openMealPlanEdit = (currentTargetMinor: number) => {
    setMealPlanInput(currentTargetMinor > 0 ? (currentTargetMinor / 100).toString() : '');
    setIsEditingMealPlan(true);
  };

  // Safe data extraction
  const categories = data?.categories || [];
  const weeklyBars = data?.weekly_bars || [];
  const cycleComparison = data?.cycle_comparison;
  const topPurchases = data?.top_purchases || [];
  const foodSplit = data?.food_split;
  const mealPlan = data?.meal_plan;
  const totalSpent = data?.period?.total_spent || 0;

  // Donut chart data
  const donutData = categories.slice(0, 6).map((c) => ({
    name: c.category_name,
    value: c.total,
  }));

  return (
    <div className="w-full min-h-screen bg-bg text-text-main pb-24 md:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 md:pt-8 space-y-6">

        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-black text-text-main tracking-tight">
              Spending Insights
            </h1>
            <p className="text-xs md:text-sm text-text-muted mt-1">
              Trends, weekly pace, food split & provisions stash savings
            </p>
          </div>

          <Link
            to="/activity"
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface text-text-muted hover:text-accent font-bold text-xs transition-colors btn-tap"
          >
            <span>All Transactions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ── Period Selector & Filter Bar ── */}
        <ActivityPeriodFilter
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          duration={duration}
          onDurationChange={setDuration}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            <div className="card-base p-6 bg-surface h-56 border border-border" />
            <div className="card-base p-6 bg-surface h-56 border border-border" />
            <div className="card-base p-6 bg-surface h-72 border border-border" />
            <div className="card-base p-6 bg-surface h-72 border border-border" />
          </div>
        ) : totalSpent === 0 && topPurchases.length === 0 ? (
          /* Empty State */
          <div className="card-base p-12 text-center bg-surface border border-border flex flex-col items-center justify-center space-y-4">
            <CoinBuddy mood="sleepy" size={90} speech="No expenses recorded in this period yet!" />
            <p className="text-xs text-text-muted max-w-sm">
              Log transactions to unlock your spending donut, weekly trends, food split, and meal plan tracker.
            </p>
            <Link
              to="/add"
              className="px-5 py-2.5 rounded-xl bg-accent text-white font-bold text-xs hover:bg-accent-hover transition-colors btn-tap shadow-none"
            >
              Log an Expense
            </Link>
          </div>
        ) : (
          /* ── Main Insights Grid ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* ════ LEFT COLUMN: Trends & Food Split (7 cols on lg) ════ */}
            <div className="lg:col-span-7 space-y-6">

              {/* 1. Cycle-over-Cycle Comparison Card */}
              {cycleComparison && cycleComparison.has_comparison && (
                <div className="card-base p-5 bg-surface border border-border relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Cycle Pace Comparison
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                        cycleComparison.status === 'spending_less'
                          ? 'bg-green-soft text-green border border-green/20'
                          : cycleComparison.status === 'spending_more'
                          ? 'bg-orange-50 text-orange-600 border border-orange-200'
                          : 'bg-bg text-text-muted border border-border'
                      }`}
                    >
                      {cycleComparison.status === 'spending_less' ? (
                        <>
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>{Math.abs(cycleComparison.diff_percentage)}% Lower</span>
                        </>
                      ) : cycleComparison.status === 'spending_more' ? (
                        <>
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+{Math.abs(cycleComparison.diff_percentage)}% Higher</span>
                        </>
                      ) : (
                        <span>On Par</span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-2">
                    <div className="bg-bg rounded-xl p-3 border border-border">
                      <p className="text-[11px] font-bold text-text-muted uppercase">This Window</p>
                      <p className="text-lg md:text-xl font-heading font-black text-text-main mt-0.5 font-tabular">
                        {formatMoney(cycleComparison.current_cycle_spent, currency)}
                      </p>
                    </div>

                    <div className="bg-bg rounded-xl p-3 border border-border">
                      <p className="text-[11px] font-bold text-text-muted uppercase">Previous Window</p>
                      <p className="text-lg md:text-xl font-heading font-black text-text-muted mt-0.5 font-tabular">
                        {formatMoney(cycleComparison.previous_cycle_spent, currency)}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-text-main mt-3 flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>{cycleComparison.insight_text}</span>
                  </p>
                </div>
              )}

              {/* 2. Weekly Spending Bar Chart */}
              {weeklyBars.length > 0 && (
                <div className="card-base p-5 bg-surface border border-border space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-sm font-heading font-black text-text-main uppercase tracking-wider">
                        Weekly Spending Pace
                      </h2>
                      <p className="text-xs text-text-muted">How your money was spent week by week</p>
                    </div>
                    <span className="text-xs font-bold text-text-muted bg-bg px-2.5 py-1 rounded-lg border border-border">
                      {weeklyBars.length} intervals
                    </span>
                  </div>

                  <div className="h-48 w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyBars} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis
                          dataKey="week_label"
                          tick={{ fill: '#7C6772', fontSize: 11, fontWeight: 'bold' }}
                          axisLine={{ stroke: '#F7D6E3' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: '#7C6772', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => `₦${val >= 100000 ? Math.round(val / 100000) + 'k' : Math.round(val / 100)}`}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatMoney(value, currency), 'Spent']}
                          labelFormatter={(_, items) => {
                            const item = items?.[0]?.payload as any;
                            return item?.sub_label || 'Week';
                          }}
                          contentStyle={{
                            background: '#FFFFFF',
                            border: '1.5px solid #F7D6E3',
                            borderRadius: '0.75rem',
                            fontSize: '11px',
                            fontFamily: 'Nunito, sans-serif',
                            fontWeight: 'bold',
                            boxShadow: 'none',
                          }}
                        />
                        <Bar
                          dataKey="total_spent"
                          fill="#F24E8E"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={48}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 3. How & Where You Ate (Eating Habits Breakdown) */}
              {foodSplit && (
                <div className="card-base p-5 bg-surface border border-border space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-sm font-heading font-black text-text-main uppercase tracking-wider">
                        How & Where You Ate
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">
                        Food Court, Outings, and Provisions all fall under your eating budget to guide your meal plan.
                      </p>
                    </div>
                    <span className="text-xs font-black font-tabular text-accent bg-accent-soft border border-accent/20 px-2.5 py-1 rounded-full">
                      {formatMoney(foodSplit.total_food_spent, currency)} total eating
                    </span>
                  </div>

                  {foodSplit.total_food_spent === 0 ? (
                    <div className="bg-bg rounded-xl p-4 text-center border border-border">
                      <p className="text-xs text-text-muted">
                        No food transactions recorded in this period.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Segmented bar */}
                      <div className="w-full h-3 bg-bg rounded-full overflow-hidden flex border border-border">
                        {foodSplit.food_court.percentage > 0 && (
                          <div
                            style={{ width: `${foodSplit.food_court.percentage}%` }}
                            className="bg-accent h-full transition-all duration-500"
                            title={`Food Court: ${foodSplit.food_court.percentage}%`}
                          />
                        )}
                        {foodSplit.outside_dining.percentage > 0 && (
                          <div
                            style={{ width: `${foodSplit.outside_dining.percentage}%` }}
                            className="bg-orange-400 h-full transition-all duration-500"
                            title={`Outside Dining: ${foodSplit.outside_dining.percentage}%`}
                          />
                        )}
                        {foodSplit.provisions.percentage > 0 && (
                          <div
                            style={{ width: `${foodSplit.provisions.percentage}%` }}
                            className="bg-emerald-500 h-full transition-all duration-500"
                            title={`Snacks & Provisions: ${foodSplit.provisions.percentage}%`}
                          />
                        )}
                      </div>

                      {/* 3 Split Cards */}
                      <div className="grid grid-cols-3 gap-2.5">
                        {/* Food Court */}
                        <div className="bg-bg rounded-xl p-3 border border-border space-y-1">
                          <div className="flex items-center gap-1.5 text-accent">
                            <Store className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold truncate">Food Court</span>
                          </div>
                          <p className="text-xs font-black font-tabular text-text-main">
                            {formatMoney(foodSplit.food_court.amount, currency)}
                          </p>
                          <p className="text-[10px] font-bold text-text-muted">
                            {foodSplit.food_court.percentage}% · Campus
                          </p>
                        </div>

                        {/* Outings / Outside */}
                        <div className="bg-bg rounded-xl p-3 border border-border space-y-1">
                          <div className="flex items-center gap-1.5 text-orange-500">
                            <Coffee className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold truncate">Outings</span>
                          </div>
                          <p className="text-xs font-black font-tabular text-text-main">
                            {formatMoney(foodSplit.outside_dining.amount, currency)}
                          </p>
                          <p className="text-[10px] font-bold text-text-muted">
                            {foodSplit.outside_dining.percentage}% · Eating out
                          </p>
                        </div>

                        {/* Hostel Provisions */}
                        <div className="bg-bg rounded-xl p-3 border border-border space-y-1">
                          <div className="flex items-center gap-1.5 text-emerald-600">
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-bold truncate">Provisions</span>
                          </div>
                          <p className="text-xs font-black font-tabular text-text-main">
                            {formatMoney(foodSplit.provisions.amount, currency)}
                          </p>
                          <p className="text-[10px] font-bold text-text-muted">
                            {foodSplit.provisions.percentage}% · Stash
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 4. Weekly Meal Plan & Home Stash Tracker */}
              {mealPlan && (
                <div className="card-base p-5 bg-surface border border-border space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-accent" />
                        <h2 className="text-sm font-heading font-black text-text-main uppercase tracking-wider">
                          Weekly Meal Plan Tracker
                        </h2>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Current week ({mealPlan.week_label})
                      </p>
                    </div>

                    <button
                      onClick={() => openMealPlanEdit(mealPlan.weekly_target)}
                      className="flex items-center gap-1 text-xs font-bold text-accent hover:underline btn-tap"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{mealPlan.is_set ? 'Edit Target' : 'Set Plan Target'}</span>
                    </button>
                  </div>

                  {/* Stash Days Highlight Banner */}
                  <div className="bg-accent-soft/60 border border-accent/20 rounded-xl p-3.5 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shrink-0 font-bold">
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black text-text-main">
                          {mealPlan.zero_spend_days_count} zero-spend food {mealPlan.zero_spend_days_count === 1 ? 'day' : 'days'} this week!
                        </p>
                        <span className="text-[9px] uppercase font-black text-accent bg-white/70 px-2 py-0.5 rounded-full border border-accent/20">
                          Home Stash Power
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-1 leading-snug">
                        {mealPlan.zero_spend_days_count > 0 ? (
                          <>Eating from your home provisions and hostel stash helped you avoid buying meals outside.</>
                        ) : (
                          <>No ₦0 food days yet this week. Eating from your hostel stash on busy days is a great way to save!</>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Meal Plan Progress */}
                  {mealPlan.is_set ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline text-xs font-bold">
                        <span className="text-text-muted">Weekly Food Spent</span>
                        <span className="font-tabular text-text-main">
                          {formatMoney(mealPlan.this_week_food_spent, currency)} / {formatMoney(mealPlan.weekly_target, currency)}
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-bg rounded-full overflow-hidden border border-border">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            mealPlan.this_week_food_spent > mealPlan.weekly_target
                              ? 'bg-red'
                              : mealPlan.this_week_food_spent > mealPlan.weekly_target * 0.8
                              ? 'bg-orange-400'
                              : 'bg-accent'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((mealPlan.this_week_food_spent / mealPlan.weekly_target) * 100)
                            )}%`,
                          }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-[11px] font-bold pt-1">
                        <span className="text-text-muted">
                          {mealPlan.remaining_meal_budget > 0 ? (
                            <span className="text-green">{formatMoney(mealPlan.remaining_meal_budget, currency)} remaining safe to spend</span>
                          ) : (
                            <span className="text-red">Over target by {formatMoney(mealPlan.this_week_food_spent - mealPlan.weekly_target, currency)}</span>
                          )}
                        </span>
                        {mealPlan.stash_savings > 0 && (
                          <span className="text-accent font-bold">
                            ~{formatMoney(mealPlan.stash_savings, currency)} stash savings
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-bg rounded-xl p-4 text-center border border-border space-y-2">
                      <p className="text-xs text-text-muted">
                        You haven't set a weekly food plan target yet. Set one to compare your food spending!
                      </p>
                      <button
                        onClick={() => openMealPlanEdit(0)}
                        className="px-4 py-1.5 bg-accent text-white rounded-lg text-xs font-bold hover:bg-accent-hover transition-colors btn-tap"
                      >
                        Set Weekly Target
                      </button>
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-border/70 flex justify-end">
                    <Link
                      to="/menus"
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1 btn-tap"
                    >
                      <span>Open Food & Menus Planner</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}

            </div>

            {/* ════ RIGHT COLUMN: Categories Donut & Top Purchases (5 cols on lg) ════ */}
            <div className="lg:col-span-5 space-y-6">

              {/* 5. Category Donut & Ranked List */}
              <div className="card-base p-5 bg-surface border border-border space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-heading font-black text-text-main uppercase tracking-wider">
                    Spending by Category
                  </h2>
                  <span className="text-xs font-bold text-text-muted bg-bg px-2.5 py-1 rounded-lg border border-border">
                    {categories.length} categories
                  </span>
                </div>

                {/* Donut Chart */}
                {donutData.length > 0 && (
                  <div className="relative h-44 flex items-center justify-center my-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {donutData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) => [formatMoney(val, currency), '']}
                          contentStyle={{
                            background: '#FFFFFF',
                            border: '1.5px solid #F7D6E3',
                            borderRadius: '0.75rem',
                            fontSize: '11px',
                            fontFamily: 'Nunito, sans-serif',
                            boxShadow: 'none',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Total</span>
                      <span className="text-sm font-black text-text-main font-tabular">{formatMoney(totalSpent, currency)}</span>
                    </div>
                  </div>
                )}

                {/* Ranked Category List */}
                <div className="space-y-3 pt-1 divide-y divide-border">
                  {categories.map((cat, i) => (
                    <div key={cat.category_name} className="pt-2.5 first:pt-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="font-bold text-text-main truncate max-w-[140px]">
                            {cat.category_name}
                          </span>
                          <span className="text-[10px] text-text-muted font-bold">
                            ({cat.count})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold font-tabular text-text-main">
                            {formatMoney(cat.total, currency)}
                          </span>
                          <span className="text-[10px] font-black text-accent bg-accent-soft px-1.5 py-0.5 rounded">
                            {cat.percentage}%
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden border border-border">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${cat.percentage}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Top Individual Purchases */}
              <div className="card-base p-5 bg-surface border border-border space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-heading font-black text-text-main uppercase tracking-wider">
                    Largest Purchases
                  </h2>
                  <span className="text-xs font-bold text-text-muted">Top 5</span>
                </div>

                {topPurchases.length === 0 ? (
                  <p className="text-xs text-text-muted py-3 text-center">No purchases recorded yet.</p>
                ) : (
                  <div className="space-y-2 divide-y divide-border">
                    {topPurchases.map((tx, idx) => {
                      const txDate = tx.date || tx.occurred_at || new Date().toISOString();
                      const dateStr = new Date(txDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      });
                      return (
                        <div
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="pt-2.5 first:pt-0 flex items-center justify-between group cursor-pointer hover:bg-surface-hover p-1.5 rounded-xl transition-colors btn-tap"
                          title="Tap to edit or review"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-bg border border-border text-[11px] font-black flex items-center justify-center shrink-0 text-text-muted">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-text-main truncate group-hover:text-accent transition-colors">
                                {tx.note || tx.category_name}
                              </p>
                              <p className="text-[10px] text-text-muted truncate">
                                {tx.category_name} · {dateStr}
                              </p>
                            </div>
                          </div>

                          <span className="text-xs font-black font-tabular text-text-main shrink-0 ml-2">
                            {formatMoney(tx.amount, currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </div>

      {/* ── Meal Plan Edit Modal ── */}
      {isEditingMealPlan && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base p-6 bg-surface border border-border max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-heading font-black text-text-main">
                Weekly Meal Plan Target
              </h3>
              <button
                onClick={() => setIsEditingMealPlan(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-main btn-tap"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-text-muted">
              How much do you plan or wish to spend on food each week? We'll track your actual purchases and home-provisions savings against this.
            </p>

            <form onSubmit={handleSaveMealPlan} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-muted block mb-1">
                  Target Amount ({currency})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-muted text-sm">
                    {currency === 'NGN' ? '₦' : currency}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={mealPlanInput}
                    onChange={(e) => setMealPlanInput(e.target.value)}
                    placeholder="e.g. 15000"
                    autoFocus
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-bg text-text-main font-bold text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingMealPlan(false)}
                  className="flex-1 py-2 rounded-xl border border-border bg-bg text-text-muted font-bold text-xs hover:text-text-main btn-tap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMealPlanMutation.isPending}
                  className="flex-1 py-2 rounded-xl bg-accent text-white font-bold text-xs hover:bg-accent-hover transition-colors btn-tap"
                >
                  {updateMealPlanMutation.isPending ? 'Saving...' : 'Save Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Transaction Sheet ── */}
      {selectedTx && (
        <EditTransactionSheet
          transaction={selectedTx}
          isOpen={Boolean(selectedTx)}
          onClose={() => {
            setSelectedTx(null);
            queryClient.invalidateQueries({ queryKey: ['insights'] });
          }}
        />
      )}

    </div>
  );
};
