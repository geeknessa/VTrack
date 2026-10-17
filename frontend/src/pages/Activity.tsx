import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { fetchApi, Transaction } from '../api/client';
import { strings } from '../i18n/strings';
import { CoinBuddy } from '../components/CoinBuddy';
import { usePeriod } from '../context/PeriodContext';
import { ActivityPeriodFilter, SelectedPeriod, DurationType } from '../components/ActivityPeriodFilter';
import { Calendar, Receipt, Download, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EditTransactionSheet } from '../components/EditTransactionSheet';
import { StatementReceiptScannerModal } from '../components/StatementReceiptScannerModal';
import { exportFinancialStatementPdf } from '../utils/pdfExport';

const Subscriptions = React.lazy(() => import('./Subscriptions').then(m => ({ default: m.Subscriptions })));

export const Activity: React.FC = () => {
  const { user, settings } = useAuth();
  const { period: globalPeriod, mode: globalMode } = usePeriod();

  const [activityView, setActivityView] = useState<'transactions' | 'subscriptions'>('transactions');

  const getInitialDuration = (): DurationType => {
    if (globalMode === 'weekly') return 'weekly';
    if (globalMode === 'monthly') return 'monthly';
    if (globalMode === 'yearly') return 'yearly';
    if (globalMode === 'custom') return 'custom';
    if (globalMode === 'all_time') return 'all_time';
    return 'cycle';
  };

  const [duration, setDuration] = useState<DurationType>(getInitialDuration);

  // Local filter period on Activity page, initialized from global active cycle
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod>(() => ({
    from: globalPeriod.from,
    to: globalPeriod.to,
    label: globalPeriod.label,
  }));

  const handleResetToAllTime = () => {
    setDuration('all_time');
    setSelectedPeriod({ from: undefined, to: undefined, label: 'All Time' });
  };

  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await exportFinancialStatementPdf(user, settings);
    } catch (err: any) {
      alert(err?.message || 'Failed to generate PDF statement.');
    } finally {
      setIsExporting(false);
    }
  };

  const { data: txData, isLoading } = useQuery({
    queryKey: ['transactions', { type: filter === 'all' ? undefined : filter, from: selectedPeriod.from, to: selectedPeriod.to }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('type', filter);
      if (selectedPeriod.from) params.set('from', selectedPeriod.from);
      if (selectedPeriod.to) params.set('to', selectedPeriod.to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return fetchApi<{ transactions: Transaction[] }>(`/api/transactions${qs}`);
    },
  });

  const { data: summaryData } = useQuery({
    queryKey: ['transactions', 'summary', { from: selectedPeriod.from, to: selectedPeriod.to }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedPeriod.from) params.set('from', selectedPeriod.from);
      if (selectedPeriod.to) params.set('to', selectedPeriod.to);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return fetchApi<{ income: number; expense: number }>(`/api/transactions/summary${qs}`);
    },
  });

  const transactions = txData?.transactions || [];

  // Group by date string (e.g. "Sat, Oct 3")
  const grouped = transactions.reduce((acc, tx) => {
    const dateStr = new Date(tx.occurred_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const totalIn = summaryData?.income || 0;
  const totalOut = summaryData?.expense || 0;
  const net = totalIn - totalOut;

  const formatMoney = (amountMinor: number) => {
    const major = amountMinor / 100;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(major);
  };

  const curr = settings?.home_currency === 'NGN' ? '₦' : (settings?.home_currency || '₦');

  return (
    <div className="min-h-screen pt-8 px-4 pb-24 md:pb-12 md:pt-12 w-full animate-in fade-in duration-300">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-heading font-bold text-text-main">{strings.activity.title}</h1>
            <p className="text-xs text-text-muted mt-1">
              Showing transactions for <strong className="text-text-main">{selectedPeriod.label}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-1.5 bg-accent text-white px-3.5 py-1.5 rounded-full text-xs font-bold hover:bg-accent-hover transition-colors btn-tap shadow-sm"
              title="Upload bank statements, transfer alerts, or receipts"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Scan Receipt / Statement</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 bg-surface border border-border px-3.5 py-1.5 rounded-full text-xs font-bold text-text-muted hover:text-accent hover:border-accent transition-colors btn-tap disabled:opacity-50"
              title="Download your official financial statement as a fine PDF"
            >
              <Download className="w-3.5 h-3.5 text-accent" />
              <span>{isExporting ? 'Generating PDF...' : 'Download Statement (PDF)'}</span>
            </button>
            <Link
              to="/settings"
              className="flex items-center gap-1.5 bg-surface border border-border px-3.5 py-1.5 rounded-full text-xs font-bold text-text-muted hover:text-accent hover:border-accent transition-colors btn-tap"
              title="Configure default cycle in Settings"
            >
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Cycle Settings</span>
            </Link>
          </div>
        </div>

        {/* ── Segmented View Switcher: Transactions vs Recurring Bills ── */}
        <div className="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setActivityView('transactions')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all btn-tap ${
              activityView === 'transactions'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            Transactions
          </button>
          <button
            type="button"
            onClick={() => setActivityView('subscriptions')}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all btn-tap flex items-center gap-2 ${
              activityView === 'subscriptions'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Recurring Bills</span>
          </button>
        </div>

        {activityView === 'subscriptions' ? (
          <React.Suspense fallback={
            <div className="w-full py-12 flex justify-center items-center">
              <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            <Subscriptions isEmbedded={true} />
          </React.Suspense>
        ) : (
          <>
            {/* ── Interactive Duration Dropdown & Quick Pills ── */}
            <ActivityPeriodFilter
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              duration={duration}
              onDurationChange={setDuration}
            />

        {/* ── Responsive 2-column on desktop ── */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] gap-6 items-start">

          {/* ════ LEFT COLUMN: Controls & Summaries ════ */}
          <div className="space-y-5">
            {/* Filter Toggle */}
            <div className="card-base p-1.5 bg-surface border border-border">
              <div className="grid grid-cols-3 gap-1 bg-bg rounded-lg p-1 border border-border">
                {(['all', 'expense', 'income'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`py-2 text-[11px] uppercase tracking-wider font-bold rounded-md transition-colors btn-tap ${
                      filter === f
                        ? 'bg-surface text-accent border border-border shadow-none'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Net Summary Cards */}
            <div className="card-base p-4 bg-surface border border-border space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Summary</p>
              
              <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
                <div className="bg-bg rounded-xl p-3 border border-border">
                  <p className="text-[10px] uppercase font-bold text-text-muted">{strings.activity.netSummaryIn}</p>
                  <p className="text-sm font-bold font-tabular text-green mt-0.5">{curr}{formatMoney(totalIn)}</p>
                </div>

                <div className="bg-bg rounded-xl p-3 border border-border">
                  <p className="text-[10px] uppercase font-bold text-text-muted">{strings.activity.netSummaryOut}</p>
                  <p className="text-sm font-bold font-tabular text-text-main mt-0.5">{curr}{formatMoney(totalOut)}</p>
                </div>

                <div className="bg-bg rounded-xl p-3 border border-border">
                  <p className="text-[10px] uppercase font-bold text-text-muted">{strings.activity.netSummaryNet}</p>
                  <p className={`text-sm font-bold font-tabular mt-0.5 ${net < 0 ? 'text-red' : 'text-green'}`}>
                    {curr}{formatMoney(net)}
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Window Card */}
            <div className="card-base p-4 bg-surface border border-border space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Viewing Range</p>
              <p className="text-xs font-bold text-text-main">{selectedPeriod.label}</p>
              <button
                onClick={handleResetToAllTime}
                className="text-xs font-bold text-accent hover:underline pt-1 inline-block btn-tap"
              >
                Reset to All Time
              </button>
            </div>
          </div>

          {/* ════ RIGHT COLUMN: Feed ════ */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                Transactions ({transactions.length})
              </h2>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <div className="card-base p-4 h-20 bg-surface animate-pulse border border-border" />
                <div className="card-base p-4 h-20 bg-surface animate-pulse border border-border" />
                <div className="card-base p-4 h-20 bg-surface animate-pulse border border-border" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="card-base p-10 text-center bg-surface border border-border flex flex-col items-center justify-center">
                <CoinBuddy mood="sleepy" size={80} speech={strings.period.emptyInPeriod} />
                <button
                  onClick={handleResetToAllTime}
                  className="mt-4 px-4 py-2 text-xs font-bold text-accent bg-accent-soft border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors btn-tap"
                >
                  {strings.period.viewAllTime}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped).map(([dateLabel, txs]) => (
                  <div key={dateLabel} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted pl-1">{dateLabel}</h3>
                    <div className="card-base bg-surface border border-border divide-y divide-border overflow-hidden">
                      {txs.map((tx) => (
                        <div
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="p-4 flex justify-between items-center hover:bg-surface-hover transition-colors cursor-pointer btn-tap group"
                          title="Tap to edit or delete"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                              tx.type === 'expense' ? 'bg-accent-soft text-accent' : 'bg-green-soft text-green'
                            }`}>
                              {tx.category_name ? tx.category_name.charAt(0).toUpperCase() : (tx.type === 'expense' ? 'E' : 'I')}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text-main leading-tight">
                                {tx.category_name || (tx.type === 'expense' ? 'Expense' : 'Income')}
                              </p>
                              {tx.note && <p className="text-xs text-text-muted mt-0.5">{tx.note}</p>}
                            </div>
                          </div>
                          <div className={`text-right font-tabular font-bold text-sm shrink-0 ml-2 ${
                            tx.type === 'expense' ? 'text-text-main' : 'text-green'
                          }`}>
                            {tx.type === 'expense' ? '-' : '+'}
                            {curr}
                            {formatMoney(tx.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
          </>
        )}
      </div>

      {selectedTx && (
        <EditTransactionSheet
          transaction={selectedTx}
          isOpen={Boolean(selectedTx)}
          onClose={() => setSelectedTx(null)}
        />
      )}

      <StatementReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
      />
    </div>
  );
};
