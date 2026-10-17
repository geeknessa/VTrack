import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  SlidersHorizontal,
  Calendar,
  PiggyBank,
  Check,
  Trash2,
  PieChart,
  Clock,
  Heart,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchApi, ActiveBudgetResponse, BudgetSuggestion } from '../api/client';

function formatNaira(minorUnits: number): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(major);
}

export const BudgetPlanner: React.FC<{ isEdit?: boolean }> = () => {
  const { settings, fetchSettings } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const currencySymbol = settings?.home_currency === 'NGN' ? '₦' : (settings?.home_currency || '₦');

  // Starting money (base income)
  const initialBaseIncome = settings?.base_income ? String(settings.base_income / 100) : '100000';
  const [baseIncomeStr, setBaseIncomeStr] = useState(initialBaseIncome);

  // Explicit savings choice: defaults to FALSE so savings is never forced!
  const [wantsToSave, setWantsToSave] = useState(false);
  const [savingsPercent, setSavingsPercent] = useState<number | null>(null);

  // Form states
  const [budgetName, setBudgetName] = useState('');
  const [cycleType, setCycleType] = useState<'monthly' | 'weekly' | 'biweekly' | 'allowance' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [savingsTargetStr, setSavingsTargetStr] = useState('');
  const [dailyLimitStr, setDailyLimitStr] = useState('');
  const [weeklyLimitStr, setWeeklyLimitStr] = useState('');

  // Category breakdown state: map of category_id -> amountStr
  const [enableCategories, setEnableCategories] = useState(false);
  const [allocations, setAllocations] = useState<Record<number, string>>({});

  // Suggestion advice state
  const [suggestionAdvice, setSuggestionAdvice] = useState<{
    title: string;
    subtitle: string;
    message: string;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  // Fetch active budget
  const { data: activeBudgetData } = useQuery({
    queryKey: ['budgets', 'active'],
    queryFn: () => fetchApi<ActiveBudgetResponse>('/api/budgets/active'),
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchApi<{ categories: any[] }>('/api/categories'),
  });

  const categories = categoriesData?.categories || [];

  // Default dates initializer
  const setDefaultDatesForCycle = (type: string) => {
    const now = new Date();
    if (type === 'monthly') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
      setBudgetName(`${firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Budget`);
    } else if (type === 'weekly') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(sunday.toISOString().split('T')[0]);
      setBudgetName(`Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    } else if (type === 'biweekly') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      const endBiweek = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 13);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(endBiweek.toISOString().split('T')[0]);
      setBudgetName('Bi-weekly Budget');
    } else if (type === 'allowance') {
      const anchor = settings?.period_anchor_date ? settings.period_anchor_date.split('T')[0] : now.toISOString().split('T')[0];
      const nextInc = settings?.expected_next_income_date ? settings.expected_next_income_date.split('T')[0] : '';
      setStartDate(anchor);
      if (nextInc) {
        setEndDate(nextInc);
      } else {
        const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        setEndDate(nextMonth.toISOString().split('T')[0]);
      }
      setBudgetName('Allowance Cycle Budget');
    }
  };

  // Populate form if existing budget exists
  useEffect(() => {
    if (activeBudgetData?.has_budget && activeBudgetData.budget) {
      const b = activeBudgetData.budget;
      setBudgetName(b.name || '');
      setCycleType(b.cycle_type || 'monthly');
      setStartDate(b.start_date || '');
      setEndDate(b.end_date || '');
      setTotalAmountStr(b.total_amount ? String(b.total_amount / 100) : '');

      if (b.savings_target && b.savings_target > 0) {
        setWantsToSave(true);
        setSavingsTargetStr(String(b.savings_target / 100));
      } else {
        setWantsToSave(false);
        setSavingsTargetStr('');
      }

      setDailyLimitStr(b.daily.is_explicit ? String(b.daily.limit / 100) : '');
      setWeeklyLimitStr(b.weekly.is_explicit ? String(b.weekly.limit / 100) : '');

      if (b.categories && b.categories.length > 0) {
        setEnableCategories(true);
        const map: Record<number, string> = {};
        b.categories.forEach(c => {
          map[c.category_id] = String(c.allocated_amount / 100);
        });
        setAllocations(map);
      }
    } else {
      setDefaultDatesForCycle('monthly');
      // When creating fresh, default to FULL allowance for spending (0 savings)
      if (settings?.base_income) {
        const amt = settings.base_income / 100;
        setBaseIncomeStr(String(amt));
        setTotalAmountStr(String(amt));
        setWantsToSave(false);
        setSavingsTargetStr('');
      }
    }
  }, [activeBudgetData]);

  const handleCycleChange = (type: any) => {
    setCycleType(type);
    setDefaultDatesForCycle(type);
  };

  // When user toggles savings choice
  const handleToggleSavings = (enable: boolean) => {
    setWantsToSave(enable);
    const baseNum = parseFloat(baseIncomeStr) || 0;

    if (!enable) {
      setSavingsTargetStr('');
      setSavingsPercent(null);
      // Give full allowance to spending
      if (baseNum > 0) {
        setTotalAmountStr(String(baseNum));
      }
    } else {
      // Default to a modest 10% when toggled on
      const defaultRate = 0.10;
      setSavingsPercent(10);
      const savingsVal = Math.round(baseNum * defaultRate);
      setSavingsTargetStr(String(savingsVal));
      setTotalAmountStr(String(Math.max(0, baseNum - savingsVal)));
    }
  };

  const handleSavingsPercentClick = (pct: number) => {
    setSavingsPercent(pct);
    const baseNum = parseFloat(baseIncomeStr) || 0;
    const savingsVal = Math.round(baseNum * (pct / 100));
    setSavingsTargetStr(String(savingsVal));
    setTotalAmountStr(String(Math.max(0, baseNum - savingsVal)));
  };

  // Pacing calculations
  const totalAmountNum = parseFloat(totalAmountStr) || 0;
  const daysDiff = (() => {
    if (!startDate || !endDate) return 30;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  })();

  const pacedDaily = totalAmountNum > 0 ? Math.round(totalAmountNum / daysDiff) : 0;
  const pacedWeekly = totalAmountNum > 0 ? Math.round((totalAmountNum / daysDiff) * 7) : 0;

  // Category sum calculation
  const totalAllocatedMajor = Object.values(allocations).reduce((sum, str) => {
    const val = parseFloat(str) || 0;
    return sum + val;
  }, 0);
  const safetyCushionMajor = totalAmountNum - totalAllocatedMajor;

  // Suggest Mutation
  const suggestMutation = useMutation({
    mutationFn: () => {
      const baseFunds = parseFloat(baseIncomeStr) ? parseFloat(baseIncomeStr) * 100 : undefined;
      const customSav = wantsToSave && savingsTargetStr ? parseFloat(savingsTargetStr) * 100 : undefined;
      return fetchApi<{ suggestion: BudgetSuggestion }>('/api/budgets/suggest', {
        method: 'POST',
        body: JSON.stringify({
          cycle_type: cycleType,
          start_date: startDate,
          end_date: endDate,
          total_funds: baseFunds,
          wants_to_save: wantsToSave,
          custom_savings: customSav,
        }),
      });
    },
    onSuccess: data => {
      const s = data.suggestion;
      setTotalAmountStr(String(s.total_amount / 100));

      if (wantsToSave && s.savings_target > 0) {
        setSavingsTargetStr(String(s.savings_target / 100));
      } else {
        setSavingsTargetStr('');
      }

      setDailyLimitStr(String(s.daily_limit / 100));
      setWeeklyLimitStr(String(s.weekly_limit / 100));

      if (s.allocations && s.allocations.length > 0) {
        setEnableCategories(true);
        const map: Record<number, string> = {};
        s.allocations.forEach(a => {
          map[a.category_id] = String(a.allocated_amount / 100);
        });
        setAllocations(map);
      }

      setSuggestionAdvice({
        title: s.advice_title || 'Tailored Plan',
        subtitle: s.advice_subtitle || 'Calculated to keep your spending safe and predictable.',
        message: s.advice_message || 'Work around these numbers to match your money.',
      });
    },
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const allocationsPayload = enableCategories
        ? Object.entries(allocations)
            .filter(([_, val]) => parseFloat(val) > 0)
            .map(([catId, val]) => ({
              category_id: parseInt(catId),
              allocated_amount: Math.round(parseFloat(val) * 100),
            }))
        : [];

      const body = {
        name: budgetName || 'Cycle Budget',
        cycle_type: cycleType,
        start_date: startDate,
        end_date: endDate,
        total_amount: Math.round(totalAmountNum * 100),
        daily_limit: dailyLimitStr ? Math.round(parseFloat(dailyLimitStr) * 100) : null,
        weekly_limit: weeklyLimitStr ? Math.round(parseFloat(weeklyLimitStr) * 100) : null,
        savings_target: wantsToSave && savingsTargetStr ? Math.round(parseFloat(savingsTargetStr) * 100) : 0,
        allocations: allocationsPayload,
      };

      return fetchApi('/api/budgets', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      fetchSettings();
      navigate('/');
    },
  });

  // Deactivate Mutation (for tracking freely without a budget)
  const deactivateMutation = useMutation({
    mutationFn: async (id: number) =>
      fetchApi(`/api/budgets/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      navigate('/');
    },
  });

  const handleAllocationChange = (catId: number, val: string) => {
    setAllocations(prev => ({
      ...prev,
      [catId]: val,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!startDate || !endDate) {
      setFormError('Please select both a start date and an end date.');
      return;
    }
    if (totalAmountNum <= 0) {
      setFormError('Please enter a spending budget amount greater than 0.');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="min-h-screen pt-4 pb-24 md:pb-12 md:pt-8 px-4 sm:px-6 w-full animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Top Bar ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-bold text-text-muted hover:text-text-main transition-colors btn-tap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <span className="text-xs font-bold text-accent bg-accent-soft border border-accent/20 px-3.5 py-1 rounded-full">
            {activeBudgetData?.has_budget ? 'Edit Budget' : 'New Budget'}
          </span>
        </div>

        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-text-main">
            {activeBudgetData?.has_budget ? 'Adjust Your Spending Plan' : 'Plan Your Spending'}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed max-w-2xl">
            Set simple spending guidelines and savings targets so you stay in control of your money throughout the cycle.
          </p>
        </div>

        {/* ── Responsive 2-Column Grid on Desktop / Tablet ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* ════ LEFT COLUMN: Starting Money, Savings Choice, Goal & Advice ════ */}
          <div className="lg:col-span-5 space-y-5">

            {/* Starting Allowance Card */}
            <div className="card-base p-5 bg-surface border border-border space-y-3">
              <div className="flex items-center gap-2 text-text-main">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
                  Your Starting Money
                </h2>
              </div>
              <p className="text-xs text-text-muted leading-tight">
                Enter your total allowance or income for this cycle so our suggestions match your actual money.
              </p>

              <div className="relative pt-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  value={baseIncomeStr}
                  onChange={e => {
                    setBaseIncomeStr(e.target.value);
                    if (!wantsToSave) {
                      setTotalAmountStr(e.target.value);
                    }
                  }}
                  placeholder="e.g. 100,000"
                  className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2.5 text-base font-bold text-text-main focus:outline-none focus:border-accent font-tabular"
                />
              </div>
            </div>

            {/* Savings Decision Card (Explicit Choice — NEVER FORCED) */}
            <div className="card-base p-5 bg-surface border border-border space-y-3">
              <div className="flex items-center gap-2 text-text-main">
                <PiggyBank className="w-4 h-4 text-accent" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
                  Do you want to save money this cycle?
                </h2>
              </div>
              <p className="text-xs text-text-muted leading-snug">
                You are in full control. If you need all your money for food and transit, we won't deduct any savings.
              </p>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleToggleSavings(false)}
                  className={`p-3 rounded-2xl border text-left transition-all btn-tap ${
                    !wantsToSave
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg text-text-muted border-border hover:border-accent/40'
                  }`}
                >
                  <p className="text-xs font-bold">No savings</p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${!wantsToSave ? 'text-white/80' : 'text-text-muted'}`}>
                    Use 100% for spending
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleSavings(true)}
                  className={`p-3 rounded-2xl border text-left transition-all btn-tap ${
                    wantsToSave
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg text-text-muted border-border hover:border-accent/40'
                  }`}
                >
                  <p className="text-xs font-bold">Yes, set a goal</p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${wantsToSave ? 'text-white/80' : 'text-text-muted'}`}>
                    Tuck some into Piggybank
                  </p>
                </button>
              </div>

              {/* Quick savings preset buttons if user chose to save */}
              {wantsToSave && (
                <div className="pt-2 border-t border-border/60 space-y-2 animate-in fade-in">
                  <label className="text-[11px] font-bold text-text-muted block">
                    Choose how much to save:
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[5, 10, 15, 20].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleSavingsPercentClick(pct)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors btn-tap ${
                          savingsPercent === pct
                            ? 'bg-accent-soft text-accent border-accent'
                            : 'bg-bg text-text-muted border-border hover:text-text-main'
                        }`}
                      >
                        {pct}% ({currencySymbol}{formatNaira(Math.round((parseFloat(baseIncomeStr) || 0) * (pct / 100) * 100))})
                      </button>
                    ))}
                  </div>

                  <div className="relative pt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      value={savingsTargetStr}
                      onChange={e => {
                        setSavingsTargetStr(e.target.value);
                        setSavingsPercent(null);
                        const bNum = parseFloat(baseIncomeStr) || 0;
                        const sNum = parseFloat(e.target.value) || 0;
                        setTotalAmountStr(String(Math.max(0, bNum - sNum)));
                      }}
                      placeholder="Or enter custom savings target"
                      className="w-full bg-bg border border-border rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent font-tabular"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Smart Suggestion & Advice Card */}
            <div className="card-base p-5 bg-surface border border-accent/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-main">
                    Need a tailored recommendation?
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                    VTrack will calculate a realistic spending budget and safe daily pace based on your money.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => suggestMutation.mutate()}
                disabled={suggestMutation.isPending}
                className="w-full py-2.5 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent-hover transition-colors btn-tap disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{suggestMutation.isPending ? 'Calculating tailored plan...' : 'Suggest a tailored plan for me'}</span>
              </button>

              {/* Friendly Advice Banner */}
              {suggestionAdvice && (
                <div className="p-3.5 bg-surface rounded-2xl border border-accent/30 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-accent">
                    <Heart className="w-3.5 h-3.5 fill-accent/20" />
                    <h4 className="text-xs font-bold">{suggestionAdvice.title}</h4>
                  </div>
                  <p className="text-xs text-text-main font-semibold leading-relaxed">
                    {suggestionAdvice.message}
                  </p>
                  <p className="text-[10px] text-text-muted text-center pt-1 border-t border-border/60">
                    You can edit any numbers on the right to match your exact plans!
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* ════ RIGHT COLUMN: Form Fields (Timing, Spending Pool, Daily Pace, Categories) ════ */}
          <div className="lg:col-span-7 space-y-5">
            <form onSubmit={handleSave} className="space-y-5">
              {formError && (
                <div className="p-3.5 bg-red-soft border border-red text-red text-xs font-bold rounded-xl animate-in fade-in">
                  {formError}
                </div>
              )}

              {/* Section 1: Cycle & Dates */}
              <div className="card-base p-5 bg-surface border border-border space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Calendar className="w-4 h-4 text-accent" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
                    1. Cycle &amp; Timing
                  </h2>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-2">Cycle Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'monthly', label: 'Monthly' },
                      { id: 'allowance', label: 'Allowance' },
                      { id: 'weekly', label: 'Weekly' },
                      { id: 'custom', label: 'Custom' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleCycleChange(opt.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all btn-tap ${
                          cycleType === opt.id
                            ? 'bg-accent text-white border-accent'
                            : 'bg-bg text-text-muted border-border hover:border-accent/40'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      required
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      required
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-text-muted">
                  Duration: <span className="font-bold text-accent">{daysDiff} days</span> in this cycle.
                </p>
              </div>

              {/* Section 2: Spending Pool */}
              <div className="card-base p-5 bg-surface border border-border space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
                    2. Total Spending Budget
                  </h2>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-main block mb-1">
                    Spending Limit for this cycle <span className="text-accent">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 100,000"
                      value={totalAmountStr}
                      onChange={e => setTotalAmountStr(e.target.value)}
                      required
                      className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2.5 text-base font-bold text-text-main focus:outline-none focus:border-accent font-tabular"
                    />
                  </div>
                  <p className="text-[11px] text-text-muted mt-1">
                    All tracked expenses count against this total.
                  </p>
                </div>
              </div>

              {/* Section 3: Safe Daily & Weekly Guide (Friendly wording, NO JARGON) */}
              <div className="card-base p-5 bg-surface border border-border space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <Clock className="w-4 h-4 text-accent" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
                    3. Daily &amp; Weekly Spending Guide (Optional)
                  </h2>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  These are not separate pots of money—just friendly pace markers so you don't burn through your allowance early.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">
                      Daily Spending Guide
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        placeholder={pacedDaily > 0 ? `Paced: ~${formatNaira(pacedDaily * 100)}` : 'e.g. 3,000'}
                        value={dailyLimitStr}
                        onChange={e => setDailyLimitStr(e.target.value)}
                        className="w-full bg-bg border border-border rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent font-tabular"
                      />
                    </div>
                    {pacedDaily > 0 && (
                      <button
                        type="button"
                        onClick={() => setDailyLimitStr(String(pacedDaily))}
                        className="text-[10px] font-bold text-accent hover:underline mt-1 block"
                      >
                        Use safe daily pace ({currencySymbol}{formatNaira(pacedDaily * 100)}/day)
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-text-muted block mb-1">
                      Weekly Spending Guide
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        step="any"
                        placeholder={pacedWeekly > 0 ? `Paced: ~${formatNaira(pacedWeekly * 100)}` : 'e.g. 21,000'}
                        value={weeklyLimitStr}
                        onChange={e => setWeeklyLimitStr(e.target.value)}
                        className="w-full bg-bg border border-border rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-accent font-tabular"
                      />
                    </div>
                    {pacedWeekly > 0 && (
                      <button
                        type="button"
                        onClick={() => setWeeklyLimitStr(String(pacedWeekly))}
                        className="text-[10px] font-bold text-accent hover:underline mt-1 block"
                      >
                        Use safe weekly pace ({currencySymbol}{formatNaira(pacedWeekly * 100)}/week)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 4: Category Breakdown (Optional) */}
              <div className="card-base p-5 bg-surface border border-border space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-accent" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-text-main">
                      4. Category Breakdown (Optional)
                    </h2>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableCategories}
                      onChange={e => setEnableCategories(e.target.checked)}
                      className="rounded text-accent focus:ring-accent"
                    />
                    <span className="text-xs font-bold text-accent">
                      {enableCategories ? 'Enabled' : 'Skip categories'}
                    </span>
                  </label>
                </div>

                {enableCategories ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-bg rounded-xl border border-border flex justify-between items-center text-xs">
                      <div>
                        <span className="text-text-muted">Total Planned: </span>
                        <span className="font-bold font-tabular text-text-main">
                          {currencySymbol}{formatNaira(totalAllocatedMajor * 100)}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">Safety Cushion: </span>
                        <span className={`font-bold font-tabular ${safetyCushionMajor < 0 ? 'text-red' : 'text-accent'}`}>
                          {currencySymbol}{formatNaira(safetyCushionMajor * 100)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {categories.map(cat => (
                        <div key={cat.id} className="flex items-center gap-2 p-2 bg-bg rounded-xl border border-border">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-text-main truncate">{cat.name}</p>
                            <p className="text-[10px] text-text-muted uppercase">{cat.kind}</p>
                          </div>
                          <div className="w-32 relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
                              {currencySymbol}
                            </span>
                            <input
                              type="number"
                              step="any"
                              placeholder="0"
                              value={allocations[cat.id] || ''}
                              onChange={e => handleAllocationChange(cat.id, e.target.value)}
                              className="w-full bg-surface border border-border rounded-lg pl-6 pr-2 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-accent font-tabular"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted leading-relaxed">
                    Category limits are skipped. You can still track expenses by category without restricting them to strict buckets.
                  </p>
                )}
              </div>

              {/* Submit Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="w-full py-3.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent-hover transition-colors btn-tap disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{saveMutation.isPending ? 'Saving plan...' : 'Save & Activate Plan'}</span>
                </button>

                {activeBudgetData?.has_budget && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Do you want to deactivate your active budget? Your transactions will remain intact, and you will track without a fixed budget.')) {
                        deactivateMutation.mutate(activeBudgetData.budget!.id);
                      }
                    }}
                    disabled={deactivateMutation.isPending}
                    className="w-full py-2.5 bg-surface border border-red/30 text-red rounded-xl text-xs font-bold hover:bg-red/5 transition-colors btn-tap flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Deactivate budget & track freely</span>
                  </button>
                )}
              </div>

            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
