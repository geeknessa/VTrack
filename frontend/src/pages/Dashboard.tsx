import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { fetchApi, Transaction, ActiveBudgetResponse, SubscriptionsResponse } from '../api/client';
import { strings } from '../i18n/strings';
import { CoinBuddy } from '../components/CoinBuddy';
import {
  Settings as SettingsIcon,
  Info,
  PiggyBank,
  ChevronRight,
  Calendar,
  Heart,
  SlidersHorizontal,
  Plus,
  Utensils,
  ShoppingBag,
  Bus,
  Book,
  HeartPulse,
  Home,
  Wifi,
  Coffee,
  PartyPopper,
  Shirt,
  Laptop,
  Receipt,
  CreditCard,
  Check,
  LogOut
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { StashSheet } from '../components/StashSheet';
import { EditTransactionSheet } from '../components/EditTransactionSheet';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { usePeriod } from '../context/PeriodContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(minorUnits: number, currency: string): string {
  const symbol = currency === 'NGN' ? '₦' : currency;
  const major = minorUnits / 100;
  return symbol + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(major);
}

function formatMoneyFull(minorUnits: number, currency: string): string {
  const symbol = currency === 'NGN' ? '₦' : currency;
  const major = minorUnits / 100;
  return symbol + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(major);
}

function smartTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getCategoryIcon(name?: string | null) {
  const n = (name || '').toLowerCase();
  if (n.includes('food court') || n.includes('cafeteria')) return <Utensils className="w-4 h-4 text-accent" />;
  if (n.includes('outside dining') || n.includes('dining')) return <Coffee className="w-4 h-4 text-accent" />;
  if (n.includes('provision') || n.includes('snack')) return <ShoppingBag className="w-4 h-4 text-accent" />;
  if (n.includes('food') || n.includes('grocer') || n.includes('burger')) return <Utensils className="w-4 h-4 text-accent" />;
  if (n.includes('transport') || n.includes('bus') || n.includes('commute')) return <Bus className="w-4 h-4 text-accent" />;
  if (n.includes('academic') || n.includes('book')) return <Book className="w-4 h-4 text-accent" />;
  if (n.includes('health') || n.includes('toilet')) return <HeartPulse className="w-4 h-4 text-accent" />;
  if (n.includes('rent') || n.includes('utilit') || n.includes('home')) return <Home className="w-4 h-4 text-accent" />;
  if (n.includes('data') || n.includes('airtime') || n.includes('wifi')) return <Wifi className="w-4 h-4 text-accent" />;
  if (n.includes('coffee') || n.includes('drink')) return <Coffee className="w-4 h-4 text-accent" />;
  if (n.includes('outing') || n.includes('hangout') || n.includes('party')) return <PartyPopper className="w-4 h-4 text-accent" />;
  if (n.includes('cloth') || n.includes('fashion') || n.includes('wear')) return <Shirt className="w-4 h-4 text-accent" />;
  if (n.includes('tech') || n.includes('laptop')) return <Laptop className="w-4 h-4 text-accent" />;
  if (n.includes('beauty') || n.includes('cosmetic')) return <Heart className="w-4 h-4 text-accent" />;
  return <Receipt className="w-4 h-4 text-accent" />;
}

// ─── Category Donut ─────────────────────────────────────────────────────────

const CHART_COLORS = ['#F24E8E', '#F2826A', '#F2C94C', '#9B59B6', '#3498DB', '#2ECC71', '#E67E22', '#1ABC9C'];

interface CategoryRow {
  category_name: string;
  category_icon: string;
  total: number;
}

interface SpendingPanelProps {
  currency: string;
  from?: string;
  to?: string;
}

const SpendingPanel: React.FC<SpendingPanelProps> = ({ currency, from, to }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'by-category', { from, to }],
    queryFn: () => {
      let url = '/api/transactions/by-category';
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (params.toString()) url += `?${params.toString()}`;
      return fetchApi<{ categories: CategoryRow[] }>(url);
    },
  });

  const categories = data?.categories || [];
  const grandTotal = categories.reduce((sum, c) => sum + Number(c.total), 0);
  const chartData = categories.slice(0, 6).map(c => ({ name: c.category_name, value: Number(c.total) }));

  if (isLoading) {
    return (
      <div className="card-base p-5 bg-surface space-y-3">
        <div className="w-32 h-4 bg-bg rounded animate-pulse" />
        <div className="flex justify-center">
          <div className="w-32 h-32 rounded-full bg-bg animate-pulse" />
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="card-base p-5 bg-surface">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">{strings.home.spendingBreakdown}</p>
        <p className="text-xs text-text-muted text-center py-4">{strings.home.spendingBreakdownEmpty}</p>
      </div>
    );
  }

  return (
    <div className="card-base p-5 bg-surface">
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{strings.home.spendingBreakdown}</p>
        <Link
          to="/insights"
          className="text-xs font-bold text-accent hover:underline flex items-center gap-1 btn-tap"
        >
          <span>Insights</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Donut chart */}
      <div className="h-36 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={62}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatMoney(value, currency), '']}
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1.5px solid var(--color-border)',
                borderRadius: '0.75rem',
                fontSize: '11px',
                fontFamily: 'Nunito, sans-serif',
                boxShadow: 'none',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Ranked category list */}
      <div className="space-y-2">
        {categories.slice(0, 5).map((cat, i) => {
          const pct = grandTotal > 0 ? Math.round((Number(cat.total) / grandTotal) * 100) : 0;
          return (
            <div key={cat.category_name} className="flex items-center gap-3">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="text-xs font-bold text-text-main truncate">{cat.category_name}</span>
                  <span className="text-xs font-bold font-tabular text-text-muted ml-2 shrink-0">
                    {formatMoney(Number(cat.total), currency)}
                  </span>
                </div>
                <div className="w-full h-1 bg-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        to="/insights"
        className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-text-muted hover:text-accent transition-colors group btn-tap block"
      >
        <span>View food split, weekly pace & meal plan</span>
        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
};

// ─── Piggybank Widget ────────────────────────────────────────────────────────

interface PiggyWidgetProps {
  vaultBalance: number;
  vaultGoal: number;
  currency: string;
  onStashClick: () => void;
  onSetGoalClick: () => void;
}

const PiggyWidget: React.FC<PiggyWidgetProps> = ({
  vaultBalance,
  vaultGoal,
  currency,
  onStashClick,
  onSetGoalClick,
}) => {
  const hasGoal = vaultGoal > 0;
  const pct = hasGoal ? Math.min(Math.round((vaultBalance / vaultGoal) * 100), 100) : 0;
  const remaining = vaultGoal - vaultBalance;
  const goalReached = hasGoal && vaultBalance >= vaultGoal;

  return (
    <div className="card-base p-5 bg-surface">
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{strings.home.piggyTitle}</p>
        {!hasGoal && (
          <button
            onClick={onSetGoalClick}
            className="text-xs font-bold text-accent hover:text-accent-hover transition-colors btn-tap flex items-center gap-1"
          >
            Set goal
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Pig illustration */}
      <div
        className="relative flex flex-col items-center cursor-pointer group btn-tap mb-3"
        onClick={onStashClick}
      >
        <div className="relative w-full max-w-[150px] aspect-square flex items-center justify-center mx-auto">
          <div className="absolute inset-0 rounded-full bg-accent/5 group-hover:bg-accent/10 transition-colors" />
          <img
            src="/piggybank-empty-transparent.png"
            alt="Piggy Bank"
            className="absolute top-0 w-full h-full object-contain group-hover:scale-105 group-hover:-translate-y-1 transition-all duration-400"
          />
        </div>

        {/* Balance beneath pig */}
        <p className="text-2xl font-heading font-black text-accent mt-2">
          {formatMoney(vaultBalance, currency)}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-0.5">Saved in Vault</p>
      </div>

      {/* Goal progress */}
      {hasGoal ? (
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-xs font-bold">
            <span className={goalReached ? 'text-green' : 'text-text-muted'}>
              {goalReached ? strings.home.piggyGoalReached : `${pct}%`}
            </span>
            <span className="text-text-muted">{formatMoney(vaultGoal, currency)} goal</span>
          </div>
          <div className="w-full h-2 bg-bg rounded-full overflow-hidden border border-border">
            <div
              className={`h-full rounded-full transition-all duration-700 ${goalReached ? 'bg-green' : 'bg-accent'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!goalReached && (
            <p className="text-[11px] text-text-muted text-center">
              {strings.home.piggyToGo.replace('{{amount}}', formatMoney(remaining, currency))}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center pt-1">
          <p className="text-xs text-text-muted leading-snug">{strings.home.piggyNoGoalSub}</p>
        </div>
      )}

      <button
        onClick={onStashClick}
        className="w-full mt-4 py-2.5 rounded-xl border border-accent text-accent font-bold text-xs hover:bg-accent-soft transition-colors btn-tap"
      >
        {strings.home.piggyStashCta}
      </button>
    </div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const { user, settings, fetchSettings, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };
  const [isStashOpen, setIsStashOpen] = React.useState(false);
  const [showBankDisclaimer, setShowBankDisclaimer] = React.useState(false);
  const [sosIndex, setSosIndex] = React.useState<number | null>(null);
  const [paceView, setPaceView] = React.useState<'week' | 'today'>('week');
  const [selectedTx, setSelectedTx] = React.useState<Transaction | null>(null);

  const sosMessages = [
    "Hey! The economy is crazy right now and I've tried to budget, but I'm officially out of funds for the week. Could you please send an emergency top-up?",
    "SOS! I severely underestimated the cost of living this week. Any chance you could sponsor my survival until the next cycle?",
    "Greetings from your favourite broke student. My tracking app just flagged me for going into the red. I promise I'm trying! Emergency funds needed.",
    "I cooked, I tracked, I budgeted... and I'm still broke. Please help a struggling academic out with a small top-up?",
    "My financial advisor (an app called VTrack) has officially declared me bankrupt for this week. Sending this SOS for a quick bailout!",
  ];

  const { period } = usePeriod();

  // Active Budget Query
  const { data: budgetData } = useQuery({
    queryKey: ['budgets', 'active'],
    queryFn: () => fetchApi<ActiveBudgetResponse>('/api/budgets/active'),
  });

  const hasBudget = Boolean(budgetData?.has_budget && budgetData.budget);
  const activeBudget = budgetData?.budget;

  // Recent Transactions Query
  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['transactions', { limit: 5, from: period.from, to: period.to }],
    queryFn: () => {
      let url = '/api/transactions?limit=5';
      if (period.from) url += `&from=${encodeURIComponent(period.from)}`;
      if (period.to) url += `&to=${encodeURIComponent(period.to)}`;
      return fetchApi<{ transactions: Transaction[] }>(url);
    },
  });

  // Summary Query
  const { data: summaryData } = useQuery({
    queryKey: ['transactions', 'summary', { from: period.from, to: period.to }],
    queryFn: () => {
      let url = '/api/transactions/summary';
      const params = new URLSearchParams();
      if (period.from) params.set('from', period.from);
      if (period.to) params.set('to', period.to);
      if (params.toString()) url += `?${params.toString()}`;
      return fetchApi<{ income: number; expense: number; highest_expense_category: string | null }>(url);
    },
  });

  // Subscriptions Query
  const { data: subsData } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => fetchApi<SubscriptionsResponse>('/api/subscriptions'),
  });

  const upcomingAlerts = subsData?.upcoming_alerts || [];

  const renewSubMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/subscriptions/${id}/renew`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });

  const cancelSubMutation = useMutation({
    mutationFn: (id: number) => fetchApi(`/api/subscriptions/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const transactions = txData?.transactions || [];
  const expenses = summaryData?.expense || 0;
  const income = summaryData?.income || 0;

  const currency = settings?.home_currency || 'NGN';
  const vaultBalanceMajor = settings?.vault_balance || 0;
  const vaultGoalMinor = hasBudget
    ? (activeBudget?.savings_target ?? 0)
    : (settings?.vault_goal ?? 0);

  // Status and CoinBuddy mood
  const isOverBudget = hasBudget ? (activeBudget!.remaining < 0) : (expenses > income && income > 0);
  const isLow = hasBudget
    ? (!isOverBudget && activeBudget!.remaining < activeBudget!.total_amount * 0.15)
    : false;

  let mood: 'happy' | 'waving' | 'sleepy' | 'worried' | 'celebrating' = 'happy';
  if (transactions.length === 0) mood = 'sleepy';
  else if (isOverBudget) mood = 'worried';
  else if (transactions[0]?.type === 'income') mood = 'celebrating';

  const handleSOSCopy = () => {
    if (sosIndex !== null) {
      navigator.clipboard.writeText(sosMessages[sosIndex]);
    }
  };

  const cycleSOS = () => {
    setSosIndex(prev => (prev === null ? 0 : (prev + 1) % sosMessages.length));
  };

  // User greeting
  const displayName =
    user?.name?.trim() ||
    (user?.email ? user.email.split('@')[0].split('.')[0].replace(/^\w/, (c) => c.toUpperCase()) : '') ||
    '';

  return (
    <div className="min-h-screen pt-6 px-4 pb-24 md:pb-8 md:pt-10 w-full animate-in fade-in duration-300">
      <div className="max-w-5xl mx-auto">

        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-text-main flex items-center gap-2">
              <span>Hi, {displayName || 'there'}</span>
            </h1>
            <p className="text-xs text-text-muted font-medium mt-0.5">
              Here's your money overview and spending pace today
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasBudget ? (
              <Link
                to="/budget/edit"
                className="flex items-center gap-1.5 bg-surface border border-border px-3.5 py-1.5 rounded-full text-xs font-bold text-text-muted hover:text-accent hover:border-accent transition-colors btn-tap"
                title="Adjust budget settings"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
                <span>Edit budget</span>
              </Link>
            ) : (
              <Link
                to="/budget/new"
                className="flex items-center gap-1.5 bg-accent text-white px-3.5 py-1.5 rounded-full text-xs font-bold hover:bg-accent-hover transition-colors btn-tap"
                title="Create a spending budget"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Set budget</span>
              </Link>
            )}

            <div className="bg-surface border border-border px-3 py-1.5 rounded-full">
              <span className="text-xs font-bold text-accent">
                {currency === 'NGN' ? '₦ NGN' : currency}
              </span>
            </div>

            <Link
              to="/settings"
              className="p-2 text-text-muted hover:text-text-main bg-surface border border-border rounded-full transition-colors btn-tap"
              title="Settings"
            >
              <SettingsIcon className="w-4 h-4" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red hover:text-white bg-red/10 hover:bg-red border border-red/20 rounded-full transition-colors btn-tap"
              title="Log out of VTrack"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>

        {/* ── Two-column grid on desktop ── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_310px] gap-6 items-start">

          {/* ════ LEFT COLUMN: Main Money Views ════ */}
          <div className="space-y-4">

            {/* ─── Hero Card ─── */}
            {hasBudget && activeBudget ? (
              <div className="card-base p-6 bg-surface relative overflow-hidden border border-border">
                {/* Accent top border */}
                <div className="absolute top-0 left-0 w-full h-1 bg-accent" />

                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                        Remaining this cycle
                      </p>
                      <button
                        onClick={() => setShowBankDisclaimer(v => !v)}
                        className="text-text-muted hover:text-accent transition-colors btn-tap"
                        title="VTrack tracking info"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Big Hero Amount */}
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-4xl sm:text-5xl font-heading font-black tracking-tight font-tabular ${activeBudget.remaining < 0 ? 'text-red' : 'text-accent'
                          }`}
                      >
                        {formatMoney(Math.abs(activeBudget.remaining), currency)}
                      </span>
                      {activeBudget.remaining < 0 && (
                        <span className="text-xs font-bold text-red uppercase tracking-wider">
                          Over budget
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CoinBuddy on Hero Card */}
                  <div className="shrink-0 ml-3">
                    <CoinBuddy mood={mood} size={52} />
                  </div>
                </div>

                {showBankDisclaimer && (
                  <div className="mb-4 p-3 bg-accent-soft rounded-xl border border-accent/20 animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Heads up
                    </p>
                    <p className="text-xs text-accent leading-snug">
                      VTrack is a tracker, not a real bank. Remaining amounts are calculated from your budget cycle and logged activity.
                    </p>
                  </div>
                )}

                {/* Spent vs Budget Row */}
                <div className="flex justify-between items-baseline text-xs font-bold font-tabular text-text-muted mb-2">
                  <span>{formatMoney(activeBudget.spent, currency)} spent</span>
                  <span>{formatMoney(activeBudget.total_amount, currency)} budget</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-bg rounded-full overflow-hidden border border-border mb-2.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${activeBudget.remaining < 0
                        ? 'bg-red'
                        : activeBudget.percentage_used >= 90
                          ? 'bg-orange-400'
                          : 'bg-accent'
                      }`}
                    style={{ width: `${Math.min(activeBudget.percentage_used, 100)}%` }}
                  />
                </div>

                {/* Caption below bar */}
                <div className="flex justify-between items-center text-xs font-bold">
                  <span
                    className={
                      activeBudget.remaining < 0
                        ? 'text-red'
                        : activeBudget.percentage_used >= 90
                          ? 'text-orange-500'
                          : 'text-text-muted'
                    }
                  >
                    {activeBudget.status_caption}
                  </span>
                  <span className="text-text-muted text-[11px]">
                    {activeBudget.days_remaining} days left
                  </span>
                </div>
              </div>
            ) : (
              /* Unbudgeted Mode Hero Card */
              <div className="card-base p-6 bg-surface relative overflow-hidden border border-border">
                <div className="absolute top-0 left-0 w-full h-1 bg-accent/40" />

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">
                      Tracked Spending
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-heading font-black tracking-tight font-tabular text-text-main">
                        {formatMoney(expenses, currency)}
                      </span>
                      <span className="text-xs font-bold text-text-muted">spent</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <CoinBuddy mood={transactions.length === 0 ? 'sleepy' : 'happy'} size={52} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-bg rounded-xl p-3 border border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Income Logged</p>
                    <p className="text-sm font-bold font-tabular text-green">{formatMoney(income, currency)}</p>
                  </div>
                  <div className="bg-bg rounded-xl p-3 border border-border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Transactions</p>
                    <p className="text-sm font-bold font-tabular text-text-main">{transactions.length} logged</p>
                  </div>
                </div>

                <div className="p-3.5 bg-accent-soft rounded-xl border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-accent">No active budget set</p>
                    <p className="text-[11px] text-text-muted leading-tight mt-0.5">
                      You are tracking expenses freely. Set a budget anytime to keep your spending at a safe pace.
                    </p>
                  </div>
                  <Link
                    to="/budget/new"
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent-hover transition-colors btn-tap text-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Set a budget</span>
                  </Link>
                </div>
              </div>
            )}

            {/* ─── Upcoming Subscription Renewals Alert Banner ─── */}
            {upcomingAlerts.length > 0 && (
              <div className="card-base p-4 bg-surface border border-accent/30 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent-soft flex items-center justify-center text-accent">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                        Upcoming Renewals & Bills
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-white font-black">
                          {upcomingAlerts.length}
                        </span>
                      </h4>
                      <p className="text-[11px] text-text-muted">
                        Due in next 3 days · Reserved from daily safe spend
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/subscriptions"
                    className="text-xs font-bold text-accent hover:text-accent-hover flex items-center gap-1 transition-colors btn-tap"
                  >
                    Manage
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-2 pt-1">
                  {upcomingAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 bg-bg rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-accent shrink-0">
                          <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-text-main truncate">
                              {alert.name}
                            </span>
                            {alert.is_renewing_today ? (
                              <span className="px-2 py-0.5 rounded-full bg-red/10 text-red text-[10px] font-bold">
                                Renews today!
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent text-[10px] font-bold">
                                Renews in {alert.days_until_renewal}d
                              </span>
                            )}
                            {alert.is_trial && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold">
                                Trial ends soon
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-text-muted mt-0.5 font-tabular">
                            {formatMoney(alert.amount, alert.currency || currency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => cancelSubMutation.mutate(alert.id)}
                          disabled={cancelSubMutation.isPending}
                          className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-red hover:border-red/30 text-xs font-bold transition-colors btn-tap"
                          title="Cancel subscription"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => renewSubMutation.mutate(alert.id)}
                          disabled={renewSubMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover text-xs font-bold transition-colors btn-tap flex items-center gap-1"
                          title="Confirm renewal and log expense"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Keep & Log</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Dual Sub-Cards (Matches Reference Hierarchy) ─── */}
            <div className="grid grid-cols-2 gap-3">

              {/* Card 1: Safe Spending Pace Card with [ Today | This week ] Toggle */}
              {hasBudget && activeBudget ? (
                <div className="card-base p-4 bg-surface flex flex-col justify-between">
                  <div>
                    {/* Header with mini toggle */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <Calendar className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="text-xs font-bold text-text-muted hidden sm:inline">
                          {paceView === 'today' ? 'Today' : 'This week'}
                        </span>
                      </div>
                      <div className="flex bg-bg rounded-lg p-0.5 border border-border">
                        <button
                          type="button"
                          onClick={() => setPaceView('today')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors btn-tap ${paceView === 'today'
                              ? 'bg-accent text-white'
                              : 'text-text-muted hover:text-text-main'
                            }`}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaceView('week')}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors btn-tap ${paceView === 'week'
                              ? 'bg-accent text-white'
                              : 'text-text-muted hover:text-text-main'
                            }`}
                        >
                          Week
                        </button>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="mt-1">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                        {paceView === 'today' ? 'Spent today' : 'Spent this week'}
                      </p>
                      <p className="text-lg sm:text-xl font-heading font-black font-tabular text-text-main mt-0.5">
                        {paceView === 'today'
                          ? formatMoney(activeBudget.daily.spent, currency)
                          : formatMoney(activeBudget.weekly.spent, currency)}
                      </p>
                    </div>
                  </div>

                  {/* Subtext */}
                  <div className="mt-3 pt-2 border-t border-border/60">
                    <p className="text-xs text-text-muted font-bold font-tabular">
                      of{' '}
                      {paceView === 'today'
                        ? formatMoney(activeBudget.daily.limit, currency)
                        : formatMoney(activeBudget.weekly.limit, currency)}{' '}
                      guide
                    </p>
                    <p className="text-[10px] font-semibold text-accent mt-0.5 truncate">
                      {paceView === 'today'
                        ? activeBudget.daily.remaining >= 0
                          ? `${formatMoney(activeBudget.daily.remaining, currency)} safe to spend today`
                          : 'Exceeded today’s pace'
                        : activeBudget.weekly.remaining >= 0
                          ? `${formatMoney(activeBudget.weekly.remaining, currency)} safe to spend this week`
                          : 'Exceeded weekly pace'}
                    </p>
                    {activeBudget.upcoming_subscriptions_reserved && activeBudget.upcoming_subscriptions_reserved > 0 ? (
                      <p className="text-[10px] text-text-muted mt-0.5 font-medium">
                        ({formatMoney(activeBudget.upcoming_subscriptions_reserved, currency)} bills reserved)
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                /* Unbudgeted Card 1 */
                <div className="card-base p-4 bg-surface flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-text-muted mb-2">
                      <Calendar className="w-3.5 h-3.5 text-accent" />
                      <span className="text-xs font-bold">This period</span>
                    </div>
                    <p className="text-lg sm:text-xl font-heading font-black font-tabular text-text-main mt-1">
                      {formatMoney(expenses, currency)}
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-border/60">
                    <p className="text-xs text-text-muted font-bold">
                      {transactions.length} transactions
                    </p>
                  </div>
                </div>
              )}

              {/* Card 2: Savings Goal / Piggybank Card */}
              <div
                className="card-base p-4 bg-surface flex flex-col justify-between cursor-pointer hover:border-accent/50 transition-colors btn-tap group"
                onClick={() => setIsStashOpen(true)}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-text-muted">
                      <PiggyBank className="w-3.5 h-3.5 text-accent" />
                      <span className="text-xs font-bold">Savings goal</span>
                    </div>
                    <span className="text-[10px] font-bold text-accent group-hover:underline">
                      Manage
                    </span>
                  </div>
                  <p className="text-lg sm:text-xl font-heading font-black font-tabular text-text-main mt-1">
                    {formatMoney(vaultBalanceMajor, currency)}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border/60">
                  <p className="text-xs text-text-muted font-bold font-tabular">
                    of {formatMoney(vaultGoalMinor, currency)}
                  </p>
                  <p className="text-[10px] font-semibold text-accent mt-0.5">
                    {vaultGoalMinor > 0 && vaultBalanceMajor >= vaultGoalMinor
                      ? 'Goal reached!'
                      : 'Tap to stash or withdraw'}
                  </p>
                </div>
              </div>

            </div>

            {/* ─── Over-Budget Alert Banner ─── */}
            {(isOverBudget || isLow) && (
              <div className={`card-base p-4 flex gap-3 items-start border ${isOverBudget ? 'bg-red/10 border-red/20' : 'bg-orange-50 border-orange-200'
                } animate-in slide-in-from-bottom-2`}>
                <div className="shrink-0 pt-0.5">
                  <CoinBuddy mood="worried" size={40} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isOverBudget ? 'text-red' : 'text-orange-600'
                    }`}>
                    {isOverBudget ? 'Over Budget Warning' : 'Running Low Warning'}
                  </p>
                  <p className="text-xs font-semibold text-text-main leading-snug mb-2">
                    {isOverBudget
                      ? <>You are exceeding your planned limit. High spend on <span className="text-red font-bold">{summaryData?.highest_expense_category || 'expenses'}</span>.</>
                      : <>You have used most of your cycle budget. Pace remaining spend carefully.</>
                    }
                  </p>

                  {isOverBudget && (
                    <div>
                      {sosIndex === null ? (
                        <button
                          onClick={cycleSOS}
                          className="px-3 py-1.5 bg-red text-white rounded-lg text-xs font-bold hover:bg-red/80 transition-colors btn-tap"
                        >
                          Draft SOS Message
                        </button>
                      ) : (
                        <div className="p-3 bg-surface rounded-xl border border-red/20 animate-in fade-in">
                          <p className="text-xs text-text-main italic mb-2">"{sosMessages[sosIndex]}"</p>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSOSCopy}
                              className="flex-1 py-1.5 bg-red text-white rounded-lg text-xs font-bold btn-tap"
                            >
                              Copy
                            </button>
                            <button
                              onClick={cycleSOS}
                              className="px-3 py-1.5 bg-red/10 text-red rounded-lg text-xs font-bold btn-tap"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Recent Expenses Feed (Matches Reference Hierarchy) ─── */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-heading font-black text-text-main">
                  Recent expenses
                </h2>
                <Link
                  to="/activity"
                  className="text-xs font-bold text-accent hover:text-accent-hover btn-tap"
                >
                  View all
                </Link>
              </div>

              {txLoading ? (
                <div className="card-base bg-surface divide-y divide-border overflow-hidden">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="p-3.5 flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-xl bg-bg animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="w-28 h-3.5 bg-bg rounded animate-pulse" />
                        <div className="w-16 h-3 bg-bg rounded animate-pulse" />
                      </div>
                      <div className="w-16 h-4 bg-bg rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="card-base p-8 text-center bg-surface border border-border flex flex-col items-center justify-center">
                  <CoinBuddy mood="sleepy" size={64} speech="No expenses recorded yet." />
                  <Link
                    to="/add"
                    className="mt-4 px-4 py-2 text-xs font-bold text-accent bg-accent-soft border border-accent/20 rounded-xl hover:bg-accent/20 transition-colors btn-tap"
                  >
                    + Log an expense
                  </Link>
                </div>
              ) : (
                <div className="card-base bg-surface divide-y divide-border overflow-hidden border border-border">
                  {transactions.map(tx => {
                    const primaryTitle = tx.note || tx.category_name || (tx.type === 'expense' ? 'Expense' : 'Income');
                    const secondaryTitle = tx.note ? (tx.category_name || 'General') : smartTimestamp(tx.occurred_at);

                    return (
                      <div
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="p-3.5 flex justify-between items-center hover:bg-surface-hover transition-colors cursor-pointer btn-tap group"
                        title="Tap to edit or delete"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Clean icon container matching reference design */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${tx.type === 'expense'
                              ? 'bg-accent-soft border-accent/20'
                              : 'bg-green-soft border-green/20'
                            }`}>
                            {getCategoryIcon(tx.category_name || tx.note)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text-main truncate leading-tight">
                              {primaryTitle}
                            </p>
                            <p className="text-xs text-text-muted mt-0.5 truncate">
                              {secondaryTitle}
                            </p>
                          </div>
                        </div>

                        <p className={`text-sm font-bold font-tabular shrink-0 ml-3 ${tx.type === 'expense' ? 'text-text-main' : 'text-green'
                          }`}>
                          {tx.type === 'expense' ? '' : '+'}
                          {formatMoneyFull(tx.amount, currency)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* ════ RIGHT COLUMN (desktop persistent widgets) ════ */}
          <div className="space-y-4">

            {/* Piggybank widget */}
            <PiggyWidget
              vaultBalance={vaultBalanceMajor}
              vaultGoal={vaultGoalMinor}
              currency={currency}
              onStashClick={() => setIsStashOpen(true)}
              onSetGoalClick={() => navigate('/settings')}
            />

            {/* Category Envelopes Breakdown if active budget has allocations */}
            {hasBudget && activeBudget?.categories && activeBudget.categories.length > 0 && (
              <div className="card-base p-5 bg-surface border border-border">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Category Budgets
                  </p>
                  <Link
                    to="/budget/edit"
                    className="text-[10px] font-bold text-accent hover:underline"
                  >
                    Adjust
                  </Link>
                </div>

                <div className="space-y-2.5">
                  {activeBudget.categories.slice(0, 5).map(cat => {
                    const pct = Math.min(Math.round((cat.spent_amount / cat.allocated_amount) * 100), 100);
                    return (
                      <div key={cat.category_id} className="space-y-1">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-bold text-text-main truncate max-w-[130px]">
                            {cat.category_name}
                          </span>
                          <span className="font-bold font-tabular text-text-muted">
                            {formatMoney(cat.spent_amount, currency)} / {formatMoney(cat.allocated_amount, currency)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden border border-border">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-red' : pct >= 80 ? 'bg-orange-400' : 'bg-accent'
                              }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Spending Donut Breakdown */}
            <SpendingPanel currency={currency} from={period.from} to={period.to} />

          </div>

        </div>

        {/* Account & Session Footer */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-text-muted gap-3">
          <div className="flex items-center gap-2">
            <span>Signed in as <strong className="text-text-main font-bold">{user?.email || 'Student'}</strong></span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/settings" className="hover:text-text-main font-semibold transition-colors">Settings</Link>
            <span>•</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-red hover:underline font-bold flex items-center gap-1 btn-tap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>

      {isStashOpen && (
        <StashSheet
          onClose={() => {
            setIsStashOpen(false);
            fetchSettings();
          }}
        />
      )}

      {selectedTx && (
        <EditTransactionSheet
          transaction={selectedTx}
          isOpen={Boolean(selectedTx)}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </div>
  );
};
