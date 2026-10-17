import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Plus,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Clock,
  RotateCcw,
  Film,
  Music,
  Tv,
  Bot,
  Cloud,
  Pen,
  Palette,
  FileText,
  Globe,
  Grid,
  Monitor,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchApi,
  SubscriptionsResponse,
  SubscriptionCatalogItem,
  UserSubscription,
} from '../api/client';
import { CoinBuddy } from '../components/CoinBuddy';

function formatMoney(amountMinor: number, currency: string = 'NGN'): string {
  const major = amountMinor / 100;
  const symbol = currency === 'NGN' ? '₦' : currency + ' ';
  return `${symbol}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(major)}`;
}

function getServiceIcon(iconKey?: string, name?: string) {
  const k = (iconKey || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (k === 'tv' || n.includes('netflix') || n.includes('showmax')) return <Tv className="w-5 h-5 text-accent" />;
  if (k === 'music' || n.includes('spotify') || n.includes('apple music') || n.includes('boomplay')) return <Music className="w-5 h-5 text-accent" />;
  if (k === 'youtube' || n.includes('youtube')) return <Film className="w-5 h-5 text-accent" />;
  if (k === 'bot' || k === 'sparkles' || n.includes('chatgpt') || n.includes('claude')) return <Bot className="w-5 h-5 text-accent" />;
  if (k === 'cloud' || n.includes('icloud') || n.includes('google one')) return <Cloud className="w-5 h-5 text-accent" />;
  if (k === 'pen' || n.includes('grammarly')) return <Pen className="w-5 h-5 text-accent" />;
  if (k === 'palette' || n.includes('canva')) return <Palette className="w-5 h-5 text-accent" />;
  if (k === 'file-text' || n.includes('notion')) return <FileText className="w-5 h-5 text-accent" />;
  if (k === 'globe' || n.includes('duolingo')) return <Globe className="w-5 h-5 text-accent" />;
  if (k === 'grid' || n.includes('microsoft')) return <Grid className="w-5 h-5 text-accent" />;
  if (k === 'monitor' || n.includes('dstv') || n.includes('gotv')) return <Monitor className="w-5 h-5 text-accent" />;
  return <CreditCard className="w-5 h-5 text-accent" />;
}

export const Subscriptions: React.FC = () => {
  const queryClient = useQueryClient();
  const { settings } = useAuth();
  const currency = settings?.home_currency || 'NGN';

  const [activeTab, setActiveTab] = useState<'active' | 'trials' | 'cancelled'>('active');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<UserSubscription | null>(null);

  // Form states
  const [selectedCatalog, setSelectedCatalog] = useState<SubscriptionCatalogItem | null>(null);
  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsOn, setTrialEndsOn] = useState('');

  // Fetch subscriptions
  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => fetchApi<SubscriptionsResponse>('/api/subscriptions'),
  });

  // Fetch catalog
  const { data: catalogData } = useQuery({
    queryKey: ['subscriptions', 'catalog'],
    queryFn: () => fetchApi<{ catalog: SubscriptionCatalogItem[] }>('/api/subscriptions/catalog'),
  });

  const catalog = catalogData?.catalog || [];
  const summary = data?.summary || { monthly_total: 0, yearly_total: 0, active_count: 0 };
  const upcomingAlerts = data?.upcoming_alerts || [];
  const subscriptions = data?.subscriptions || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body: any) =>
      fetchApi('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      fetchApi(`/api/subscriptions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/api/subscriptions/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const renewMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/api/subscriptions/${id}/renew`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/api/subscriptions/${id}/cancel`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) =>
      fetchApi(`/api/subscriptions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'active' }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const openAdd = () => {
    setSelectedCatalog(null);
    setName('');
    setAmountStr('');
    setBillingDay(new Date().getDate().toString());
    setCycle('monthly');
    setIsTrial(false);
    setTrialEndsOn('');
    setEditingSub(null);
    setIsAddOpen(true);
  };

  const openEdit = (sub: UserSubscription) => {
    setEditingSub(sub);
    setSelectedCatalog(null);
    setName(sub.name);
    setAmountStr(String(sub.amount / 100));
    setBillingDay(String(sub.billing_day));
    setCycle(sub.cycle);
    setIsTrial(sub.is_trial);
    setTrialEndsOn(sub.trial_ends_on ? sub.trial_ends_on.split('T')[0] : '');
    setIsAddOpen(true);
  };

  const closeForm = () => {
    setIsAddOpen(false);
    setEditingSub(null);
    setSelectedCatalog(null);
  };

  const handleSelectCatalogItem = (item: SubscriptionCatalogItem) => {
    setSelectedCatalog(item);
    setName(item.name);
    setAmountStr(String(item.default_amount / 100));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const major = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(major) || major <= 0) return;
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      amount: Math.round(major * 100),
      currency,
      billing_day: parseInt(billingDay, 10) || 1,
      cycle,
      trial_ends_on: isTrial && trialEndsOn ? trialEndsOn : null,
      catalog_id: selectedCatalog ? selectedCatalog.id : editingSub?.catalog_id || null,
      icon_key: selectedCatalog ? selectedCatalog.icon_key : editingSub?.icon_key || 'credit-card',
    };

    if (editingSub) {
      updateMutation.mutate({ id: editingSub.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Filter subscriptions according to active tab
  const filteredSubs = subscriptions.filter((s) => {
    if (activeTab === 'trials') return s.is_trial && s.status !== 'cancelled';
    if (activeTab === 'cancelled') return s.status === 'cancelled';
    return s.status === 'active' || s.is_trial;
  });

  return (
    <div className="w-full min-h-screen bg-bg text-text-main pb-24 md:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 md:pt-8 space-y-6">

        {/* ── Top Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-black text-text-main tracking-tight">
              Subscriptions & Bills
            </h1>
            <p className="text-xs md:text-sm text-text-muted mt-1">
              Catalog picker, renewal reminders, free trial alerts & daily spend deductions
            </p>
          </div>

          <button
            onClick={openAdd}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white font-bold text-xs hover:bg-accent-hover transition-colors btn-tap shadow-none"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            <span>Add Subscription</span>
          </button>
        </div>

        {/* ── Monthly & Yearly Summary Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Monthly Total */}
          <div className="card-base p-5 bg-surface border border-border space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Monthly Total
            </span>
            <p className="text-2xl font-heading font-black text-text-main font-tabular">
              {formatMoney(summary.monthly_total, currency)}
            </p>
            <p className="text-xs text-text-muted">
              Estimated per-month subscription spend
            </p>
          </div>

          {/* Yearly Total */}
          <div className="card-base p-5 bg-surface border border-border space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Yearly Total
            </span>
            <p className="text-2xl font-heading font-black text-text-main font-tabular">
              {formatMoney(summary.yearly_total, currency)}
            </p>
            <p className="text-xs text-text-muted">
              Over 12 months across active services
            </p>
          </div>

          {/* Active Subscriptions */}
          <div className="card-base p-5 bg-surface border border-border space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Active Services
            </span>
            <p className="text-2xl font-heading font-black text-accent font-tabular">
              {summary.active_count}
            </p>
            <p className="text-xs text-text-muted">
              Deducted automatically from your daily pace
            </p>
          </div>
        </div>

        {/* ── Upcoming Renewals Banner (Home Alerts Preview) ── */}
        {upcomingAlerts.length > 0 && (
          <div className="card-base p-5 bg-accent-soft/70 border border-accent/30 space-y-3">
            <div className="flex items-center gap-2 text-accent">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <h2 className="text-xs font-heading font-black uppercase tracking-wider text-accent">
                Upcoming Renewal Alerts (Next 3 Days)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-surface rounded-xl p-3.5 border border-accent/20 flex items-center justify-between gap-3 shadow-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0 border border-accent/20">
                      {getServiceIcon(alert.icon_key, alert.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-text-main truncate">
                        {alert.name}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {alert.is_renewing_today ? (
                          <span className="text-accent font-bold">Renews today!</span>
                        ) : (
                          <span>Renews in <strong className="text-text-main">{alert.days_until_renewal} days</strong></span>
                        )} · {formatMoney(alert.amount, alert.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => renewMutation.mutate(alert.id)}
                      disabled={renewMutation.isPending}
                      className="px-2.5 py-1.5 rounded-lg bg-accent text-white font-bold text-xs hover:bg-accent-hover btn-tap transition-colors"
                      title="Keep and log transaction"
                    >
                      Keep & Log
                    </button>
                    <button
                      onClick={() => cancelMutation.mutate(alert.id)}
                      disabled={cancelMutation.isPending}
                      className="px-2.5 py-1.5 rounded-lg bg-bg border border-border text-text-muted hover:text-red hover:border-red font-bold text-xs btn-tap transition-colors"
                      title="Cancel this subscription"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Subscriptions Feed & Management ── */}
        <div className="space-y-4">
          {/* Tabs Filter */}
          <div className="flex items-center gap-1.5 bg-surface border border-border p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all btn-tap ${
                activeTab === 'active'
                  ? 'bg-accent text-white shadow-none'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Active ({subscriptions.filter((s) => s.status === 'active' || s.is_trial).length})
            </button>
            <button
              onClick={() => setActiveTab('trials')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all btn-tap ${
                activeTab === 'trials'
                  ? 'bg-accent text-white shadow-none'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Free Trials ({subscriptions.filter((s) => s.is_trial && s.status !== 'cancelled').length})
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all btn-tap ${
                activeTab === 'cancelled'
                  ? 'bg-accent text-white shadow-none'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              Cancelled ({subscriptions.filter((s) => s.status === 'cancelled').length})
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
              <div className="card-base p-5 bg-surface h-36 border border-border" />
              <div className="card-base p-5 bg-surface h-36 border border-border" />
              <div className="card-base p-5 bg-surface h-36 border border-border" />
            </div>
          ) : filteredSubs.length === 0 ? (
            <div className="card-base p-12 text-center bg-surface border border-border flex flex-col items-center justify-center space-y-4">
              <CoinBuddy mood="sleepy" size={80} speech="No subscriptions in this view!" />
              <p className="text-xs text-text-muted max-w-sm">
                {activeTab === 'cancelled'
                  ? 'You have no cancelled subscriptions.'
                  : activeTab === 'trials'
                  ? 'You have no active free trials.'
                  : 'Add your streaming, music, AI, and utility subscriptions to stay on top of renewals.'}
              </p>
              {activeTab === 'active' && (
                <button
                  onClick={openAdd}
                  className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:bg-accent-hover btn-tap transition-colors"
                >
                  Add a Subscription
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSubs.map((sub) => {
                const nextDateFormatted = new Date(sub.next_renewal_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={sub.id}
                    className={`card-base p-5 bg-surface border flex flex-col justify-between transition-all ${
                      sub.status === 'cancelled'
                        ? 'border-border opacity-70'
                        : sub.is_renewing_today
                        ? 'border-accent shadow-sm'
                        : sub.is_renewing_soon
                        ? 'border-accent/50'
                        : 'border-border'
                    }`}
                  >
                    <div>
                      {/* Top Bar: Icon + Status Pill */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl bg-bg text-accent flex items-center justify-center shrink-0 border border-border">
                          {getServiceIcon(sub.icon_key, sub.name)}
                        </div>

                        {sub.status === 'cancelled' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-bg text-text-muted border border-border">
                            Cancelled
                          </span>
                        ) : sub.is_trial ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">
                            {sub.trial_days_remaining !== null
                              ? `Trial: ${sub.trial_days_remaining}d left`
                              : 'Free Trial'}
                          </span>
                        ) : sub.is_renewing_today ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent-soft text-accent border border-accent/20 animate-pulse">
                            Renews Today
                          </span>
                        ) : sub.is_renewing_soon ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-accent-soft text-accent border border-accent/20">
                            Due in {sub.days_until_renewal}d
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-text-muted bg-bg border border-border">
                            Day {sub.billing_day}
                          </span>
                        )}
                      </div>

                      {/* Name & Amount */}
                      <h3 className="text-base font-heading font-black text-text-main truncate">
                        {sub.name}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        <strong className="text-sm font-black text-text-main font-tabular">
                          {formatMoney(sub.amount, sub.currency)}
                        </strong>{' '}
                        / {sub.cycle === 'yearly' ? 'year' : 'month'}
                      </p>

                      {/* Renewal Info */}
                      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-accent" />
                          <span>Next: {nextDateFormatted}</span>
                        </span>
                        {sub.days_until_renewal > 0 && sub.status !== 'cancelled' && (
                          <span className="text-[11px] font-bold text-text-muted">
                            ({sub.days_until_renewal} days away)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(sub)}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg btn-tap"
                          title="Edit subscription"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete ${sub.name} permanently?`)) {
                              deleteMutation.mutate(sub.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-text-muted hover:text-red hover:bg-red/10 btn-tap"
                          title="Delete subscription"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {sub.status === 'cancelled' ? (
                        <button
                          onClick={() => reactivateMutation.mutate(sub.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg border border-border text-xs font-bold text-text-main hover:border-accent hover:text-accent btn-tap"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reactivate</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => cancelMutation.mutate(sub.id)}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold text-text-muted hover:text-red btn-tap"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => renewMutation.mutate(sub.id)}
                            disabled={renewMutation.isPending}
                            className="px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover btn-tap transition-colors"
                          >
                            Keep & Log
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Add / Edit Modal ── */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base p-6 bg-surface border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-heading font-black text-text-main">
                {editingSub ? 'Edit Subscription' : 'Add Subscription'}
              </h2>
              <button
                onClick={closeForm}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-main btn-tap"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Catalog Selector if adding new */}
            {!editingSub && catalog.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-muted block">
                  Quick Select from Popular Services
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 border border-border rounded-xl bg-bg">
                  {catalog.map((item) => {
                    const isSelected = selectedCatalog?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectCatalogItem(item)}
                        className={`p-2 rounded-xl flex flex-col items-center text-center transition-all btn-tap ${
                          isSelected
                            ? 'bg-accent text-white border border-accent shadow-none'
                            : 'bg-surface hover:bg-surface-hover border border-border text-text-main'
                        }`}
                      >
                        <div className={isSelected ? 'text-white' : 'text-accent'}>
                          {getServiceIcon(item.icon_key, item.name)}
                        </div>
                        <span className="text-[10px] font-bold mt-1 truncate w-full">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-bold text-text-muted block mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Spotify, Netflix, Campus Wi-Fi"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-bold text-xs focus:outline-none focus:border-accent"
                />
              </div>

              {/* Price & Cycle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    Price ({currency})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-muted text-xs">
                      {currency === 'NGN' ? '₦' : currency}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      placeholder="e.g. 1300"
                      required
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-bg text-text-main font-bold text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted block mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-bold text-xs focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Billing Day of Month */}
              <div>
                <label className="text-xs font-bold text-text-muted block mb-1">
                  Billing Day of the Month (1 – 31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={billingDay}
                  onChange={(e) => setBillingDay(e.target.value)}
                  placeholder="e.g. 15"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-text-main font-bold text-xs focus:outline-none focus:border-accent"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Day of the month you get billed or when renewal occurs.
                </p>
              </div>

              {/* Free Trial Toggle */}
              <div className="pt-2 border-t border-border space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isTrial}
                    onChange={(e) => setIsTrial(e.target.checked)}
                    className="w-4 h-4 accent-accent rounded"
                  />
                  <span className="text-xs font-bold text-text-main">
                    This is currently on a Free Trial
                  </span>
                </label>

                {isTrial && (
                  <div className="pl-6 space-y-1">
                    <label className="text-[11px] font-bold text-text-muted block">
                      When does the free trial expire?
                    </label>
                    <input
                      type="date"
                      value={trialEndsOn}
                      onChange={(e) => setTrialEndsOn(e.target.value)}
                      required={isTrial}
                      className="px-3.5 py-2 rounded-xl border border-border bg-bg text-text-main font-semibold text-xs focus:outline-none focus:border-accent"
                    />
                    <p className="text-[10px] text-text-muted">
                      VTrack will alert you before the trial ends so you can cancel or keep it!
                    </p>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2.5 rounded-xl border border-border bg-bg text-text-muted font-bold text-xs hover:text-text-main btn-tap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-white font-bold text-xs hover:bg-accent-hover transition-colors btn-tap"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingSub
                    ? 'Update Subscription'
                    : 'Add Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
